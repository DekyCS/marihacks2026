from rembg import remove
from PIL import Image
from pathlib import Path


def remove_background(image_path: str, component_description: str, output_path: str) -> str:
    input_image = Image.open(image_path)
    output_image = remove(input_image)

    output_path = Path(output_path)
    png_output_path = output_path.with_suffix('.png')

    output_image.save(str(png_output_path), 'PNG')

    return str(png_output_path)
