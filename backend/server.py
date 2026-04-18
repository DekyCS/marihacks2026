from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
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
