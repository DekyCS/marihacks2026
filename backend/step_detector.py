import json
from pathlib import Path
from PIL import Image
from gemma_client import get_client, GEMMA_MODEL


def detect_steps(pdf_images: list, manual_text: str, volume_dir: str = "volume") -> list:
    client = get_client()
    model = GEMMA_MODEL

    volume_path = Path(volume_dir)

    images = []
    for img_filename in pdf_images:
        img_path = volume_path / img_filename
        if img_path.exists():
            img = Image.open(img_path)
            images.append(img)

    prompt = f"""Analyze these images from an assembly manual and identify all instructional steps.

Manual text content:
{manual_text[:5000]}

For each step, provide:
1. step_number - sequential number
2. title - short title for the step
3. description - human-friendly description for voice narration (2-3 sentences, casual tone, no part numbers)
4. image_indices - which image(s) show this step
5. page_number - which page this step is on
6. bounding_box - where the step diagram is located on the page (as percentages)

The description should sound natural when read aloud, like a friend helping you build furniture.
Use casual language like "grab the", "line it up", "pop it in".

Return a JSON object:
{{
  "steps": [
    {{
      "step_number": 1,
      "title": "Attach the legs",
      "description": "Grab the tabletop and flip it upside down. Take one of the wooden legs and line it up with the corner hole.",
      "image_indices": [0],
      "page_number": 3,
      "bounding_box": {{
        "x_percent": 10,
        "y_percent": 20,
        "width_percent": 40,
        "height_percent": 35
      }}
    }}
  ]
}}

Only return the JSON, no additional text."""

    parts = [prompt]
    for i, img in enumerate(images):
        parts.append(f"\n\nImage {i}:")
        parts.append(img)

    response = client.models.generate_content(
        model=model,
        contents=parts
    )
    response_text = response.text.strip()

    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.startswith("```"):
        response_text = response_text[3:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]

    result = json.loads(response_text.strip())
    return result.get("steps", [])
