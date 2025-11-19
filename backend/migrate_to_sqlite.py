import pandas as pd
import sqlite3
import os

# 1. 경로 설정
CSV_PATH = os.path.join("data", "festivals_db.csv")
DB_PATH = os.path.join("data", "festivals.db") # 새로 생성될 SQLite DB 파일
TABLE_NAME = "festivals" # DB에 생성될 테이블 이름

print(f"'{CSV_PATH}'에서 데이터를 읽는 중...")
try:
    # 2. CSV 파일 읽기 (데이터 타입 지정)
    df = pd.read_csv(CSV_PATH, dtype={'contentid': str, 'sigungucode': str})
except FileNotFoundError:
    print(f"오류: '{CSV_PATH}' 파일을 찾을 수 없습니다.")
    exit()

print(f"'{DB_PATH}'에 SQLite DB 생성 중...")
try:
    # 3. SQLite DB에 연결 (파일이 없으면 자동 생성)
    conn = sqlite3.connect(DB_PATH)

    # 4. Pandas DataFrame을 SQLite 테이블로 마이그레이션
    # if_exists='replace': 이미 'festivals' 테이블이 있다면 덮어쓰기
    # index=False: Pandas의 인덱스(0, 1, 2...)를 DB에 저장하지 않음
    df.to_sql(TABLE_NAME, conn, if_exists='replace', index=False)
    
    conn.close()
    
    print("---" * 10)
    print(f"✅ 마이그레이션 성공!")
    print(f"테이블 '{TABLE_NAME}'이(가) '{DB_PATH}'에 생성되었습니다.")
    print(f"총 {len(df)}개의 행(Row)이 삽입되었습니다.")

except Exception as e:
    print(f"❌ 마이그레이션 실패: {e}")