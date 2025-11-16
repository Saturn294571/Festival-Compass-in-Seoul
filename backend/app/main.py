import pandas as pd
import pickle
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# --- 1. Pydantic 모델 정의 (API 응답 규격) ---
class Festival(BaseModel):
    """
    [수정됨] 프론트엔드에 전달할 'total.csv'의 전체 행사 정보 모델.
    (프론트에서 필요한 컬럼을 여기에 추가/제거하세요)
    """
    # 
    # [필수] 기본 정보
    contentid: str
    title: str
    sigungucode: int
    
    # [추가] 상세 정보 (overview는 null일 수 있으므로 Optional)
    overview: Optional[str] = None
    
    # [추가] 날짜 (seoul_festivals_kor.csv에 int로 저장되어 있음)
    eventstartdate: Optional[int] = None
    eventenddate: Optional[int] = None
    
    # [추가] 위치 및 이미지 (null일 수 있음)
    addr1: Optional[str] = None
    firstimage: Optional[str] = None # 대표 이미지 URL
    
    # [추가] 지도 좌표 (null일 수 있음)
    mapx: Optional[float] = None
    mapy: Optional[float] = None
    
    # (필요시 'seoul_festivals_kor.csv'의 다른 컬럼들도 여기에 추가)
    # tel: Optional[str] = None
    # addr2: Optional[str] = None
    # cat1: Optional[str] = None
    # ...

class RecommendationResponse(BaseModel):
    """'Two-Track' 최종 응답 모델"""
    track1_similar: List[Festival]   # "이런 행사가 가장 유사해요!"
    track2_unpopular: List[Festival] # "이런 행사는 어떠세요?" (비인기 지역)

# --- 2. 전역 변수 및 모델 로드 설정 ---

# 모델과 데이터를 저장할 전역 딕셔너리
models = {}

# 비인기 지역구 코드 (bigDataAPI_visualization.ipynb 분석 결과 기반)
# ⚠️ [중요] 이 sigungucode 리스트는 팀의 분석 결과에 따라 정확히 수정해야 합니다.
UNPOPULAR_DISTRICTS = [
    9,  # 강북구
    19, # 도봉구
    25, # 중랑구
    14, # 노원구
    22, # 양천구
    10, # 강동구
    7,  # 은평구
    12, # 금천구
    5   # 관악구
]

# FastAPI 0.95.0 이상 권장: 'startup' 이벤트를 lifespan으로 대체
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    서버 시작 시 ML 모델을 메모리에 로드합니다.
    (아키텍처 그림의 'Online' - 'Model Load' 부분)
    """
    print("서버 시작: ML 모델 및 데이터를 로드합니다...")
    
    # 0. 파일 경로 설정
    BASE_PATH = "./" # main.py 기준 상대 경로
    DATA_PATH = os.path.join(BASE_PATH, "data", "festivals_db.csv")
    COSINE_SIM_PATH = os.path.join(BASE_PATH, "models", "cosine_sim_matrix.pkl")
    ID_TO_INDEX_PATH = os.path.join(BASE_PATH, "models", "contentid_to_index.pkl")
    
    try:
        # 1. 마스터 DB (festivals_db.csv) 로드
        db = pd.read_csv(DATA_PATH, dtype={'contentid': str})
        
        # 2. 비인기 지역구 여부 'is_unpopular' 컬럼 추가 (효율적 필터링)
        db['is_unpopular'] = db['sigungucode'].isin(UNPOPULAR_DISTRICTS)
        models["festivals_db"] = db
        print(f"✅ 1. 마스터 DB 로드 완료 ({len(db)}건)")

        # 2. 코사인 유사도 행렬 (.pkl) 로드
        with open(COSINE_SIM_PATH, "rb") as f:
            models["cosine_sim_matrix"] = pickle.load(f)
        print("✅ 2. 코사인 유사도 행렬 로드 완료")

        # 3. ID <-> Index 맵핑 딕셔너리 (.pkl) 로드
        with open(ID_TO_INDEX_PATH, "rb") as f:
            models["contentid_to_index"] = pickle.load(f)
        print("✅ 3. ID-Index 맵핑 로드 완료")
        
        print("--- 모델 로드 성공 ---")
    
    except FileNotFoundError as e:
        print(f"❌ [에러] 필수 파일 로드 실패: {e.filename}")
        print("   -> 4_ML_Modeling.ipynb를 실행하여 pkl/csv 파일을 생성했는지 확인하세요.")
    
    yield # 서버가 실행되는 동안 모델을 메모리에 유지
    
    # --- 서버 종료 시 (정리) ---
    print("서버 종료: 모델을 메모리에서 해제합니다.")
    models.clear()

# --- 3. FastAPI 앱 생성 ---
app = FastAPI(lifespan=lifespan)


# --- 4. 핵심 추천 로직 (헬퍼 함수) ---

def get_recommendations(content_id: str, top_n: int = 5):
    """
    Two-Track 추천 로직을 수행하는 내부 함수
    """
    # 1. 로드된 모델 및 데이터 가져오기
    try:
        db = models["festivals_db"]
        cosine_sim = models["cosine_sim_matrix"]
        id_to_idx = models["contentid_to_index"]
    except KeyError:
        raise HTTPException(status_code=500, detail="ML 모델이 로드되지 않았습니다.")

    # 2. content_id가 DB에 있는지 확인 (str 타입으로)
    if content_id not in id_to_idx:
        raise HTTPException(status_code=404, detail=f"Content ID '{content_id}'를 찾을 수 없습니다.")
        
    # 3. 기준이 되는 행사의 인덱스 찾기
    base_idx = id_to_idx[content_id]
    
    # 4. 유사도 점수 배열 가져오기
    sim_scores = list(enumerate(cosine_sim[base_idx]))
    
    # 5. 유사도 점수 기준으로 내림차순 정렬
    sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
    
    # --- 6. [Track 1] "이런 행사가 가장 유사해요!" ---
    # [수정] sim_scores[1:top_n+1]로 변경
    # 0번 인덱스(자기 자신)를 제외하고, 1번부터 (top_n)개 만큼 가져옵니다.
    track1_indices = [i[0] for i in sim_scores[1:top_n+1]] 
    track1_results_df = db.iloc[track1_indices]
    
    # --- 7. [Track 2] "이런 행사는 어떠세요?" (비인기 지역구) ---
    unpopular_indices_set = set(db[db['is_unpopular']].index)
    
    track2_candidates = []
    
    # [수정] sim_scores[1:]로 변경
    # 0번 인덱스(자기 자신)를 제외한 전체 유사도 리스트를 순회합니다.
    for idx, score in sim_scores[1:]:
        # (조건 1) 비인기 지역구에 속하고
        # (조건 2) Track 1에 이미 포함되지 않았는지 확인
        if idx in unpopular_indices_set and idx not in track1_indices:
            track2_candidates.append(idx)
            if len(track2_candidates) >= top_n:
                break
                
    track2_results_df = db.iloc[track2_candidates]

    return track1_results_df, track2_results_df


# --- 5. API 엔드포인트 정의 ---

# 루트 URL("/") 접속 시 index.html 반환
# FileResponse는 API 엔드포인트와 달리 response_class로 지정해야 할 수 있음
@app.get("/", response_class=FileResponse)
async def read_index():
    # uvicorn 실행 위치(backend/) 기준 상대 경로
    return FileResponse("../frontend/index.html")


@app.get("/recommendations/{content_id}", response_model=RecommendationResponse)
def get_recommendations_api(content_id: str, top_n: int = 5):
    """
    [핵심 API] 특정 행사(content_id)를 기반으로 2가지 트랙의 추천을 반환합니다.
    (아키텍처 그림의 'Online' - 'API Endpoint' 부분)
    """
    try:
        track1_df, track2_df = get_recommendations(content_id, top_n)
        
        # DataFrame을 Pydantic 모델(dict) 리스트로 변환
        track1_festivals = track1_df.to_dict(orient="records")
        track2_festivals = track2_df.to_dict(orient="records")

        return RecommendationResponse(
            track1_similar=track1_festivals,
            track2_unpopular=track2_festivals
        )
    except HTTPException as e:
        # get_recommendations에서 발생한 404, 500 에러를 그대로 반환
        raise e
    except Exception as e:
        # 기타 예외 처리
        print(f"[에러] /recommendations/{content_id} 처리 중 오류: {e}")
        raise HTTPException(status_code=500, detail=f"서버 내부 오류: {e}")
    
# --- 6. 정적파일 마운팅 ---
# 나머지 모든 정적 파일(style.css, script.js, category/...)을 서비스합니다.
# 이 코드는 *반드시* 모든 @app.get 엔드포인트보다 뒤에 (파일 맨 마지막에) 위치해야 합니다.
app.mount("/", StaticFiles(directory="../frontend"), name="static")