import imagehash
from PIL import Image
from google import genai
import os
import json
from pathlib import Path


VOLUME_DIR = Path("volume")


def compare_components_imagehash(image1_path: str, image2_path: str) -> int:
    img1 = Image.open(image1_path)
    img2 = Image.open(image2_path)

    hash1 = imagehash.phash(img1)
    hash2 = imagehash.phash(img2)

    return hash1 - hash2


def compare_components_gemini(image1_path: str, image2_path: str) -> bool:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")

    client = genai.Client(api_key=api_key)
    model = 'gemini-2.0-flash'

    img1 = Image.open(image1_path)
    img2 = Image.open(image2_path)

    prompt = """Compare these two component images.

Are these the same component? Consider:
- Same type (screw, board, leg, etc.)
- Same size and shape
- Same appearance

Answer with a JSON object:
{
  "same_component": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Only return the JSON, no additional text."""

    response = client.models.generate_content(
        model=model,
        contents=[prompt, "\n\nImage 1:", img1, "\n\nImage 2:", img2]
    )
    response_text = response.text.strip()

    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.startswith("```"):
        response_text = response_text[3:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]

    result = json.loads(response_text.strip())
    return result.get("same_component", False)


def find_matching_component(new_component_path: str, existing_components: list) -> dict:
    best_match = None
    best_similarity = float('inf')

    for existing in existing_components:
        existing_clean_image = existing.get('clean_image')
        if not existing_clean_image:
            continue

        existing_path = VOLUME_DIR / existing_clean_image
        if not existing_path.exists():
            continue

        similarity = compare_components_imagehash(new_component_path, str(existing_path))

        if similarity < 5:
            return {
                'match': existing,
                'similarity': similarity,
                'method': 'imagehash'
            }

        if 5 <= similarity <= 15 and (best_match is None or similarity < best_similarity):
            best_match = existing
            best_similarity = similarity

    if best_match and 5 <= best_similarity <= 15:
        existing_path = VOLUME_DIR / best_match.get('clean_image')
        is_same = compare_components_gemini(new_component_path, str(existing_path))

        if is_same:
            return {
                'match': best_match,
                'similarity': best_similarity,
                'method': 'gemini_vision'
            }

    return {
        'match': None,
        'similarity': best_similarity if best_match else float('inf'),
        'method': 'no_match'
    }
