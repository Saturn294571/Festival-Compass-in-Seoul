// script.js

// Sigungu 코드를 영문 이름으로 변환하기 위한 맵
const SIGUNGU_CODE_MAP = {
    "1": "Gangnam-gu", "2": "Gangdong-gu", "3": "Gangbuk-gu", "4": "Gangseo-gu",
    "5": "Gwanak-gu", "6": "Gwangjin-gu", "7": "Guro-gu", "8": "Geumcheon-gu",
    "9": "Nowon-gu", "10": "Dobong-gu", "11": "Dongdaemun-gu", "12": "Dongjak-gu",
    "13": "Mapo-gu", "14": "Seodaemun-gu", "15": "Seocho-gu", "16": "Seongdong-gu",
    "17": "Seongbuk-gu", "18": "Songpa-gu", "19": "Yangcheon-gu", "20": "Yeongdeungpo-gu",
    "21": "Yongsan-gu", "22": "Eunpyeong-gu", "23": "Jongno-gu", "24": "Jung-gu",
    "25": "Jungnang-gu"
  };
  
const API_BASE_URL = "/"; // 프론트엔드와 백엔드가 동일 출처에서 제공되므로 상대 경로 사용
  
// --- 에러 코드 및 헬퍼 함수 ---

// [신규] 디버깅을 위한 에러 코드 객체
const ERROR_CODES = {
    // FE: Frontend, BE: Backend, DB: Database
    FE01: "URL에 필요한 파라미터(sigungucode)가 없습니다.",
    FE02: "URL에 필요한 파라미터(contentId)가 없습니다.",
    FE03: "DOM에서 필수 엘리먼트를 찾을 수 없습니다.",
    BE01: "네트워크 응답이 올바르지 않습니다 (서버 에러 가능성).",
    BE02: "API 응답에 필요한 데이터(base_festival)가 누락되었습니다.",
    DB01: "데이터베이스 조회 중 오류가 발생했습니다.",
};

/**
 * 에러 메시지를 UI에 표시하고 콘솔에 로그를 남깁니다.
 * @param {string} errorId - 에러 메시지를 표시할 DOM 엘리먼트의 ID.
 * @param {string} errorCode - 에러 코드 (ERROR_CODES 객체의 키).
 * @param {Error} [error] - (선택) catch 블록에서 받은 원본 에러 객체.
 */
function showError(errorId, errorCode, error) {
    const errorEl = document.getElementById(errorId);
    const message = ERROR_CODES[errorCode] || "알 수 없는 오류가 발생했습니다.";
    
    // UI에 에러 메시지 표시
    if (errorEl) {
        errorEl.textContent = `[${errorCode}] ${message}`;
        errorEl.classList.remove('d-none');
    }
    
    // 콘솔에 상세 에러 로그 출력 (Issue 4-3 해결)
    console.error(`[${errorCode}] ${message}`, error || '');
}

/**
 * 로더 엘리먼트를 표시하고 콘텐츠 영역을 숨깁니다.
 * @param {string} loaderId - 로더 엘리먼트의 ID.
 * @param {string[]} contentIds - 숨길 콘텐츠 엘리먼트의 ID 배열.
 */
function showLoader(loaderId, ...contentIds) {
    document.getElementById(loaderId)?.classList.remove('d-none');
    contentIds.forEach(id => document.getElementById(id)?.classList.add('d-none'));
}

/**
 * 로더 엘리먼트를 숨기고 콘텐츠 영역을 표시합니다.
 * @param {string} loaderId - 로더 엘리먼트의 ID.
 * @param {string[]} contentIds - 표시할 콘텐츠 엘리먼트의 ID 배열.
 */
function hideLoader(loaderId, ...contentIds) {
    document.getElementById(loaderId)?.classList.add('d-none');
    contentIds.forEach(id => document.getElementById(id)?.classList.remove('d-none'));
}

/**
 * URL에서 쿼리 파라미터를 가져옵니다.
 * @param {string} name - 파라미터 이름.
 * @returns {string|null}
 */
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// --- 페이지 로드 함수 ---

document.addEventListener('DOMContentLoaded', () => {
    const sigungucode = getQueryParam('sigungucode');
    const contentId = getQueryParam('contentid');

    // 페이지에 존재하는 엘리먼트를 기반으로 올바른 함수로 라우팅합니다.
    if (document.getElementById('category-title')) {
        pageLoadCategory(sigungucode);
    } else if (document.getElementById('festivalList')) {
        pageLoadFestivalList(sigungucode);
    } else if (document.getElementById('festival-detail-content')) {
        pageLoadRecommendation(contentId);
    }
});


/**
 * 카테고리 페이지(category.html)의 콘텐츠를 로드합니다.
 * @param {string} sigungucode 
 */
function pageLoadCategory(sigungucode) {
    const regionName = SIGUNGU_CODE_MAP[sigungucode] || '선택된 지역';
    document.getElementById('category-title').textContent = `What's Hot in ${regionName}?`;

    const festivalLink = document.getElementById('festival-link');
    if (festivalLink) {
        festivalLink.href = `/frontend/category/festival/festival.html?sigungucode=${sigungucode}`;
    }
}


/**
 * 주어진 지역의 축제 목록을 가져와 표시합니다. (festival.html)
 * @param {string} sigungucode 
 */
async function pageLoadFestivalList(sigungucode) {
    const listEl = document.getElementById('festivalList');
    if (!listEl) return;

    if (!sigungucode) {
        showError('error-message', 'FE01');
        hideLoader('loader');
        return;
    }

    const regionName = SIGUNGU_CODE_MAP[sigungucode] || 'Seoul';
    document.getElementById('festival-list-title').textContent = `Festivals in ${regionName}`;
    
    showLoader('loader');
    try {
        const response = await fetch(`${API_BASE_URL}festivals?sigungucode=${sigungucode}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const festivals = await response.json();
        renderFestivalList(listEl, festivals, 'error-message');
    } catch (error) {
        showError('error-message', 'BE01', error);
    } finally {
        hideLoader('loader');
    }
}

/**
 * 메인 축제 상세 정보와 추천 목록을 가져와 표시합니다. (recommandation.html)
 * @param {string} contentId 
 */
async function pageLoadRecommendation(contentId) {
    if (!contentId) {
        showError('error-detail', 'FE02');
        hideLoader('loader-detail');
        return;
    }

    showLoader('loader-detail', 'festival-detail-content', 'recommendations-section');
    
    try {
        const response = await fetch(`${API_BASE_URL}recommendations/${contentId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Issue 4-1 해결: 응답 데이터에 base_festival이 있는지 확인
        if (!data.base_festival) {
            showError('error-detail', 'BE02');
            return;
        }

        // 메인 축제 상세 정보 렌더링
        renderFestivalDetail(data.base_festival);
        hideLoader('loader-detail', 'festival-detail-content', 'recommendations-section');

        // 추천 목록 렌더링 (track1, track2)
        renderFestivalList(document.getElementById('track1-list'), data.track1_similar, 'error-track1');
        renderFestivalList(document.getElementById('track2-list'), data.track2_unpopular, 'error-track2');

    } catch (error) {
        showError('error-detail', 'BE01', error);
    } finally {
        // 모든 로더를 숨깁니다 (성공/실패 무관)
        hideLoader('loader-detail');
        hideLoader('loader-track1');
        hideLoader('loader-track2');
    }
}


// --- 렌더링 함수 ---

/**
 * Bootstrap 카드를 사용하여 축제 목록을 대상 엘리먼트에 렌더링합니다.
 * @param {HTMLElement} targetEl - 렌더링할 대상 엘리먼트.
 * @param {Array} festivals - 축제 객체 배열.
 * @param {string} errorId - 목록이 비어 있을 경우 메시지를 표시할 DOM 엘리먼트의 ID.
 */
function renderFestivalList(targetEl, festivals, errorId) {
    if (!targetEl) {
        showError('error-message', 'FE03');
        return;
    }
    targetEl.innerHTML = '';

    // Issue 4-1 해결: 추천 결과가 0개일 때 안내 문구 표시
    if (!festivals || festivals.length === 0) {
        if (errorId) {
            document.getElementById(errorId).classList.remove('d-none');
        }
        return;
    }

    festivals.forEach(festival => {
        const regionName = SIGUNGU_CODE_MAP[festival.sigungucode] || 'N/A';
        const cardCol = document.createElement('div');
        cardCol.className = 'col';
        
        cardCol.innerHTML = `
            <div class="card h-100 shadow-sm">
                <a href="/frontend/category/festival/recommandation/recommandation.html?contentid=${festival.contentid}" class="text-decoration-none text-dark stretched-link">
                    ${festival.firstimage ? 
                        `<img src="${festival.firstimage}" class="card-img-top" alt="${festival.title}" style="aspect-ratio: 16/9; object-fit: cover;">` : 
                        `<div class="card-img-top bg-light d-flex align-items-center justify-content-center" style="aspect-ratio: 16/9; object-fit: cover;"><span class="text-muted">이미지 없음</span></div>`
                    }
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title mb-2">${festival.title}</h5>
                        <p class="card-text text-muted small flex-grow-1">${festival.addr1 || '주소 정보 없음'}</p>
                        <span class="badge bg-primary-subtle text-primary-emphasis rounded-pill align-self-start">${regionName}</span>
                    </div>
                </a>
            </div>
        `;
        targetEl.appendChild(cardCol);
    });
}

/**
 * 메인 축제 상세 뷰를 렌더링합니다.
 * @param {object} festival - 렌더링할 축제 객체.
 */
function renderFestivalDetail(festival) {
    const targetEl = document.getElementById('festival-detail-content');
    if (!targetEl) {
        showError('error-detail', 'FE03');
        return;
    }
    // Issue 4-1 해결: festival 객체가 유효하지 않은 경우 에러 처리
    if (!festival) {
        showError('error-detail', 'BE02');
        return;
    }

    const regionName = SIGUNGU_CODE_MAP[festival.sigungucode] || 'N/A';

    targetEl.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h1 class="display-5 fw-bold">${festival.title}</h1>
                <span class="badge bg-primary-subtle text-primary-emphasis rounded-pill fs-6">${regionName}</span>
            </div>
            <a href="javascript:history.back()" class="btn btn-outline-secondary">
              <i class="bi bi-arrow-left"></i> 뒤로가기
            </a>
        </div>
        ${festival.firstimage ?
            `<img src="${festival.firstimage}" class="img-fluid rounded-3 mb-4" alt="${festival.title}" style="width: 100%; aspect-ratio: 2/1; object-fit: cover;">` :
            `<div class="bg-light d-flex align-items-center justify-content-center rounded-3 mb-4" style="width: 100%; aspect-ratio: 2/1;"><span class="text-muted">이미지 없음</span></div>`
        }
        <p class="fs-5" style="line-height: 1.7;">
            ${festival.overview || '상세 정보 없음.'}
        </p>
    `;
}