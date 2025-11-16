# 1. Python 3.11을 기반으로 시작합니다.
FROM python:3.11-slim

# 2. 작업 디렉토리를 /app으로 설정합니다.
WORKDIR /app

# 3. backend/requirements.txt를 복사하고 설치합니다.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. 프로젝트의 모든 파일을 Docker 이미지 안으로 복사합니다.
# (backend, frontend 폴더 등이 /app/ 안으로 복사됨)
COPY . .

# 5. GCR이 사용할 포트를 8080으로 설정합니다.
ENV PORT 8080

# 6. 서버를 실행합니다.
# (backend 폴더로 이동한 뒤 uvicorn을 실행)
CMD cd backend && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}