import pandas as pd
import pickle
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import sqlite3

# --- 1. Pydantic 모델 정의 (API 응답 규격) ---
class Festival(BaseModel):
    contentid: str
    title: str
    sigungucode: int
    overview: Optional[str] = None
    eventstartdate: Optional[int] = None
    eventenddate: Optional[int] = None
    addr1: Optional[str] = None
    firstimage: Optional[str] = None
    mapx: Optional[float] = None
    mapy: Optional[float] = None
    is_unpopular: Optional[int] = 0 # [추가] is_unpopular 컬럼

class RecommendationResponse(BaseModel):
    base_festival: Festival
    track1_similar: List[Festival]
    track2_unpopular: List[Festival]

# --- 2. 전역 변수 및 모델 로드 설정 ---
models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("서버 시작: ML 모델 및 데이터를 로드합니다...")
    
    DATA_PATH = os.path.join("data", "festivals.db")
    TABLE_NAME = "festivals"
    COSINE_SIM_PATH = os.path.join("models", "cosine_sim_matrix.pkl")
    ID_TO_INDEX_PATH = os.path.join("models", "contentid_to_index.pkl")
    
    try:
        print(f"✅ 1. SQLite DB ('{DATA_PATH}')에서 데이터 로드 중...")
        conn = sqlite3.connect(DATA_PATH)
        db = pd.read_sql_query(f"SELECT * FROM {TABLE_NAME}", conn)
        conn.close()
        
        db['contentid'] = db['contentid'].astype(str)
        # [수정] is_unpopular 컬럼이 없는 구 버전 DB와의 호환성을 위해, 없으면 0으로 채움
        if 'is_unpopular' not in db.columns:
            db['is_unpopular'] = 0
            print("⚠️ 'is_unpopular' 컬럼이 DB에 없어 0으로 초기화합니다.")

        models["festivals_db"] = db
        print(f"✅ 1. 마스터 DB 로드 완료 ({len(models['festivals_db'])}건)")

        with open(COSINE_SIM_PATH, "rb") as f:
            models["cosine_sim_matrix"] = pickle.load(f)
        print("✅ 2. 코사인 유사도 행렬 로드 완료")

        with open(ID_TO_INDEX_PATH, "rb") as f:
            models["contentid_to_index"] = pickle.load(f)
        print("✅ 3. ID-Index 맵핑 로드 완료")
        
        print("--- 모델 로드 성공 ---")
    
    except FileNotFoundError as e:
        print(f"❌ [에러] 필수 파일 로드 실패: {e.filename}")
    except Exception as e:
        print(f"❌ [에러] DB 또는 모델 로드 실패: {e}")

    yield
    
    print("서버 종료: 모델을 메모리에서 해제합니다.")
    models.clear()

# --- 3. FastAPI 앱 생성, CORS 미들웨어 설정 ---
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- 4. 핵심 추천 로직 (헬퍼 함수) ---

def get_recommendations(content_id: str, top_n: int = 5):
    try:
        db = models["festivals_db"]
        cosine_sim = models["cosine_sim_matrix"]
        id_to_idx = models["contentid_to_index"]
    except KeyError:
        raise HTTPException(status_code=503, detail="ML 모델 또는 DB가 로드되지 않았습니다.")

    if content_id not in id_to_idx:
        raise HTTPException(status_code=404, detail=f"Content ID '{content_id}'를 찾을 수 없습니다.")
        
    idx_to_id = {v: k for k, v in id_to_idx.items()}
    base_idx = id_to_idx[content_id]
    sim_scores = sorted(list(enumerate(cosine_sim[base_idx])), key=lambda x: x[1], reverse=True)
    
    # Track 1: 가장 유사한 Top N
    track1_indices = [i[0] for i in sim_scores[1:top_n+1]] 
    
    # Track 2: 비인기 지역구 중 가장 유사한 Top N
    # [핵심 수정] is_unpopular 컬럼을 직접 사용하고, 인덱스가 아닌 contentid로 매칭
    unpopular_contentids = set(db[db['is_unpopular'] == 1]['contentid'])
    track2_indices = []
    
    for matrix_idx, score in sim_scores[1:]:
        current_contentid = idx_to_id.get(matrix_idx)
        if current_contentid in unpopular_contentids:
            track2_indices.append(matrix_idx)
            if len(track2_indices) >= top_n:
                break
    
    # DB에서 최종 결과 조회
    # iloc을 사용해 매트릭스 인덱스로 DataFrame에서 안전하게 조회
    track1_df = db.iloc[track1_indices]
    track2_df = db.iloc[track2_indices]

    return track1_df, track2_df

# --- 5. API 엔드포인트 정의 ---

@app.get("/")
async def read_root():
    return RedirectResponse(url="/frontend/index.html")

@app.get("/festivals", response_model=List[Festival])
async def get_festivals_by_region(sigungucode: Optional[int] = None):
    DB_PATH = os.path.join("data", "festivals.db")
    TABLE_NAME = "festivals"
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if sigungucode:
            query = f"SELECT * FROM {TABLE_NAME} WHERE sigungucode = ?"
            cursor.execute(query, (sigungucode,))
        else:
            query = f"SELECT * FROM {TABLE_NAME}"
            cursor.execute(query)
            
        results = cursor.fetchall()
        conn.close()

        festivals = [dict(row) for row in results]
        for f in festivals:
            if isinstance(f.get('contentid'), int):
                f['contentid'] = str(f['contentid'])
        return festivals
    except Exception as e:
        print(f"❌ [에러] /festivals 처리 중 오류: {e}")
        raise HTTPException(status_code=500, detail="서버 내부 오류가 발생했습니다.")

@app.get("/recommendations/{content_id}", response_model=RecommendationResponse)
def get_recommendations_api(content_id: str, top_n: int = 3):
    try:
        db = models.get("festivals_db")
        if db is None:
            raise HTTPException(status_code=503, detail="서버가 아직 준비되지 않았습니다. (DB not loaded)")

        base_festival_series = db[db['contentid'] == content_id]
        if base_festival_series.empty:
            raise HTTPException(status_code=404, detail=f"Content ID '{content_id}'에 해당하는 축제를 찾을 수 없습니다.")
        base_festival = base_festival_series.to_dict(orient="records")[0]

        track1_df, track2_df = get_recommendations(content_id, top_n)
        
        return RecommendationResponse(
            base_festival=base_festival,
            track1_similar=track1_df.to_dict(orient="records"),
            track2_unpopular=track2_df.to_dict(orient="records")
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        print(f"[에러] /recommendations/{content_id} 처리 중 예외 발생: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"서버 내부 오류가 발생했습니다.")
    
# --- 6. 정적파일 마운팅 ---
app.mount("/frontend", StaticFiles(directory="../frontend"), name="static")