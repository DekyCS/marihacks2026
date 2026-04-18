from google import genai
import os
import json
from pathlib import Path
from PIL import Image


def analyze_step_components(step_image_path: str, component_list: list, volume_dir: str = "volume") -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")

    client = genai.Client(api_key=api_key)
    model = 'gemini-2.0-flash'

    volume_path = Path(volume_dir)
    image_path = volume_path / step_image_path

    if not image_path.exists():
        raise FileNotFoundError(f"Step image not found: {image_path}")

    img = Image.open(image_path)

    component_info = []
    for comp in component_list:
        comp_id = comp.get('id', comp.get('component_id', 'unknown'))
        comp_name = comp.get('name', 'unknown')
        comp_qty = comp.get('quantity', 1)
        component_info.append(f"- {comp_id}: {comp_name} (quantity: {comp_qty})")

    prompt = f"""Analyze this assembly step image and determine 3D positions for each component.

Components available:
{chr(10).join(component_info)}

For each component instance in this step, provide:
1. component_id - the base component id with instance number (e.g., "leg_1", "leg_2")
2. position - 3D coordinates [x, y, z] where the component should be placed
   - Use a scale where the main object is roughly 2 units wide
   - x: left/right, y: up/down, z: forward/back
   - Center of scene is [0, 0, 0]
3. rotation - rotation in degrees [x, y, z]
4. scale - uniform scale factor (default 1)
5. is_moving - true if this component is being added/moved in this step
6. movement - if moving, provide animation path with "from" and "to" positions

Think about:
- What is the base/main component? (usually at [0, 0, 0])
- Where do other parts attach relative to it?
- What parts are being moved/added in this step?

Return a JSON object:
{{
  "components": {{
    "tabletop_1": {{
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "scale": 1,
      "is_moving": false,
      "movement": null
    }},
    "leg_1": {{
      "position": [0.8, -0.5, 0.5],
      "rotation": [-90, 0, 0],
      "scale": 1,
      "is_moving": true,
      "movement": {{
        "from": [0.8, 1, 0.5],
        "to": [0.8, -0.5, 0.5]
      }}
    }},
    "leg_2": {{
      "position": [-0.8, -0.5, 0.5],
      "rotation": [-90, 0, 0],
      "scale": 1,
      "is_moving": false,
      "movement": null
    }}
  }},
  "camera": {{
    "position": [3, 2, 3],
    "target": [0, 0, 0]
  }}
}}

Only return the JSON, no additional text."""

    response = client.models.generate_content(
        model=model,
        contents=[prompt, img]
    )
    response_text = response.text.strip()

    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.startswith("```"):
        response_text = response_text[3:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]

    result = json.loads(response_text.strip())
    return result
