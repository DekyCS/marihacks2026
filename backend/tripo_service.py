import os
from tripo3d import TripoClient
from tripo3d.models import TaskStatus
from pathlib import Path


async def generate_3d_model(image_path: str, component_id: str, output_dir: str = "volume/components") -> str:
    api_key = os.getenv("TRIPO_API_KEY")
    if not api_key:
        raise ValueError("TRIPO_API_KEY environment variable is not set")

    async with TripoClient(api_key=api_key) as client:
        task_id = await client.image_to_model(
            image=image_path,
            model_version="v3.0-20250812",
            texture=True,
            pbr=True,
            texture_quality="detailed",
            texture_alignment="original_image",
        )

        task = await client.wait_for_task(task_id, verbose=True)

        if task.status == TaskStatus.SUCCESS:
            os.makedirs(output_dir, exist_ok=True)

            downloaded_files = await client.download_task_models(task, output_dir)

            glb_filename = f"{component_id}.glb"
            glb_output_path = os.path.join(output_dir, glb_filename)

            for model_type, file_path in downloaded_files.items():
                if file_path and file_path.endswith('.glb'):
                    os.rename(file_path, glb_output_path)
                    return f"components/{glb_filename}"

            return None
        else:
            return None
