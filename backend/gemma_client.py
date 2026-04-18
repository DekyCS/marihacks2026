import os
from google import genai


GEMMA_MODEL = "gemma-4-31b-it"


def get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    return genai.Client(api_key=api_key)


def to_gemma_contents(messages: list[dict]) -> tuple[str | None, list[dict]]:
    system = None
    contents = []
    for msg in messages:
        role = msg["role"]
        content = msg.get("content", "")
        if role == "system":
            system = content
        elif role == "user":
            contents.append({"role": "user", "parts": [{"text": content}]})
        elif role == "assistant":
            contents.append({"role": "model", "parts": [{"text": content}]})
    return system, contents
