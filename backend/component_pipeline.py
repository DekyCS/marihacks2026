import asyncio
import json
import os
from pathlib import Path
from PIL import Image
import imagehash

from preprocessing import extract_pdf_images, extract_pdf_text
from step_detector import detect_steps
from component_detector import detect_components_in_step
from image_utils import crop_image
from component_cleaner import remove_background
from component_comparer import find_matching_component
from tripo_service import generate_3d_model
from step_analyzer import analyze_step_components
from tts_service import generate_tts
from database import calculate_pdf_hash, store_manual, store_component, store_step, store_step_component


async def process_manual_pipeline(pdf_filename: str) -> dict:
    volume_dir = Path("volume")
    pdf_path = volume_dir / pdf_filename

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_filename}")

    pdf_hash = calculate_pdf_hash(str(pdf_path))
    hash_hex = pdf_hash.hex()[:16]

    pdf_images = extract_pdf_images(pdf_filename)
    manual_text_file = extract_pdf_text(pdf_filename)

    with open(volume_dir / manual_text_file, 'r') as f:
        manual_text = f.read()

    steps = detect_steps(pdf_images, manual_text)

    component_library = {}
    component_counter = {}

    result_data = {
        "manual_id": hash_hex,
        "title": pdf_filename.replace('.pdf', ''),
        "components": {},
        "steps": []
    }

    for step_info in steps:
        step_number = step_info['step_number']
        image_indices = step_info.get('image_indices', [])

        if not image_indices:
            continue

        step_image = pdf_images[image_indices[0]]
        components_detected = detect_components_in_step(step_image)

        for comp_data in components_detected:
            comp_name = comp_data['name']
            comp_type = comp_data['type']
            comp_quantity = comp_data.get('quantity', 1)
            comp_color = comp_data.get('color', '#808080')
            bbox = comp_data['bounding_box']

            type_key = comp_type.lower().replace(' ', '_')

            if type_key in component_library:
                continue

            cropped_path = volume_dir / f"temp_{hash_hex}_{step_number}_{type_key}.jpg"
            crop_image(
                str(volume_dir / step_image),
                str(cropped_path),
                bbox['x_percent'],
                bbox['y_percent'],
                bbox['width_percent'],
                bbox['height_percent']
            )

            cleaned_path = volume_dir / "components" / f"{type_key}_clean.png"
            cleaned_path.parent.mkdir(exist_ok=True)

            actual_cleaned_path = remove_background(
                str(cropped_path),
                comp_name,
                str(cleaned_path)
            )

            match_result = find_matching_component(actual_cleaned_path, list(component_library.values()))

            if not match_result['match']:
                component_library[type_key] = {
                    'id': type_key,
                    'name': comp_name,
                    'type': comp_type,
                    'color': comp_color,
                    'quantity': comp_quantity,
                    'clean_image': f"components/{type_key}_clean.png",
                    'model_path': None
                }

                result_data['components'][type_key] = {
                    'model': None,
                    'color': comp_color
                }

            if cropped_path.exists():
                cropped_path.unlink()

    for type_key, component in component_library.items():
        if not component.get('model_path'):
            model_path = await generate_3d_model(
                str(volume_dir / component['clean_image']),
                type_key
            )
            component['model_path'] = model_path
            result_data['components'][type_key]['model'] = model_path
            store_component(component)

    for step_info in steps:
        step_number = step_info['step_number']
        step_title = step_info.get('title', f'Step {step_number}')
        step_description = step_info.get('description', step_title)
        page_number = step_info.get('page_number')
        image_indices = step_info.get('image_indices', [])

        if not image_indices:
            continue

        step_image = pdf_images[image_indices[0]]

        component_list = []
        for type_key, comp in component_library.items():
            component_list.append({
                'id': type_key,
                'name': comp['name'],
                'quantity': comp.get('quantity', 1)
            })

        analysis = analyze_step_components(step_image, component_list)

        audio_filename = f"{hash_hex}_{step_number}.mp3"
        audio_path = await generate_tts(step_description, audio_filename)

        step_components = {}
        if 'components' in analysis:
            for comp_instance_id, comp_data in analysis['components'].items():
                step_components[comp_instance_id] = {
                    'position': comp_data.get('position', [0, 0, 0]),
                    'rotation': comp_data.get('rotation', [0, 0, 0]),
                    'scale': comp_data.get('scale', 1),
                    'movement': comp_data.get('movement'),
                    'zoom': None
                }

        camera = analysis.get('camera', {'position': [3, 2, 3], 'target': [0, 0, 0]})

        step_obj = {
            'step_number': step_number,
            'title': step_title,
            'description': step_description,
            'page_number': page_number,
            'audio_url': audio_path,
            'components': step_components,
            'camera': camera
        }

        result_data['steps'].append(step_obj)

        step_id = store_step(hash_hex, {
            'step_number': step_number,
            'title': step_title,
            'description': step_description,
            'step_image': step_image,
            'page_number': page_number,
            'audio_url': audio_path
        })

        for comp_instance_id, comp_data in step_components.items():
            base_type = comp_instance_id.rsplit('_', 1)[0]
            store_step_component(step_id, {
                'component_id': base_type,
                'instance_id': comp_instance_id,
                'is_moving': comp_data.get('movement') is not None,
                'position': {
                    'x': comp_data['position'][0],
                    'y': comp_data['position'][1],
                    'z': comp_data['position'][2]
                },
                'rotation': {
                    'x': comp_data['rotation'][0],
                    'y': comp_data['rotation'][1],
                    'z': comp_data['rotation'][2]
                },
                'scale': comp_data.get('scale', 1)
            })

    json_filename = f"{hash_hex}_manual.json"
    json_path = volume_dir / json_filename

    with open(json_path, 'w') as f:
        json.dump(result_data, f, indent=2)

    store_manual(pdf_hash, pdf_filename, json_filename)

    return {
        'pdf_hash': hash_hex,
        'json_path': json_filename,
        'total_steps': len(result_data['steps']),
        'total_components': len(result_data['components'])
    }
