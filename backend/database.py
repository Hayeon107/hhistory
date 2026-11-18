
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
        CREATE TABLE IF NOT EXISTS station_info (
            no INTEGER PRIMARY KEY,
            station_name TEXT,
            addr TEXT,
            biz_no TEXT
        );

        CREATE TABLE IF NOT EXISTS monitoring_map (
            type_id INTEGER PRIMARY KEY,
            type TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS juris_map (
            type_id INTEGER PRIMARY KEY,
            type TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS commer_car_map (
            type_id INTEGER PRIMARY KEY,
            type TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS usage_map (
            type_id INTEGER PRIMARY KEY,
            type TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS is_lpg_map (
            type_id INTEGER PRIMARY KEY,
            type TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS station_connection (
            no INTEGER PRIMARY KEY,
            monitoring INTEGER NOT NULL,
            SRP TEXT,
            BLUE TEXT,
            IP TEXT,
            PORT TEXT,
            metrix_date TEXT,
            is_metrix INTEGER,
            FOREIGN KEY (no)
                REFERENCES station_info(no),
            FOREIGN KEY (monitoring)
                REFERENCES monitoring_map(type_id)
        );

        CREATE TABLE IF NOT EXISTS station_meta_code (
            no INTEGER PRIMARY KEY,
            type TEXT,
            sub_type TEXT,
            con_type TEXT,
            is_lpg INTEGER NOT NULL,
            operation_com TEXT,
            juris INTEGER NOT NULL,
            comp_test TEXT,
            skill_test TEXT,
            commer_car INTEGER NOT NULL,
            usage INTEGER NOT NULL,
            construct_com TEXT,
            manufacture_com TEXT,
            pressure TEXT,
            count INTEGER,
            etc TEXT,
            FOREIGN KEY (no)
                REFERENCES station_info(no),
            FOREIGN KEY (juris)
                REFERENCES juris_map(type_id),
            FOREIGN KEY (commer_car)
                REFERENCES commer_car_map(type_id),
            FOREIGN KEY (usage)
                REFERENCES usage_map(type_id),
            FOREIGN KEY (is_lpg)
                REFERENCES is_lpg_map(type_id)
        );

        CREATE TABLE IF NOT EXISTS station_history (
            history_id INTEGER PRIMARY KEY,
            no INTEGER NOT NULL,
            comment TEXT,
            created_at TEXT,
            FOREIGN KEY (no)
                REFERENCES station_info(no)
        );
        """)


if __name__ == "__main__":
    create_tables()
    print(f"DB 생성 완료: {DB_PATH}")
