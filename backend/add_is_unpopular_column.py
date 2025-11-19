# backend/add_is_unpopular_column.py
import sqlite3
import os

def add_is_unpopular_column():
    """
    festivals.db에 is_unpopular 컬럼을 추가하고,
    비인기 지역구에 해당하는 행의 값을 1로 업데이트합니다.
    """
    DB_PATH = os.path.join(os.path.dirname(__file__), "data", "festivals.db")
    TABLE_NAME = "festivals"

    # README에 명시된 비인기 지역구 코드
    UNPOPULAR_DISTRICTS = [9, 19, 25, 14, 22, 10, 7, 12, 5]

    print(f"'{DB_PATH}'에 연결 중...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. 컬럼 추가 (이미 있으면 무시)
        print(f"'{TABLE_NAME}' 테이블에 'is_unpopular' 컬럼 추가 시도...")
        cursor.execute(f"ALTER TABLE {TABLE_NAME} ADD COLUMN is_unpopular INTEGER DEFAULT 0")
        print(" -> 컬럼 추가 성공.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(" -> 'is_unpopular' 컬럼이 이미 존재합니다. 업데이트만 진행합니다.")
        else:
            raise e

    # 2. is_unpopular 값을 0으로 초기화
    print("모든 행의 'is_unpopular' 값을 0으로 초기화합니다.")
    cursor.execute(f"UPDATE {TABLE_NAME} SET is_unpopular = 0")

    # 3. 비인기 지역구에 대해 is_unpopular 값을 1로 업데이트
    # SQL 인젝션을 방지하기 위해 '?' 플레이스홀더 사용
    placeholders = ', '.join('?' for _ in UNPOPULAR_DISTRICTS)
    query = f"UPDATE {TABLE_NAME} SET is_unpopular = 1 WHERE sigungucode IN ({placeholders})"
    
    print(f"비인기 지역구 {UNPOPULAR_DISTRICTS}에 대해 'is_unpopular' 값을 1로 업데이트합니다.")
    cursor.execute(query, UNPOPULAR_DISTRICTS)
    
    conn.commit()
    print(f" -> {cursor.rowcount}개 행이 업데이트되었습니다.")
    
    print("\n작업 완료. 'is_unpopular' 컬럼이 성공적으로 추가 및 업데이트되었습니다.")

    # 4. 변경 사항 확인 (상위 5개 비인기 축제 출력)
    print("\n[확인] is_unpopular=1로 설정된 데이터 샘플:")
    cursor.execute(f"SELECT title, sigungucode, is_unpopular FROM {TABLE_NAME} WHERE is_unpopular = 1 LIMIT 5")
    rows = cursor.fetchall()
    for row in rows:
        print(f"  - title: {row[0]}, sigungucode: {row[1]}, is_unpopular: {row[2]}")

    conn.close()
    print(f"'{DB_PATH}' 연결 종료.")

if __name__ == "__main__":
    add_is_unpopular_column()
