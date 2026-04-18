import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.genai import types

from gemma_client import get_client


logger = logging.getLogger("voice_chat")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")

LLM_MODEL = "gemini-2.5-flash"
router = APIRouter(prefix="/voice")


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    steps_context: Optional[str] = None
    current_step: Optional[int] = None
    total_steps: Optional[int] = None


class ToolCall(BaseModel):
    name: str
    args: dict


def _build_system_instruction(steps_context: Optional[str], current_step: Optional[int], total_steps: Optional[int]) -> str:
    parts = [
        "You are an assembly assistant helping a user build a product.",
        "Keep spoken answers to 1-2 short sentences.",
        "Never read a step description word for word — explain it in your own words.",
        "When the user asks to jump to, go to, show, or explain a specific step number, call the goto_step tool with that 1-based step number. The UI will then automatically narrate that step, so do not also speak the step description.",
        "Only speak a reply when the user asked a question that requires a verbal answer and you are NOT calling a tool.",
    ]
    if current_step is not None:
        parts.append(f"The user is currently on step {current_step}.")
    if total_steps is not None:
        parts.append(f"Total steps: {total_steps}.")
    if steps_context:
        parts.append(f"Assembly steps:\n{steps_context}")
    return "\n\n".join(parts)


def _goto_step_tool() -> types.Tool:
    return types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="goto_step",
            description="Navigate the UI to a specific assembly step. Use when the user asks to go to, jump to, show, or explain a specific step by number.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "step_number": types.Schema(
                        type=types.Type.INTEGER,
                        description="1-based step number to navigate to.",
                    ),
                },
                required=["step_number"],
            ),
        )
    ])


def _to_gemini_contents(messages: list[Message]) -> list[dict]:
    contents = []
    for m in messages:
        if m.role == "user":
            contents.append({"role": "user", "parts": [{"text": m.content}]})
        elif m.role == "assistant":
            contents.append({"role": "model", "parts": [{"text": m.content}]})
    return contents


@router.post("/chat")
def chat(request: ChatRequest):
    logger.info(f"voice/chat: {len(request.messages)} msgs, step={request.current_step}")

    try:
        client = get_client()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    contents = _to_gemini_contents(request.messages)
    if not contents:
        raise HTTPException(status_code=400, detail="messages must contain at least one user turn")

    config = types.GenerateContentConfig(
        system_instruction=_build_system_instruction(
            request.steps_context, request.current_step, request.total_steps
        ),
        tools=[_goto_step_tool()],
        thinking_config=types.ThinkingConfig(thinking_budget=0),
        max_output_tokens=200,
        temperature=0.7,
    )

    try:
        response = client.models.generate_content(
            model=LLM_MODEL,
            contents=contents,
            config=config,
        )
    except Exception as exc:
        logger.error(f"Gemini error: {exc}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}")

    text_parts: list[str] = []
    tool_calls: list[dict] = []
    candidates = getattr(response, "candidates", None) or []
    if candidates and candidates[0].content and candidates[0].content.parts:
        for part in candidates[0].content.parts:
            if getattr(part, "text", None):
                text_parts.append(part.text)
            fc = getattr(part, "function_call", None)
            if fc is not None and fc.name:
                tool_calls.append({"name": fc.name, "args": dict(fc.args or {})})

    text = "".join(text_parts).strip()
    logger.info(f"voice/chat reply: text={text[:80]!r} tool_calls={tool_calls}")
    return {"text": text, "tool_calls": tool_calls}
