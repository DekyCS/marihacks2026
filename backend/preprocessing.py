from pathlib import Path
from typing import List, Tuple
try:
    import fitz
except ImportError:
    fitz = None
    import PyPDF2


def extract_pdf_images(pdf_path: str, output_dir: str = "volume") -> List[str]:
    pdf_path = Path("./volume") / pdf_path
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    pdf_hash = pdf_path.stem
    pdf_document = fitz.open(pdf_path)

    image_paths = []
    image_counter = 0

    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        image_list = page.get_images(full=True)

        for img_index, img_info in enumerate(image_list):
            xref = img_info[0]
            base_image = pdf_document.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]

            image_size_kb = len(image_bytes) / 1024
            if image_size_kb < 1:
                continue

            image_filename = f"{pdf_hash}_page_{page_num+1}_img_{image_counter:03d}.{image_ext}"
            image_path = output_path / image_filename

            with open(image_path, "wb") as img_file:
                img_file.write(image_bytes)

            image_paths.append(image_filename)
            image_counter += 1

    pdf_document.close()

    return image_paths


def extract_pdf_text(pdf_path: str, output_dir: str = "volume") -> str:
    pdf_path = Path("./volume") / pdf_path
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    pdf_hash = pdf_path.stem
    pdf_document = fitz.open(pdf_path)

    full_text = []
    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        text = page.get_text()
        if text.strip():
            full_text.append(f"Page {page_num + 1}:\n{text}\n")

    pdf_document.close()

    text_filename = f"{pdf_hash}_manual.txt"
    text_path = output_path / text_filename

    with open(text_path, "w", encoding="utf-8") as text_file:
        text_file.write("\n".join(full_text))

    return text_filename
