import sqlite3
import hashlib
from pathlib import Path
from typing import Optional, List, Tuple
import json


DB_PATH = Path("volume/manualy.db")


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS manuals (
            pdf_hash TEXT PRIMARY KEY,
            pdf_filename TEXT NOT NULL,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            json_path TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS components (
            component_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT,
            color TEXT,
            quantity INTEGER DEFAULT 1,
            clean_image TEXT,
            model_path TEXT,
            image_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pdf_hash TEXT,
            step_number INTEGER,
            title TEXT,
            description TEXT,
            step_image TEXT,
            page_number INTEGER,
            audio_path TEXT,
            camera_position TEXT,
            camera_target TEXT,
            FOREIGN KEY (pdf_hash) REFERENCES manuals(pdf_hash)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS step_components (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            step_id INTEGER,
            component_id TEXT,
            instance_id TEXT,
            is_moving BOOLEAN,
            position_x REAL,
            position_y REAL,
            position_z REAL,
            rotation_x REAL,
            rotation_y REAL,
            rotation_z REAL,
            scale REAL DEFAULT 1,
            movement_from TEXT,
            movement_to TEXT,
            FOREIGN KEY (step_id) REFERENCES steps(id),
            FOREIGN KEY (component_id) REFERENCES components(component_id)
        )
    """)

    conn.commit()
    conn.close()


def calculate_pdf_hash(pdf_path: str) -> bytes:
    sha256_hash = hashlib.sha256()
    with open(pdf_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.digest()


def store_manual(pdf_hash: bytes, pdf_filename: str, json_path: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    hash_hex = pdf_hash.hex()[:16]
    title = pdf_filename.replace('.pdf', '')

    cursor.execute(
        "INSERT OR REPLACE INTO manuals (pdf_hash, pdf_filename, title, json_path) VALUES (?, ?, ?, ?)",
        (hash_hex, pdf_filename, title, json_path)
    )

    conn.commit()
    conn.close()


def store_component(component_data: dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT OR REPLACE INTO components
        (component_id, name, type, color, quantity, clean_image, model_path, image_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        component_data['id'],
        component_data['name'],
        component_data.get('type'),
        component_data.get('color'),
        component_data.get('quantity', 1),
        component_data.get('clean_image'),
        component_data.get('model_path'),
        component_data.get('image_hash')
    ))

    conn.commit()
    conn.close()


def store_step(pdf_hash: str, step_data: dict) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    camera = step_data.get('camera', {})
    camera_position = json.dumps(camera.get('position')) if camera.get('position') else None
    camera_target = json.dumps(camera.get('target')) if camera.get('target') else None

    cursor.execute("""
        INSERT INTO steps
        (pdf_hash, step_number, title, description, step_image, page_number, audio_path, camera_position, camera_target)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pdf_hash,
        step_data['step_number'],
        step_data.get('title'),
        step_data.get('description'),
        step_data.get('step_image'),
        step_data.get('page_number'),
        step_data.get('audio_url'),
        camera_position,
        camera_target
    ))

    step_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return step_id


def store_step_component(step_id: int, component_data: dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    position = component_data.get('position', {})
    rotation = component_data.get('rotation', {})
    movement = component_data.get('movement', {})

    movement_from = json.dumps(movement.get('from')) if movement and movement.get('from') else None
    movement_to = json.dumps(movement.get('to')) if movement and movement.get('to') else None

    cursor.execute("""
        INSERT INTO step_components
        (step_id, component_id, instance_id, is_moving, position_x, position_y, position_z,
         rotation_x, rotation_y, rotation_z, scale, movement_from, movement_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        step_id,
        component_data['component_id'],
        component_data.get('instance_id'),
        component_data.get('is_moving', False),
        position.get('x', 0),
        position.get('y', 0),
        position.get('z', 0),
        rotation.get('x', 0),
        rotation.get('y', 0),
        rotation.get('z', 0),
        component_data.get('scale', 1),
        movement_from,
        movement_to
    ))

    conn.commit()
    conn.close()


def get_manual_json(pdf_hash: str) -> Optional[str]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT json_path FROM manuals WHERE pdf_hash = ?", (pdf_hash,))
    result = cursor.fetchone()
    conn.close()

    return result[0] if result else None


def get_all_manuals() -> List[Tuple[str, str]]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT pdf_hash, pdf_filename FROM manuals ORDER BY created_at DESC")
    results = cursor.fetchall()
    conn.close()

    return results


def get_manual_by_hash(pdf_hash: str) -> Optional[Tuple[str, str, str]]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT pdf_hash, pdf_filename, json_path FROM manuals WHERE pdf_hash = ?", (pdf_hash,))
    result = cursor.fetchone()
    conn.close()

    return result
