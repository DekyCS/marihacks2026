import os
from elevenlabs.client import ElevenLabs
from elevenlabs import save


async def generate_tts(text: str, output_filename: str, output_dir: str = "volume/audio") -> str:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable is not set")

    client = ElevenLabs(api_key=api_key)

    audio = client.generate(
        text=text,
        voice="Rachel",
        model="eleven_monolingual_v1"
    )

    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, output_filename)

    save(audio, output_path)

    return f"audio/{output_filename}"
