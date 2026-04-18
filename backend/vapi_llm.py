import json
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from google.genai import types

from gemma_client import get_client, GEMMA_MODEL, to_gemma_contents

logger = logging.getLogger("vapi_llm")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")

router = APIRouter(prefix="/vapi/llm")


def _extract_response_text(chunk) -> str:
    """Return only non-thinking text from a Gemma 4 streaming chunk."""
    try:
        parts = chunk.candidates[0].content.parts
        return "".join(
            p.text for p in parts
            if p.text and not getattr(p, "thought", False)
        )
    except Exception:
        return chunk.text or ""


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = 200


@router.post("/chat/completions")
def chat_completions(request: ChatRequest):
    logger.info("=== VAPI REQUEST ===")
    logger.info(f"Messages received: {len(request.messages)}")
    for m in request.messages:
        logger.info(f"  [{m.role}]: {m.content[:100]}...")

    try:
        client = get_client()
    except ValueError as exc:
        logger.error(f"get_client() failed: {exc}")
        raise HTTPException(status_code=503, detail=str(exc))

    raw_messages = [{"role": m.role, "content": m.content} for m in request.messages]
    system_instruction, contents = to_gemma_contents(raw_messages)

    logger.info(f"System instruction: {bool(system_instruction)}")
    logger.info(f"Contents count: {len(contents)}")
    for c in contents:
        logger.info(f"  [{c['role']}]: {str(c['parts'])[:100]}")

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
        max_output_tokens=512,
        temperature=request.temperature if request.temperature is not None else 0.7,
    )

    def generate():
        response_id = f"chatcmpl-{uuid.uuid4().hex[:8]}"
        pending = None
        chunk_count = 0
        try:
            logger.info(f"Starting Gemma stream (model={GEMMA_MODEL})")
            for chunk in client.models.generate_content_stream(
                model=GEMMA_MODEL,
                contents=contents,
                config=config,
            ):
                # Extract only non-thinking text parts
                text = _extract_response_text(chunk)
                if text:
                    chunk_count += 1
                    logger.info(f"  chunk #{chunk_count}: {repr(text[:50])}")
                    if pending is not None:
                        yield f"data: {json.dumps(pending)}\n\n"
                    pending = {
                        "id": response_id,
                        "object": "chat.completion.chunk",
                        "model": GEMMA_MODEL,
                        "choices": [
                            {"delta": {"content": text}, "index": 0, "finish_reason": None}
                        ],
                    }
                else:
                    try:
                        candidates = chunk.candidates
                        finish = candidates[0].finish_reason if candidates else None
                        logger.debug(f"  Skipping chunk — finish_reason={finish}")
                    except Exception:
                        pass

            if pending is not None:
                pending["choices"][0]["finish_reason"] = "stop"
                yield f"data: {json.dumps(pending)}\n\n"
            logger.info(f"Stream complete. Total chunks: {chunk_count}")
        except Exception as exc:
            logger.error(f"Gemma stream error: {exc}", exc_info=True)
            error_data = {
                "id": response_id,
                "object": "chat.completion.chunk",
                "model": GEMMA_MODEL,
                "choices": [{"delta": {"content": ""}, "index": 0, "finish_reason": "stop"}],
                "error": {"message": str(exc)},
            }
            yield f"data: {json.dumps(error_data)}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
