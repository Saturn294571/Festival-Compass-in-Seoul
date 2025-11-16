# Google Cloud Run 배포 가이드 (FastAPI + 정적 파일)

이 문서는 Python FastAPI 백엔드(`backend`)와 정적 프론트엔드(`frontend`)로 구성된 프로젝트를 Google Cloud Run (GCR)에 무료로 배포하는 과정을 안내합니다.

이 방식은 `backend` 서버가 API와 `index.html`, `style.css` 등 모든 파일을 함께 제공하는 '통합 서버' 모델을 따릅니다.

## 1\. 사전 준비

1.  **Google 계정:** Google Cloud에 로그인할 계정이 필요합니다.
2.  **Google Cloud SDK:** 로컬 컴퓨터(데스크탑)에 `gcloud` CLI가 설치되어 있어야 합니다.
3.  **프로젝트 파일:** `backend`와 `frontend` 폴더가 포함된 프로젝트 루트 폴더가 준비되어 있어야 합니다.

## 2\. Google Cloud 프로젝트 설정 (최초 1회)

로컬 컴퓨터의 터미널에서 다음 명령어를 순서대로 실행합니다.

### 2.1. Google Cloud CLI 로그인

```bash
gcloud auth login
```

(브라우저가 열리면 Google 계정으로 로그인합니다.)

### 2.2. 프로젝트 생성

`[YOUR_UNIQUE_ID]` 부분을 **전 세계에서 유일한 ID**로 설정해야 합니다. **반드시 소문자, 숫자, 하이픈(-)만 사용**해야 합니다. (예: `gdgoc-fcis-650776`)

```bash
# [YOUR_UNIQUE_ID]를 실제 ID로 변경하여 실행
gcloud projects create [YOUR_UNIQUE_ID] --name="Festival Compass"
```

### 2.3. 기본 프로젝트 설정

방금 만든 프로젝트를 `gcloud` 명령어의 기본값으로 설정합니다.

```bash
# [YOUR_UNIQUE_ID]를 위에서 사용한 ID로 변경
gcloud config set project [YOUR_UNIQUE_ID]
```

### 2.4. 결제 계정 연결 (웹 콘솔)

Cloud Run의 무료 등급을 사용하더라도, Google은 서비스 활성화를 위해 결제 계정(신용카드) 연결을 요구합니다.

1.  [Google Cloud 콘솔](https://console.cloud.google.com/)에 접속합니다.
2.  방금 만든 프로젝트(`Festival Compass`)를 선택합니다.
3.  왼쪽 메뉴에서 **[결제]** 섹션으로 이동하여 결제 계정을 프로젝트에 연결합니다. (무료 등급 한도 내에서는 비용이 청구되지 않습니다.)

### 2.5. API 서비스 활성화

터미널에서 Cloud Build API를 활성화합니다.

```bash
gcloud services enable cloudbuild.googleapis.com
```

### 2.6. Cloud Build 권한 설정

Cloud Build 서비스(일꾼 계정)가 소스 코드를 읽을 수 있도록 권한을 부여합니다. (오류가 발생할 경우에만 실행하면 되지만, 미리 설정하는 것이 좋습니다.)

`[PROJECT_NUMBER]`는 `gcloud projects describe [YOUR_UNIQUE_ID]` 명령어로 찾거나, 오류 발생 시 터미널에 표시되는 숫자(예: `846879549636`)를 사용합니다.

```bash
# [YOUR_UNIQUE_ID]와 [PROJECT_NUMBER]를 본인 값으로 변경
gcloud projects add-iam-policy-binding [YOUR_UNIQUE_ID] \
    --member=serviceAccount:[PROJECT_NUMBER]-compute@developer.gserviceaccount.com \
    --role=roles/storage.objectViewer
```

## 3\. 로컬 프로젝트 설정

배포할 코드를 GCR 환경에 맞게 수정합니다.

### 3.1. `backend/app/main.py` : CORS 설정

FastAPI가 모든 도메인에서의 요청을 허용하도록 `main.py` 상단에 미들웨어를 추가합니다.

```python
# ... (기존 import) ...
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# ... (Pydantic 모델, lifespan 함수) ...

app = FastAPI(lifespan=lifespan)

# [✅ CORS 설정 추가]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 모든 도메인 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... (이하 API 엔드포인트 및 StaticFiles 마운트) ...
```

### 3.2. `frontend/script.js` : API 경로 수정

`recommandation.html`가 API를 호출할 때, `127.0.0.1`이 아닌 같은 서버의 상대 경로를 바라보도록 `script.js`를 수정합니다.

```javascript
// frontend/script.js
// ...

async function pageLoadRecommandation(sigungucode, contentId) {
  // ... (다른 코드) ...

  // [✅ API 경로 수정]
  // "http://127.0.0.1:8000" -> "" (빈 문자열)
  const API_BASE_URL = ""; 
  const TOP_N = 3;
  
  try {
    // "/recommendations/..."로 API를 호출하게 됨
    const response = await fetch(`${API_BASE_URL}/recommendations/${contentId}?top_n=${TOP_N}`);
    
    // ... (이하 동일) ...
```

### 3.3. `Dockerfile` 생성

GCR에 "서버를 어떻게 만들어야 하는지" 알려주는 레시피 파일입니다.
프로젝트 **최상위 루트 폴더**(`D-up contest` 폴더)에 `Dockerfile`이라는 이름으로 파일을 생성합니다.

```dockerfile
# Dockerfile

# 1. Python 3.11 기반
FROM python:3.11-slim

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. backend/requirements.txt 복사 및 설치
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. 프로젝트의 모든 파일(backend, frontend)을 이미지로 복사
COPY . .

# 5. GCR이 사용할 포트 설정
ENV PORT 8080

# 6. 서버 실행 (backend 폴더로 이동 후 uvicorn 실행)
CMD cd backend && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
```

## 4\. GCR 배포 실행

모든 설정이 완료되었습니다. 프로젝트 루트 폴더(`Dockerfile`이 있는 위치)에서 다음 명령어를 실행합니다.

```bash
# [YOUR_UNIQUE_ID]를 2.2 단계에서 만든 ID로 변경
# [YOUR_SERVICE_NAME]을 원하는 서비스 이름으로 변경 (예: festival-compass)

gcloud run deploy [YOUR_SERVICE_NAME] \
    --source . \
    --platform managed \
    --region asia-northeast3 \
    --allow-unauthenticated \
    --project=[YOUR_UNIQUE_ID]
```

  * `--source .`: 현재 폴더의 `Dockerfile`을 찾아 자동으로 빌드하고 배포합니다.
  * `--region asia-northeast3`: 서울 리전입니다.
  * `--allow-unauthenticated`: 누구나 접속할 수 있도록 허용합니다.

몇 분 후 배포가 완료되면, 터미널에 `Service URL: https://[YOUR_SERVICE_NAME]-...-an.a.run.app` 형태의 공개 주소가 나타납니다.

## 5\. 프로젝트 업데이트 방법

로컬에서 `frontend` 또는 `backend` 코드를 수정한 뒤, **4단계의 `gcloud run deploy ... --source .` 명령어를 그대로 다시 실행**하면 됩니다. GCR이 자동으로 새 버전을 빌드하고 트래픽을 옮겨줍니다.