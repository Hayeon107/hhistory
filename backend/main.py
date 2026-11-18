
import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "hydrogen.db"

app = FastAPI(title="Hydrogen Station API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 운영 환경에서는 실제 프런트엔드 주소로 제한
    allow_methods=["*"],
    allow_headers=["*"],
)


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


class HistoryInput(BaseModel):
    no: str
    date: str | None = None
    category: str | None = "기타"
    content: str
    memo: str | None = ""


@app.get("/api/stations")
def get_stations():
    with connect() as conn:
        rows = conn.execute("""
            SELECT
                i.no,
                i.station_name,
                i.addr,
                i.biz_no,
                c.monitoring,
                c.SRP,
                c.BLUE,
                c.IP,
                c.PORT,
                c.metrix_date,
                c.is_metrix
            FROM station_info i
            LEFT JOIN station_connection c ON i.no = c.no
            ORDER BY i.no
        """).fetchall()

        return [
            {**dict(row), "no": str(row["no"])}
            for row in rows
        ]


@app.get("/api/history")
def get_history(station_no: str | None = None):
    with connect() as conn:
        sql = """
            SELECT history_id, no, content, created_at
            FROM station_history
        """
        params = []

        if station_no is not None:
            sql += " WHERE no = ?"
            params.append(int(station_no))

        sql += " ORDER BY created_at DESC, history_id DESC"

        rows = conn.execute(sql, params).fetchall()

        return [
            {
                "history_id": str(row["history_id"]),
                "no": str(row["no"]),
                "date": (row["created_at"] or "")[:10],
                "category": "기타",
                "content": row["content"] or "",
                "memo": "",
            }
            for row in rows
        ]


@app.post("/api/history")
def add_history(record: HistoryInput):
    try:
        with connect() as conn:
            exists = conn.execute(
                "SELECT 1 FROM station_info WHERE no = ?",
                (int(record.no),),
            ).fetchone()

            if not exists:
                raise HTTPException(
                    status_code=404,
                    detail="충전소를 찾을 수 없습니다.",
                )

            cursor = conn.execute("""
                INSERT INTO station_history (no, content, created_at)
                VALUES (?, ?, ?)
            """, (
                int(record.no),
                record.content,
                record.date,
            ))

            history_id = cursor.lastrowid

        return {
            "history_id": str(history_id),
            "no": str(record.no),
            "date": record.date or "",
            "category": "기타",
            "content": record.content,
            "memo": "",
        }

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="충전소 번호는 정수여야 합니다.",
        )


@app.post("/api/history/import")
def import_history(records: list[HistoryInput]):
    saved = []

    try:
        with connect() as conn:
            for record in records:
                no = int(record.no)

                exists = conn.execute(
                    "SELECT 1 FROM station_info WHERE no = ?",
                    (no,),
                ).fetchone()

                if not exists:
                    raise HTTPException(
                        status_code=404,
                        detail=f"충전소 번호 {no}를 찾을 수 없습니다.",
                    )

                cursor = conn.execute("""
                    INSERT INTO station_history (no, content, created_at)
                    VALUES (?, ?, ?)
                """, (no, record.content, record.date))

                saved.append({
                    "history_id": str(cursor.lastrowid),
                    "no": str(no),
                    "date": record.date or "",
                    "category": "기타",
                    "content": record.content,
                    "memo": "",
                })

        return saved

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="충전소 번호는 정수여야 합니다.",
        )
