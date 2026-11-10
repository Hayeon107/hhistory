
import sqlite3
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = BASE_DIR / "backend" / "hydrogen.db"

FILES = {
    "hydrogen_db": "hydrogen_db.xlsx",
    "hydrogen_metadb": "hydrogen_metadb.xlsx",
    "h_history": "h_history.xlsx",
}


def import_excel(conn, table_name, filename):
    file_path = DATA_DIR / filename

    if not file_path.exists():
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")

    df = pd.read_excel(file_path, dtype=object)
    df.columns = [str(col).strip() for col in df.columns]

    # 완전히 빈 행 제거
    df = df.dropna(how="all")

    columns = [
        row[1]
        for row in conn.execute(
            f'PRAGMA table_info("{table_name}")'
        )
    ]

    # 엑셀 컬럼이 DB 컬럼과 일치하는지 확인
    missing = set(columns) - set(df.columns)
    extra = set(df.columns) - set(columns)

    if missing or extra:
        raise ValueError(
            f"{filename} 컬럼 불일치\n"
            f"누락된 컬럼: {sorted(missing)}\n"
            f"추가된 컬럼: {sorted(extra)}"
        )

    df = df[columns]

    # NaN, NaT 등을 SQL NULL로 변환
    df = df.astype(object).where(pd.notna(df), None)

    quoted_columns = ", ".join(
        f'"{column}"' for column in columns
    )
    placeholders = ", ".join("?" for _ in columns)

    sql = (
        f'INSERT INTO "{table_name}" ({quoted_columns}) '
        f"VALUES ({placeholders})"
    )

    records = [
        tuple(value for value in row)
        for row in df.itertuples(index=False, name=None)
    ]

    conn.executemany(sql, records)

    print(f"{table_name}: {len(records)}건 적재 완료")


def main():
    with sqlite3.connect(DB_PATH) as conn:
        for table_name, filename in FILES.items():
            import_excel(conn, table_name, filename)


if __name__ == "__main__":
    main()
