"""Tinyfish Agent client: locate a product's user manual from a barcode.

Exposes:
- find_manual_url(barcode): synchronous lookup via /v1/automation/run
- stream_manual_search(barcode): async generator that yields SSE events from
  /v1/automation/run-sse plus a final 'RESULT' event, so the caller can show
  live progress (step names + streaming browser URL) to the user.
- download_pdf(url, dest_dir, suggested_name): saves a PDF to disk.
"""
import os
import re
import json
import urllib.parse
from pathlib import Path
from typing import Optional, TypedDict, Any, AsyncIterator

import aiohttp


TINYFISH_API_URL = os.getenv(
    "TINYFISH_API_URL",
    "https://agent.tinyfish.ai/v1/automation/run",
)
TINYFISH_SSE_URL = os.getenv(
    "TINYFISH_SSE_URL",
    "https://agent.tinyfish.ai/v1/automation/run-sse",
)
REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=300)
SSE_TIMEOUT = aiohttp.ClientTimeout(total=600, sock_read=600)


class ManualLookup(TypedDict):
    product_name: str
    manual_url: str
    source_url: str


def _extract_json_object(text: str) -> Optional[dict]:
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    brace = re.search(r"\{[\s\S]*\}", text)
    if not brace:
        return None
    try:
        return json.loads(brace.group(0))
    except json.JSONDecodeError:
        return None


def _normalize_result(result: Any) -> Optional[dict]:
    """The agent's `result` may be a dict or a stringified JSON blob. Normalize."""
    if isinstance(result, dict):
        if "manual_url" in result:
            return result
        for v in result.values():
            parsed = _normalize_result(v)
            if parsed:
                return parsed
        return None
    if isinstance(result, list):
        for item in result:
            parsed = _normalize_result(item)
            if parsed:
                return parsed
        return None
    if isinstance(result, str):
        return _extract_json_object(result)
    return None


IKEA_ARTICLE_RE = re.compile(r"^\d{3}\.\d{3}\.\d{2}$")
UPC_RE = re.compile(r"^\d{12,13}$")


def classify_code(code: str) -> str:
    """Returns 'ikea' for IKEA article numbers (NNN.NNN.NN), 'upc' otherwise."""
    stripped = code.strip()
    if IKEA_ARTICLE_RE.match(stripped):
        return "ikea"
    return "upc"


def _build_goal_upc(barcode: str) -> str:
    return (
        f"Find the user manual PDF for barcode '{barcode}'. Do NOT open the "
        f"PDF. Do NOT read or extract its contents. You only need the URL.\n\n"
        f"STEP 1. You are on https://www.upcitemdb.com/upc/{barcode}. Read "
        f"the product title on the page (usually in a large heading near the "
        f"top). Call it PRODUCT_NAME. If the page says the barcode was not "
        f"found, respond with {{\"manual_url\": null}} and stop.\n\n"
        f"STEP 2. Go to "
        f"https://www.google.com/search?q=PRODUCT_NAME+manual+filetype+pdf "
        f"(URL-encode PRODUCT_NAME, no quotes around it).\n\n"
        f"STEP 3. On the Google results page, find the FIRST result link whose "
        f"href ends in '.pdf'. Read the href directly from the results page. "
        f"DO NOT click it. DO NOT navigate to the PDF.\n\n"
        f"STEP 4. Respond with ONLY this raw JSON (no code fences, no prose):\n"
        f'{{"product_name": "<PRODUCT_NAME>", "manual_url": "<.pdf URL>", "source_url": "<Google results URL>"}}\n\n'
        f"If any step fails, respond with {{\"manual_url\": null}}."
    )


def _build_goal_ikea(article_number: str) -> str:
    return (
        f"Find the IKEA assembly manual PDF for article number "
        f"'{article_number}'. Do NOT open the PDF. You only need the URL.\n\n"
        f"STEP 1. You are already on a Google results page for "
        f"'{article_number} ikea manual filetype pdf'. Look at the result "
        f"links.\n\n"
        f"STEP 2. Find the FIRST result link whose href ends in '.pdf' "
        f"(IKEA assembly PDFs are usually hosted on ikea.com or "
        f"ikea-usa.com). Read the href directly from the results page. "
        f"DO NOT click it. DO NOT navigate to the PDF.\n\n"
        f"STEP 3. Respond with ONLY this raw JSON (no code fences, no prose):\n"
        f'{{"product_name": "IKEA {article_number}", "manual_url": "<.pdf URL>", "source_url": "<Google results URL>"}}\n\n'
        f"If no .pdf link is found, respond with {{\"manual_url\": null}}."
    )


def _build_payload(code: str) -> dict:
    kind = classify_code(code)
    if kind == "ikea":
        query = f"{code} ikea manual filetype pdf"
        return {
            "url": "https://www.google.com/search?q=" + urllib.parse.quote_plus(query),
            "goal": _build_goal_ikea(code),
            "browser_profile": "stealth",
            "agent_config": {"mode": "strict", "max_steps": 10},
        }

    return {
        "url": f"https://www.upcitemdb.com/upc/{code}",
        "goal": _build_goal_upc(code),
        "browser_profile": "stealth",
        "agent_config": {"mode": "strict", "max_steps": 20},
    }


def _require_api_key() -> str:
    api_key = os.getenv("TINYFISH_API_KEY")
    if not api_key:
        raise RuntimeError("TINYFISH_API_KEY is not set")
    return api_key


async def find_manual_url(barcode: str) -> Optional[ManualLookup]:
    api_key = _require_api_key()
    payload = _build_payload(barcode)
    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

    async with aiohttp.ClientSession(timeout=REQUEST_TIMEOUT) as session:
        async with session.post(TINYFISH_API_URL, json=payload, headers=headers) as resp:
            body = await resp.text()
            if resp.status >= 400:
                raise RuntimeError(f"Tinyfish API error {resp.status}: {body[:500]}")
            data = json.loads(body)

    if data.get("status") != "COMPLETED":
        err = data.get("error") or {}
        raise RuntimeError(
            f"Tinyfish run failed: {err.get('message') or data.get('status')}"
        )

    parsed = _normalize_result(data.get("result"))
    if not parsed or not parsed.get("manual_url"):
        return None

    return ManualLookup(
        product_name=parsed.get("product_name") or f"Product {barcode}",
        manual_url=parsed["manual_url"],
        source_url=parsed.get("source_url") or parsed["manual_url"],
    )


async def stream_manual_search(barcode: str) -> AsyncIterator[dict]:
    """Yields events as dicts:
      { "type": "STARTED" | "STREAMING_URL" | "PROGRESS" | "TF_API_RESULT" |
                "HEARTBEAT" | "COMPLETE" | "RESULT" | "ERROR", ...}
    The final yielded event is either 'RESULT' (with ManualLookup fields) or
    'ERROR' (with a message).
    """
    api_key = _require_api_key()
    payload = _build_payload(barcode)
    headers = {
        "X-API-Key": api_key,
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    final_result: Optional[dict] = None
    complete_error: Optional[str] = None

    try:
        async with aiohttp.ClientSession(timeout=SSE_TIMEOUT) as session:
            async with session.post(
                TINYFISH_SSE_URL, json=payload, headers=headers
            ) as resp:
                if resp.status >= 400:
                    body = await resp.text()
                    yield {
                        "type": "ERROR",
                        "message": f"Tinyfish SSE error {resp.status}: {body[:300]}",
                    }
                    return

                buffer = ""
                done = False
                async for chunk in resp.content.iter_any():
                    buffer += chunk.decode("utf-8", errors="replace")
                    while "\n\n" in buffer:
                        raw_event, buffer = buffer.split("\n\n", 1)
                        data_lines = [
                            line[5:].lstrip()
                            for line in raw_event.splitlines()
                            if line.startswith("data:")
                        ]
                        if not data_lines:
                            continue
                        data_str = "\n".join(data_lines).strip()
                        if not data_str or data_str == "[DONE]":
                            continue
                        try:
                            event = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        yield event

                        if event.get("type") == "COMPLETE":
                            if event.get("status") == "COMPLETED":
                                final_result = _normalize_result(event.get("result"))
                            else:
                                complete_error = (
                                    event.get("error")
                                    or event.get("help_message")
                                    or f"Agent status: {event.get('status')}"
                                )
                            done = True
                            break
                    if done:
                        break
    except aiohttp.ClientError as e:
        yield {"type": "ERROR", "message": f"Network error: {e}"}
        return

    if complete_error:
        yield {"type": "ERROR", "message": complete_error}
        return

    if not final_result or not final_result.get("manual_url"):
        yield {
            "type": "ERROR",
            "message": f"No manual URL returned for barcode {barcode}",
        }
        return

    yield {
        "type": "RESULT",
        "product_name": final_result.get("product_name") or f"Product {barcode}",
        "manual_url": final_result["manual_url"],
        "source_url": final_result.get("source_url") or final_result["manual_url"],
    }


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._-")
    return (cleaned or "manual")[:80]


async def download_pdf(url: str, dest_dir: Path, suggested_name: str) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = _safe_filename(suggested_name)
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    dest = dest_dir / filename

    counter = 1
    while dest.exists():
        stem = dest.stem.rsplit("_", 1)[0] if dest.stem.endswith(f"_{counter - 1}") else dest.stem
        dest = dest_dir / f"{stem}_{counter}.pdf"
        counter += 1

    async with aiohttp.ClientSession(timeout=REQUEST_TIMEOUT) as session:
        async with session.get(url) as resp:
            if resp.status >= 400:
                raise RuntimeError(f"Failed to download PDF ({resp.status}) from {url}")
            content_type = (resp.headers.get("Content-Type") or "").lower()
            if "pdf" not in content_type and not url.lower().endswith(".pdf"):
                raise RuntimeError(f"URL did not return a PDF (Content-Type: {content_type})")
            with open(dest, "wb") as f:
                async for chunk in resp.content.iter_chunked(64 * 1024):
                    f.write(chunk)

    return dest
