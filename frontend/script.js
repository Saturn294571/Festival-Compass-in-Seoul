/* [수정]
  - 'region' 대신 'sigungucode'를 사용하도록 로직 전면 수정
  - sigungucode를 영어 지역명으로 변환하기 위한 SIGUNGU_CODE_MAP 추가
*/

// [신규] Sigungu 코드를 영어 이름으로 변환하기 위한 맵
const SIGUNGU_CODE_MAP = {
  "1": "Gangnam-gu", "2": "Gangdong-gu", "3": "Gangbuk-gu", "4": "Gangseo-gu",
  "5": "Gwanak-gu", "6": "Gwangjin-gu", "7": "Guro-gu", "8": "Geumcheon-gu",
  "9": "Nowon-gu", "10": "Dobong-gu", "11": "Dongdaemun-gu", "12": "Dongjak-gu",
  "13": "Mapo-gu", "14": "Seodaemun-gu", "15": "Seocho-gu", "16": "Seongdong-gu",
  "17": "Seongbuk-gu", "18": "Songpa-gu", "19": "Yangcheon-gu", "20": "Yeongdeungpo-gu",
  "21": "Yongsan-gu", "22": "Eunpyeong-gu", "23": "Jongno-gu", "24": "Jung-gu",
  "25": "Jungnang-gu"
};

// DOM이 로드된 후 스크립트 실행
document.addEventListener('DOMContentLoaded', () => {
  
  // 1. [수정] 'region' -> 'sigungucode'로 파라미터명 변경
  const params = new URLSearchParams(window.location.search);
  const sigungucode = params.get('sigungucode');
  const contentId = params.get('contentid');

  // 2. 현재 페이지가 어떤 페이지인지 식별하여 해당 함수 실행
  if (document.getElementById('page-main')) {
    pageLoadIndex();
  }
  if (document.getElementById('page-category')) {
    pageLoadCategory(sigungucode); // [수정]
  }
  if (document.getElementById('page-list')) {
    pageLoadFestival(sigungucode); // [수정]
  }
  if (document.getElementById('page-detail')) {
    pageLoadRecommandation(sigungucode, contentId); // [수정]
  }
});


/**
 * 1. index.html (메인) 페이지용 로직
 */
function pageLoadIndex() {
  // ... (Figma 1_1 호버 로직 - 변경 없음) ...
  const pageMain = document.getElementById('page-main');
  const panel = document.getElementById('panel');

  if (pageMain && panel) {
    pageMain.addEventListener('mouseenter', () => panel.classList.add('show'));
    pageMain.addEventListener('focusin', () => panel.classList.add('show'));
    pageMain.addEventListener('mouseleave', () => panel.classList.remove('show'));
    pageMain.addEventListener('focusout', (e) => {
      if (!pageMain.contains(e.relatedTarget)) {
        panel.classList.remove('show');
      }
    });
  }
}

/**
 * 2. category.html 페이지용 로직
 */
function pageLoadCategory(sigungucode) { // [수정]
  // 1. 타이틀 변경 (MAP 객체 사용)
  const title = document.getElementById('category-title');
  if (title) {
    const regionName = SIGUNGU_CODE_MAP[sigungucode] || 'Seoul';
    title.textContent = `What's Hot in ${regionName}?`;
  }
  
  // 2. 'festival' 링크에 쿼리 스트링 추가
  const festivalLink = document.getElementById('festival-link');
  if (festivalLink && sigungucode) {
    // [수정] 'region' -> 'sigungucode'
    festivalLink.href = `festival/festival.html?sigungucode=${sigungucode}`;
  }
}

/**
 * 3. festival.html 페이지용 로직
 */
function pageLoadFestival(sigungucode) { // [수정]
  // 1. 타이틀 변경 (MAP 객체 사용)
  const title = document.getElementById('festival-title');
  if (title) {
    const regionName = SIGUNGU_CODE_MAP[sigungucode] || 'Seoul';
    title.textContent = `Festivals & Events in ${regionName} 🎉`;
  }

  // 2. 모든 추천 카드('rec-link') 링크에 쿼리 스트링 추가
  const recLinks = document.querySelectorAll('.rec-link');
  if (recLinks && sigungucode) {
    recLinks.forEach(link => {
      const originalHref = link.href;
      // [수정] 'region' -> 'sigungucode'
      link.href = `${originalHref}&sigungucode=${sigungucode}`;
    });
  }
}


/**
 * 4. recommandation.html 페이지 로드 함수
 */
async function pageLoadRecommandation(sigungucode, contentId) { // [수정]
  const detailTitle = document.getElementById('detail-title-placeholder');
  if (!detailTitle) {
    return;
  }

  if (!contentId) {
    detailTitle.textContent = "Error: Content ID not found in URL.";
    return;
  }

  const API_BASE_URL = "http://127.0.0.1:8000"; 
  const TOP_N = 3;
  
  try {
    // API 호출은 contentId만 필요
    const response = await fetch(`${API_BASE_URL}/recommendations/${contentId}?top_n=${TOP_N}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to fetch recommendations");
    }
    
    const data = await response.json();
    
    // 4. 메인 콘텐츠 렌더링
    // (백엔드가 기준 축제 정보는 안 주므로, Track 1의 첫 항목을 임시로 사용)
    if (data.track1_similar.length > 0) {
      const baseFestival = data.track1_similar[0]; 
      detailTitle.textContent = baseFestival.title;
      
      // [수정] 칩(Chip)을 sigungucode로 표시
      const regionName = SIGUNGU_CODE_MAP[sigungucode] || (baseFestival.sigungucode || 'N/A');
      document.getElementById('detail-chip-placeholder').textContent = regionName;
      
      document.getElementById('detail-desc-placeholder').textContent = baseFestival.overview || 'Overview not available.';
      
      const imgEl = document.getElementById('detail-img-placeholder');
      if (baseFestival.firstimage) {
        imgEl.innerHTML = `<img src="${baseFestival.firstimage}" alt="${baseFestival.title}" style="width:100%; height:100%; object-fit:cover;">`;
      } else {
        imgEl.textContent = "(No Image)";
      }
    }

    // 5. 추천 목록(Track 1, Track 2) 렌더링
    renderFestivalList('track1-list', data.track1_similar, sigungucode); // [수정]
    renderFestivalList('track2-list', data.track2_unpopular, sigungucode); // [수정]

  } catch (error) {
    console.error("Error loading recommendations:", error);
    document.getElementById('detail-content').innerHTML = 
      `<p style="color:red;">Failed to load data: ${error.message}</p>`;
  }
}

/**
 * 렌더링 헬퍼 함수
 */
function renderFestivalList(listId, festivals, sigungucode) { // [수정]
  const listElement = document.getElementById(listId);
  if (!listElement) return;

  listElement.innerHTML = ''; 

  if (!festivals || festivals.length === 0) {
    listElement.innerHTML = "<p>No recommendations found for this track.</p>";
    return;
  }

  festivals.forEach(festival => {
    const cardLink = document.createElement('a');
    // [수정] 'region' -> 'sigungucode'
    cardLink.href = `recommandation.html?contentid=${festival.contentid}&sigungucode=${sigungucode || festival.sigungucode}`;
    cardLink.className = "card clickable";
    cardLink.tabIndex = 0;
    
    // [수정] 칩(Chip)을 MAP을 이용해 영어 이름으로 표시
    const regionName = SIGUNGU_CODE_MAP[festival.sigungucode] || festival.sigungucode;
    
    cardLink.innerHTML = `
      <div class="card-title">${festival.title}</div>
      <div class="card-desc">${festival.addr1 || 'Address not available'}</div>
      <div class="chip">${regionName}</div>
    `;
    listElement.appendChild(cardLink);
  });
}