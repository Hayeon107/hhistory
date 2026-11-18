#!/usr/bin/env python3
"""
충전소 XLSX -> SQLite 적재 스크립트

사용법:
  pip install pandas openpyxl
  python import_station_data.py

기본 동작:
- 이 스크립트와 같은 폴더에 원본 XLSX 파일이 있어야 합니다.
- station_meta_code.xlsx를 station_meta 테이블의 적재 원본으로 사용합니다.
- 기존 no, history_id를 그대로 유지합니다.
- name_mapping은 아직 없으므로 생성하지 않고 station_info.biz_no FK도 설정하지 않습니다.
- 기존 DB 파일에 테이블이 이미 있으면 중복 적재를 막기 위해 중단합니다.
"""

from __future__ import annotations

import math
import sqlite3
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "station.db"

FILES = {
    "station_info": "station_info.xlsx",
    "station_meta": "station_meta_code.xlsx",
    "station_connection": "station_connection.xlsx",
    "station_history": "station_history.xlsx",
    "monitoring_map": "monitoring_map.xlsx",
    "juris_map": "juris_map.xlsx",
    "commer_car_map": "commer_car_map.xlsx",
    "usage_map": "usage_map.xlsx",
    "is_lpg_map": "is_lpg_map.xlsx",
}

SCHEMA = """
CREATE TABLE station_info (
    no           INTEGER PRIMARY KEY,
    station_name TEXT NOT NULL,
    addr         TEXT NOT NULL,
    biz_no       TEXT NOT NULL
);

CREATE TABLE monitoring_map (
    type_id INTEGER PRIMARY KEY,
    type    TEXT NOT NULL UNIQUE
);

CREATE TABLE juris_map (
    type_id INTEGER PRIMARY KEY,
    type    TEXT NOT NULL UNIQUE
);

CREATE TABLE commer_car_map (
    type_id INTEGER PRIMARY KEY,
    type    TEXT NOT NULL UNIQUE
);

CREATE TABLE usage_map (
    type_id INTEGER PRIMARY KEY,
    type    TEXT NOT NULL UNIQUE
);

CREATE TABLE is_lpg_map (
    type_id INTEGER PRIMARY KEY,
    type    TEXT NOT NULL UNIQUE
);

CREATE TABLE station_meta (
    no              INTEGER PRIMARY KEY,
    type            TEXT NOT NULL,
    sub_type        TEXT NOT NULL,
    con_type        TEXT NOT NULL,
    is_lpg          INTEGER NOT NULL,
    operation_com   TEXT,
    juris           INTEGER NOT NULL,
    comp_test       TEXT NOT NULL,
    skill_test      TEXT NOT NULL,
    commer_car      INTEGER NOT NULL,
    usage           INTEGER NOT NULL,
    construct_com   TEXT,
    manufacture_com TEXT,
    pressure        TEXT,
    count           INTEGER,
    etc             TEXT,
    FOREIGN KEY (no)         REFERENCES station_info(no),
    FOREIGN KEY (is_lpg)     REFERENCES is_lpg_map(type_id),
    FOREIGN KEY (juris)      REFERENCES juris_map(type_id),
    FOREIGN KEY (commer_car) REFERENCES commer_car_map(type_id),
    FOREIGN KEY (usage)      REFERENCES usage_map(type_id)
);

CREATE TABLE station_connection (
    no          INTEGER PRIMARY KEY,
    monitoring  INTEGER NOT NULL,
    SRP         TEXT,
    BLUE        TEXT,
    IP          TEXT,
    PORT        TEXT,
    metrix_date TEXT,
    is_metrix   INTEGER NOT NULL CHECK (is_metrix IN (0, 1)),
    FOREIGN KEY (no)         REFERENCES station_info(no),
    FOREIGN KEY (monitoring) REFERENCES monitoring_map(type_id)
);

CREATE TABLE station_history (
    history_id INTEGER PRIMARY KEY,
    no         INTEGER NOT NULL,
    content    TEXT,
    created_at TEXT,
    FOREIGN KEY (no) REFERENCES station_info(no)
);

CREATE INDEX idx_station_info_biz_no ON station_info(biz_no);
CREATE INDEX idx_station_history_no ON station_history(no);
"""


def is_missing(value: Any) -> bool:
    if value is None:
        return True
    try:
        result = pd.isna(value)
        return bool(result) if not hasattr(result, "__len__") else False
    except (TypeError, ValueError):
        return False


def to_db_value(value: Any) -> Any:
    """Convert pandas/numpy values to SQLite-friendly values without losing text."""
    if is_missing(value):
        return None

    if isinstance(value, pd.Timestamp):
        # Excel dates are stored in ISO format. Text cells containing multiple dates
        # are left unchanged by this function.
        if value.hour == value.minute == value.second == 0:
            return value.strftime("%Y-%m-%d")
        return value.strftime("%Y-%m-%d %H:%M:%S")

    if isinstance(value, (datetime, date)):
        if isinstance(value, datetime) and value.hour == value.minute == value.second == 0:
            return value.strftime("%Y-%m-%d")
        return value.isoformat(sep=" ") if isinstance(value, datetime) else value.isoformat()

    if hasattr(value, "item"):
        try:
            value = value.item()
        except (ValueError, AttributeError):
            pass

    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return int(value)

    return value


def clean_text(value: Any) -> str | None:
    value = to_db_value(value)
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def identifier_text(value: Any) -> str | None:
    """Keep numeric Excel identifiers as digit strings without a trailing .0."""
    value = to_db_value(value)
    if value is None:
        return None
    if isinstance(value, (int,)) and not isinstance(value, bool):
        return str(value)
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    return text or None


def read_xlsx(table_name: str) -> pd.DataFrame:
    path = BASE_DIR / FILES[table_name]
    if not path.exists():
        raise FileNotFoundError(f"필수 파일이 없습니다: {path.name}")
    # Keep text-like fields as their original Excel values; pandas still recognizes
    # actual Excel date cells as timestamps.
    return pd.read_excel(path, sheet_name=0)


def require_columns(df: pd.DataFrame, expected: list[str], file_name: str) -> None:
    missing = [c for c in expected if c not in df.columns]
    if missing:
        raise ValueError(f"{file_name}: 필요한 컬럼이 없습니다: {missing}")


def rows_for_insert(df: pd.DataFrame, columns: list[str]) -> list[tuple]:
    return [
        tuple(to_db_value(row[col]) for col in columns)
        for _, row in df[columns].iterrows()
    ]


def validate_unique_pk(df: pd.DataFrame, col: str, file_name: str) -> None:
    if df[col].isna().any():
        raise ValueError(f"{file_name}: PK {col}에 빈 값이 있습니다.")
    duplicated = df.loc[df[col].duplicated(keep=False), col].tolist()
    if duplicated:
        raise ValueError(f"{file_name}: PK {col} 중복값이 있습니다: {duplicated[:10]}")


def normalize_juris_map(df: pd.DataFrame) -> pd.DataFrame:
    # 실제 파일은 컬럼명이 반대로 되어 있음:
    # type = 숫자 코드, type_id = 권역명.
    require_columns(df, ["type", "type_id"], FILES["juris_map"])
    out = pd.DataFrame({
        "type_id": pd.to_numeric(df["type"], errors="raise").astype(int),
        "type": df["type_id"].map(clean_text),
    })
    if out["type"].isna().any():
        raise ValueError("juris_map.xlsx: 권역명이 비어 있는 행이 있습니다.")
    return out


def normalize_monitoring(value: Any, label_to_id: dict[str, int]) -> int:
    label = clean_text(value)
    if label is None:
        raise ValueError("station_connection.xlsx: monitoring 값이 비어 있습니다.")

    # Normalize whitespace around slash and ordinary trailing/inner spaces.
    normalized = " ".join(label.split())
    normalized = normalized.replace(" / ", "/").replace("/ ", "/").replace(" /", "/")

    # Only known equivalent label variations from the supplied workbook.
    aliases = {
        "설치": "설치",
        "미설치": "미설치",
        "설치불가/이동식": "설치불가/이동식",
        "액화수소충전소": "액화수소충전소",
    }
    normalized = aliases.get(normalized, normalized)
    if normalized not in label_to_id:
        raise ValueError(
            f"monitoring 코드 매핑 실패: 원본값={value!r}, 정규화값={normalized!r}"
        )
    return label_to_id[normalized]


def main() -> None:
    # Read all source files first; do not alter the originals.
    info = read_xlsx("station_info")
    meta = read_xlsx("station_meta")
    conn_df = read_xlsx("station_connection")
    history = read_xlsx("station_history")

    maps = {
        "monitoring_map": read_xlsx("monitoring_map"),
        "juris_map": normalize_juris_map(read_xlsx("juris_map")),
        "commer_car_map": read_xlsx("commer_car_map"),
        "usage_map": read_xlsx("usage_map"),
        "is_lpg_map": read_xlsx("is_lpg_map"),
    }

    require_columns(info, ["no", "station_name", "addr", "biz_no"], FILES["station_info"])
    require_columns(
        meta,
        ["no", "type", "sub_type", "con_type", "is_lpg", "operation_com",
         "juris", "comp_test", "skill_test", "commer_car", "usage",
         "construct_com", "manufacture_com", "pressure", "count", "etc"],
        FILES["station_meta"],
    )
    require_columns(
        conn_df,
        ["no", "monitoring", "SRP", "BLUE", "IP", "PORT", "metrix_date", "is_metrix"],
        FILES["station_connection"],
    )
    require_columns(history, ["history_id", "no", "biz_no", "content", "created_at"], FILES["station_history"])

    # Existing identifiers must be preserved, not regenerated.
    for df, pk, name in [
        (info, "no", FILES["station_info"]),
        (meta, "no", FILES["station_meta"]),
        (conn_df, "no", FILES["station_connection"]),
        (history, "history_id", FILES["station_history"]),
    ]:
        validate_unique_pk(df, pk, name)

    # Validate 1:1 station relationships and history station references.
    info_nos = set(pd.to_numeric(info["no"], errors="raise").astype(int))
    for df, name in [(meta, FILES["station_meta"]), (conn_df, FILES["station_connection"])]:
        refs = set(pd.to_numeric(df["no"], errors="raise").astype(int))
        if refs - info_nos:
            raise ValueError(f"{name}: station_info에 없는 no가 있습니다: {sorted(refs - info_nos)[:10]}")
        if refs != info_nos:
            raise ValueError(f"{name}: station_info와 no 집합이 다릅니다.")

    history_nos = set(pd.to_numeric(history["no"], errors="raise").astype(int))
    if history_nos - info_nos:
        raise ValueError(f"station_history: station_info에 없는 no가 있습니다: {sorted(history_nos - info_nos)[:10]}")

    # history.xlsx has an extra biz_no column not in the target ERD.
    # Validate it against station_info before omitting the redundant column.
    biz_by_no = {
        int(row["no"]): identifier_text(row["biz_no"])
        for _, row in info[["no", "biz_no"]].iterrows()
    }
    mismatches = []
    for _, row in history[["history_id", "no", "biz_no"]].iterrows():
        no = int(row["no"])
        if identifier_text(row["biz_no"]) != biz_by_no.get(no):
            mismatches.append(int(row["history_id"]))
    if mismatches:
        raise ValueError(
            "station_history.xlsx의 biz_no가 station_info와 다른 이력이 있습니다. "
            f"history_id 예시: {mismatches[:10]}"
        )

    # Validate and normalize map tables.
    for map_name, df in maps.items():
        require_columns(df, ["type_id", "type"], FILES[map_name])
        validate_unique_pk(df, "type_id", FILES[map_name])
        if df["type"].map(clean_text).isna().any():
            raise ValueError(f"{FILES[map_name]}: type 값이 비어 있습니다.")

    map_id_sets = {
        name: set(pd.to_numeric(df["type_id"], errors="raise").astype(int))
        for name, df in maps.items()
    }
    for col, map_name in [
        ("is_lpg", "is_lpg_map"),
        ("juris", "juris_map"),
        ("commer_car", "commer_car_map"),
        ("usage", "usage_map"),
    ]:
        values = set(pd.to_numeric(meta[col], errors="raise").astype(int))
        invalid = values - map_id_sets[map_name]
        if invalid:
            raise ValueError(f"station_meta_code.xlsx: {col}에 매핑되지 않는 코드가 있습니다: {sorted(invalid)}")

    monitoring_df = maps["monitoring_map"]
    label_to_id = {
        clean_text(row["type"]): int(row["type_id"])
        for _, row in monitoring_df.iterrows()
    }
    conn_df = conn_df.copy()
    conn_df["monitoring"] = conn_df["monitoring"].map(
        lambda value: normalize_monitoring(value, label_to_id)
    )
    conn_df["is_metrix"] = conn_df["is_metrix"].map(
        lambda value: 1 if bool(value) else 0
    )

    # Preserve biz_no as TEXT, avoiding a numeric SQLite type for identifiers.
    info = info.copy()
    info["biz_no"] = info["biz_no"].map(identifier_text)

    # Map tables: convert all values to plain Python types.
    for map_name, df in maps.items():
        maps[map_name] = df.copy()
        maps[map_name]["type"] = maps[map_name]["type"].map(clean_text)
        maps[map_name]["type_id"] = pd.to_numeric(
            maps[map_name]["type_id"], errors="raise"
        ).astype(int)

    # Never silently overwrite/reimport into an existing populated DB.
    if DB_PATH.exists():
        with sqlite3.connect(DB_PATH) as existing:
            existing_tables = {
                row[0] for row in existing.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                )
            }
        if existing_tables:
            raise FileExistsError(
                f"{DB_PATH.name}에 기존 테이블이 있습니다: {sorted(existing_tables)}. "
                "백업 후 새 DB 경로를 지정하거나 기존 DB를 별도로 정리하세요."
            )

    con = sqlite3.connect(DB_PATH)
    try:
        con.execute("PRAGMA foreign_keys = ON")
        if con.execute("PRAGMA foreign_keys").fetchone()[0] != 1:
            raise RuntimeError("SQLite 외래 키 기능을 활성화하지 못했습니다.")

        with con:
            con.executescript(SCHEMA)

            # 1) Lookup/code tables
            for map_name, df in maps.items():
                cols = ["type_id", "type"]
                con.executemany(
                    f"INSERT INTO {map_name} ({','.join(cols)}) VALUES (?, ?)",
                    rows_for_insert(df, cols),
                )

            # 2) Main station data (biz_no FK intentionally deferred until name_mapping exists)
            info_cols = ["no", "station_name", "addr", "biz_no"]
            con.executemany(
                "INSERT INTO station_info (no, station_name, addr, biz_no) VALUES (?, ?, ?, ?)",
                rows_for_insert(info, info_cols),
            )

            # 3) Metadata: code-based workbook is the import source.
            meta_cols = [
                "no", "type", "sub_type", "con_type", "is_lpg", "operation_com",
                "juris", "comp_test", "skill_test", "commer_car", "usage",
                "construct_com", "manufacture_com", "pressure", "count", "etc",
            ]
            con.executemany(
                f"INSERT INTO station_meta ({','.join(meta_cols)}) VALUES ({','.join(['?'] * len(meta_cols))})",
                rows_for_insert(meta, meta_cols),
            )

            # PORT is TEXT because at least one source value contains a note, not just a port number.
            conn_cols = ["no", "monitoring", "SRP", "BLUE", "IP", "PORT", "metrix_date", "is_metrix"]
            con.executemany(
                f"INSERT INTO station_connection ({','.join(conn_cols)}) VALUES ({','.join(['?'] * len(conn_cols))})",
                rows_for_insert(conn_df, conn_cols),
            )

            # history.biz_no was validated above but is not stored in the ERD table.
            hist_cols = ["history_id", "no", "content", "created_at"]
            con.executemany(
                "INSERT INTO station_history (history_id, no, content, created_at) VALUES (?, ?, ?, ?)",
                rows_for_insert(history, hist_cols),
            )

            fk_errors = con.execute("PRAGMA foreign_key_check").fetchall()
            if fk_errors:
                raise ValueError(f"외래 키 위반이 발견되었습니다: {fk_errors[:10]}")

            expected = {
                "station_info": len(info),
                "station_meta": len(meta),
                "station_connection": len(conn_df),
                "station_history": len(history),
                **{name: len(df) for name, df in maps.items()},
            }
            actual = {
                name: con.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
                for name in expected
            }
            if expected != actual:
                raise ValueError(f"행 수 검증 실패. expected={expected}, actual={actual}")

        print(f"적재 완료: {DB_PATH}")
        for table, count in actual.items():
            print(f"  {table}: {count:,}행")
        print("외래 키 검사: 통과")
        print("참고: name_mapping은 아직 없으므로 station_info.biz_no FK는 미설정 상태입니다.")
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


if __name__ == "__main__":
    main()
