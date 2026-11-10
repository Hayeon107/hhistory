
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "hydrogen.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def create_tables():
    with get_connection() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS hydrogen_db (
            no INTEGER PRIMARY KEY,
            station_name TEXT,
            addr TEXT,
            biz_no TEXT,
            monitoring TEXT,
            SRP TEXT,
            BLUE TEXT,
            IP TEXT,
            PORT TEXT,
            is_metrix TEXT
        );

        CREATE TABLE IF NOT EXISTS hydrogen_metadb (
            no INTEGER PRIMARY KEY,
            biz_no TEXT,
            stataion_name TEXT,
            type TEXT,
            sub_type TEXT,
            con_type TEXT,
            is_lpg TEXT,
            operation_com TEXT,
            addr TEXT,
            juris TEXT,
            comp_test TEXT,
            skill_test TEXT,
            commer_car TEXT,
            usage TEXT,
            contruct_com TEXT,
            manufacture_com TEXT,
            pressure TEXT,
            count INTEGER,
            etc TEXT
        );

        CREATE TABLE IF NOT EXISTS h_history (
            history_id INTEGER PRIMARY KEY,
            no INTEGER NOT NULL,
            biz_no TEXT,
            content TEXT,
            created_at TEXT,
            FOREIGN KEY (no) REFERENCES hydrogen_db(no)
        );
        """)


if __name__ == "__main__":
    create_tables()
    print(f"DB 생성 완료: {DB_PATH}")
