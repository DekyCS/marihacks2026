from google import genai
import os
import json
from pathlib import Path
from PIL import Image


def detect_components_in_step(step_image_path: str, volume_dir: str = "volume") -> list:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")

    client = genai.Client(api_key=api_key)
    model = 'gemini-2.0-flash-exp'

    volume_path = Path(volume_dir)
    image_path = volume_path / step_image_path

    if not image_path.exists():
        raise FileNotFoundError(f"Step image not found: {image_path}")

    img = Image.open(image_path)

    prompt = """Analyze this assembly step image and identify all components.

For each unique component type, provide:
1. name - human-friendly name without part numbers (e.g., "wooden leg" not "100514")
2. type - category (screw, bolt, leg, board, panel, connector, bracket, etc.)
3. quantity - how many of this component appear in this step
4. bounding_box - coordinates of ONE instance as percentages of image dimensions
5. color - approximate color in hex format

Return a JSON object:
{
  "components": [
    {
      "name": "wooden leg",
      "type": "leg",
      "quantity": 4,
      "bounding_box": {
        "x_percent": 25.5,
        "y_percent": 30.2,
        "width_percent": 5.0,
        "height_percent": 15.0
      },
      "color": "#8B4513"
    },
    {
      "name": "metal screw",
      "type": "screw",
      "quantity": 8,
      "bounding_box": {
        "x_percent": 60.0,
        "y_percent": 45.0,
        "width_percent": 3.0,
        "height_percent": 4.0
      },
      "color": "#808080"
    }
  ]
}

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
    return result.get("components", [])
