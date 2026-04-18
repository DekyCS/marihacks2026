from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from contextlib import asynccontextmanager
import json
from dotenv import load_dotenv

from database import init_db, calculate_pdf_hash, store_manual, get_all_manuals, get_manual_json, get_manual_by_hash

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="ManualY API",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "ManualY API",
        "version": "2.0.0"
    }


@app.get("/manuals")
async def list_manuals():
    try:
        manuals = get_all_manuals()
        return {
            "success": True,
            "manuals": [
                {"hash": hash_val, "filename": filename}
                for hash_val, filename in manuals
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        volume_dir = Path("volume")
        volume_dir.mkdir(exist_ok=True)

        file_path = volume_dir / file.filename

        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        pdf_hash = calculate_pdf_hash(str(file_path))
        hash_hex = pdf_hash.hex()[:16]

        store_manual(pdf_hash, file.filename, "")

        return {
            "success": True,
            "message": "PDF uploaded successfully",
            "pdf_hash": hash_hex,
            "filename": file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BarcodeRequest(BaseModel):
    barcode: str


@app.post("/barcode")
async def scan_barcode(req: BarcodeRequest):
    try:
        import tinyfish_service

        barcode = (req.barcode or "").strip()
        if not barcode:
            raise HTTPException(status_code=400, detail="barcode is required")

        lookup = await tinyfish_service.find_manual_url(barcode)
        if not lookup:
            raise HTTPException(
                status_code=404,
                detail=f"No manual found for barcode {barcode}"
            )

        volume_dir = Path("volume")
        pdf_path = await tinyfish_service.download_pdf(
            lookup["manual_url"], volume_dir, lookup["product_name"]
        )

        pdf_hash = calculate_pdf_hash(str(pdf_path))
        hash_hex = pdf_hash.hex()[:16]
        store_manual(pdf_hash, pdf_path.name, "")

        return {
            "success": True,
            "pdf_hash": hash_hex,
            "filename": pdf_path.name,
            "product_name": lookup["product_name"],
            "source_url": lookup["source_url"],
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in /barcode: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/barcode/stream")
async def stream_barcode(code: str):
    import tinyfish_service
    import asyncio

    barcode = (code or "").strip()
    if not barcode:
        raise HTTPException(status_code=400, detail="code is required")

    async def event_source():
        volume_dir = Path("volume")
        final_lookup = None

        try:
            async for event in tinyfish_service.stream_manual_search(barcode):
                etype = event.get("type")
                if etype == "RESULT":
                    final_lookup = event
                    continue
                if etype == "ERROR":
                    yield _sse({"type": "ERROR", "message": event.get("message") or "Agent failed"})
                    return
                yield _sse(event)
        except asyncio.CancelledError:
            # Client disconnected; drop the TinyFish connection via context manager in the generator.
            raise
        except Exception as e:
            yield _sse({"type": "ERROR", "message": f"Stream failed: {e}"})
            return

        if not final_lookup:
            yield _sse({"type": "ERROR", "message": "Agent did not return a manual URL"})
            return

        yield _sse({"type": "DOWNLOADING", "manual_url": final_lookup["manual_url"]})

        try:
            pdf_path = await tinyfish_service.download_pdf(
                final_lookup["manual_url"], volume_dir, final_lookup["product_name"]
            )
        except Exception as e:
            yield _sse({"type": "ERROR", "message": f"PDF download failed: {e}"})
            return

        pdf_hash = calculate_pdf_hash(str(pdf_path))
        hash_hex = pdf_hash.hex()[:16]
        store_manual(pdf_hash, pdf_path.name, "")

        yield _sse({
            "type": "READY",
            "pdf_hash": hash_hex,
            "filename": pdf_path.name,
            "product_name": final_lookup["product_name"],
            "source_url": final_lookup["source_url"],
        })

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@app.post("/process/{pdf_hash}")
async def process_manual(pdf_hash: str):
    try:
        from component_pipeline import process_manual_pipeline

        manual = get_manual_by_hash(pdf_hash)
        if not manual:
            raise HTTPException(status_code=404, detail=f"PDF with hash {pdf_hash} not found")

        pdf_filename = manual[1]

        result = await process_manual_pipeline(pdf_filename)

        return {
            "success": True,
            "result": result
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error processing manual: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/json/{pdf_hash}")
async def get_json(pdf_hash: str):
    try:
        json_path = get_manual_json(pdf_hash)
        if not json_path:
            raise HTTPException(status_code=404, detail="Manual not found")

        volume_dir = Path("volume")
        json_file = volume_dir / json_path

        if not json_file.exists():
            raise HTTPException(status_code=404, detail="JSON file not found")

        with open(json_file, 'r') as f:
            data = json.load(f)

        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/file/{filepath:path}")
async def get_file(filepath: str):
    try:
        volume_dir = Path("volume")
        file_path = volume_dir / filepath

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
