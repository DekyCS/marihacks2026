from PIL import Image


def crop_image(input_path: str, output_path: str, x: float, y: float, width: float, height: float) -> str:
    img = Image.open(input_path)
    img_width, img_height = img.size

    crop_x = int((x / 100) * img_width)
    crop_y = int((y / 100) * img_height)
    crop_width = int((width / 100) * img_width)
    crop_height = int((height / 100) * img_height)

    crop_x = max(0, min(crop_x, img_width - 1))
    crop_y = max(0, min(crop_y, img_height - 1))
    crop_right = min(crop_x + crop_width, img_width)
    crop_bottom = min(crop_y + crop_height, img_height)

    cropped = img.crop((crop_x, crop_y, crop_right, crop_bottom))
    cropped.save(output_path)

    return output_path
