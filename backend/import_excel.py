
import sqlite3
from pathlib import Path

import pandas as pd

from database import create_tables, get_connection


# 현재 폴더 구조 기준 경로
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data"


# 엑셀 파일명과 DB 테이블명 연결
IMPORT_FILES = {
    "monitoring_map": "monitoring_map.xlsx",
    "juris_map": "juris_map.xlsx",
    "commer_car_map": "commer_car_map.xlsx",
    "usage_map": "usage_map.xlsx",
    "is_lpg_map": "is_lpg_map.xlsx",
    "station_info": "station_info.xlsx",
    "station_connection": "station_connection.xlsx",
    "station_meta_code": "station_meta_code.xlsx",
    "station_history": "station_history.xlsx",
}


# 테이블별 기본 키
PRIMARY_KEYS = {
    "monitoring_map": "type_id",
    "juris_map": "type_id",
    "commer_car_map": "type_id",
    "usage_map": "type_id",
    "is_lpg_map": "type_id",
    "station_info": "no",
    "station_connection": "no",
    "station_meta_code": "no",
    "station_history": "history_id",
}


# 테이블별 허용 컬럼
TABLE_COLUMNS = {
    "monitoring_map": ["type_id", "type"],
    "juris_map": ["type_id", "type"],
    "commer_car_map": ["type_id", "type"],
    "usage_map": ["type_id", "type"],
    "is_lpg_map": ["type_id", "type"],

    "station_info": [
        "no", "station_name", "addr", "biz_no"
    ],

    "station_connection": [
        "no", "monitoring", "SRP", "BLUE", "IP",
        "PORT", "metrix_date", "is_metrix"
    ],

    "station_meta_code": [
        "no", "type", "sub_type", "con_type", "is_lpg",
        "operation_com", "juris", "comp_test", "skill_test",
        "commer_car", "usage", "construct_com",
        "manufacture_com", "pressure", "count", "etc"
    ],

    "station_history": [
        "history_id", "no", "comment", "created_at"
    ],
}


def normalize_value(value):
    """엑셀의 빈 값과 정수 형태의 숫자를 SQLite에 맞게 변환."""
    if pd.isna(value):
        return None

    # 엑셀에서 1이 1.0으로 읽히는 경우 정수로 변환
    if isinstance(value, float) and value.is_integer():
        return int(value)

    return value


def import_table(conn, table_name, file_name):
    """엑셀 파일 하나를 해당 DB 테이블에 가져온다."""
    file_path = DATA_DIR / file_name

    if not file_path.exists():
        raise FileNotFoundError(
            f"엑셀 파일을 찾을 수 없습니다: {file_path}"
        )

    # 첫 번째 시트를 읽는다.
    df = pd.read_excel(file_path, sheet_name=0)

    # 엑셀의 컬럼명 앞뒤 공백 제거
    df.columns = [str(col).strip() for col in df.columns]

    # 엑셀 저장 과정에서 생긴 불필요한 인덱스 컬럼 제거
    df = df.loc[
        :, ~df.columns.str.match(r"^Unnamed(:\s*\d+)?$")
    ]

    if df.empty:
        print(f"[건너뜀] {file_name}: 데이터가 없습니다.")
        return

    allowed_columns = TABLE_COLUMNS[table_name]
    primary_key = PRIMARY_KEYS[table_name]

    # DB에 존재하지 않는 컬럼이 있는지 확인
    unknown_columns = [
        col for col in df.columns
        if col not in allowed_columns
    ]

    if unknown_columns:
        raise ValueError(
            f"{file_name}에 알 수 없는 컬럼이 있습니다: "
            f"{unknown_columns}"
        )

    # 기본 키 컬럼 확인
    if primary_key not in df.columns:
        raise ValueError(
            f"{file_name}에 기본 키 컬럼 '{primary_key}'가 없습니다."
        )

    # SQL에 사용할 컬럼은 DB에서 허용된 순서로 정렬
    columns = [
        col for col in allowed_columns
        if col in df.columns
    ]

    quoted_columns = ", ".join(
        f'"{col}"' for col in columns
    )
    placeholders = ", ".join("?" for _ in columns)

    update_columns = [
        col for col in columns
        if col != primary_key
    ]

    if update_columns:
        update_sql = ", ".join(
            f'"{col}" = excluded."{col}"'
            for col in update_columns
        )
        conflict_sql = (
            f'ON CONFLICT("{primary_key}") '
            f'DO UPDATE SET {update_sql}'
        )
    else:
        conflict_sql = (
            f'ON CONFLICT("{primary_key}") DO NOTHING'
        )

    sql = (
        f'INSERT INTO "{table_name}" ({quoted_columns}) '
        f'VALUES ({placeholders}) '
        f'{conflict_sql}'
    )

    imported_count = 0

    for index, row in df.iterrows():
        values = [
            normalize_value(row[col])
            for col in columns
        ]

        # 기본 키가 없는 행은 가져오지 않는다.
        pk_index = columns.index(primary_key)

        if values[pk_index] is None:
            print(
                f"[건너뜀] {file_name} "
                f"{index + 2}행: 기본 키가 없습니다."
            )
            continue

        try:
            conn.execute(sql, values)
            imported_count += 1

        except sqlite3.Error as e:
            raise RuntimeError(
                f"데이터 가져오기 실패\n"
                f"- 파일: {file_name}\n"
                f"- 테이블: {table_name}\n"
                f"- 엑셀 행: {index + 2}\n"
                f"- 원인: {e}"
            ) from e

    print(
        f"[완료] {file_name} → {table_name}: "
        f"{imported_count}개 행 처리"
    )


def main():
    if not DATA_DIR.exists():
        raise FileNotFoundError(
            f"data 폴더를 찾을 수 없습니다: {DATA_DIR}"
        )

    # DB 테이블이 없으면 생성한다.
    create_tables()

    # 연결을 명시적으로 닫는다.
    conn = get_connection()

    try:
        # 전체 파일을 하나의 트랜잭션으로 처리한다.
        with conn:
            for table_name, file_name in IMPORT_FILES.items():
                import_table(conn, table_name, file_name)

        print("\n모든 엑셀 데이터 가져오기가 완료되었습니다.")

    except Exception:
        print(
            "\n오류가 발생했습니다. "
            "이번 실행에서 수행한 DB 변경은 롤백됩니다."
        )
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    main()
