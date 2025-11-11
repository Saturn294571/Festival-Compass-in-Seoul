# main.py

from fastapi import FastAPI

# 1. FastAPI 앱 인스턴스 생성
app = FastAPI()

# 2. API 엔드포인트(Endpoint) 정의
# @app.get("/")는 HTTP GET 요청이 "/" 경로(루트)로 올 때
# 아래 함수(root)를 실행하라는 의미입니다.
@app.get("/")
def read_root():
    """
    서버의 루트 경로로 접속하면 "Hello World"를 반환합니다.
    """
    # 3. JSON 형식으로 응답 반환
    return {"message": "Hello, World! FastAPI 서버가 준비되었습니다."}