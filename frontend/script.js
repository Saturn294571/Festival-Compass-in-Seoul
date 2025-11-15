/* index.html에서 분리된 script.js 파일입니다.
  - go() 함수는 제거되고, HTML의 <a> 태그로 대체되었습니다.
  - 각 페이지의 요소가 없을 때 오류가 나지 않도록 방어 코드가 추가되었습니다.
*/

// [공통] Landmark 페이지 목록을 채우는 함수
function fillAttractionList(){
    const list = document.getElementById('attractionList');
    
    // landmark.html이 아니면 list가 없으므로, null 체크 후 종료
    if (!list) {
      return;
    }
    
    list.innerHTML = '';
    const data = [
      {t:'남산서울타워', a:'중구 · 남산공원길 105', region:'중구', click:true},
      {t:'경복궁', a:'종로구 · 사직로 161', region:'종로구'},
      {t:'북촌한옥마을', a:'종로구 · 계동길 37', region:'종로구'},
      {t:'서울숲', a:'성동구 · 뚝섬로 273', region:'성동구'},
      {t:'올림픽공원', a:'송파구 · 올림픽로 424', region:'송파구'},
      {t:'영광시장', a:'영등포구 · 여의도동', region:'영등포구'},
      {t:'창덕궁 낙선', a:'종로구 · 율곡로 99', region:'종로구'},
      {t:'선유도공원', a:'영등포구 · 선유로 343', region:'영등포구'},
      {t:'DMC', a:'마포구 · 성암로 301', region:'마포구'},
      {t:'청계천', a:'종로구 · 창신동', region:'종로구'},
    ];
    for(const d of data){
      list.innerHTML += `
        <div class="card ${d.click?'clickable':''}" tabindex="0">
          <div class="card-title">${d.t}</div>
          <div class="card-desc">${d.a}</div>
          <div class="chip">${d.region}</div>
        </div>
      `;
    }
  }
  
  // DOM이 로드된 후 스크립트 실행
  document.addEventListener('DOMContentLoaded', () => {
  
    // --- index.html (메인 페이지)용 스크립트 ---
    const mapWrap = document.getElementById('mapWrap');
    const panel = document.getElementById('panel');
    const hot = document.getElementById('hot');
  
    if (mapWrap && panel) {
      mapWrap.addEventListener('mouseenter', ()=>panel.classList.add('show'));
      mapWrap.addEventListener('focus', ()=>panel.classList.add('show'));
      mapWrap.addEventListener('mouseleave', ()=>panel.classList.remove('show'));
      mapWrap.addEventListener('focusout', (e)=>{ 
        if(!mapWrap.contains(e.relatedTarget)) panel.classList.remove('show'); 
      });
    }
    
    // 'What's Hot?' 버튼 클릭 시 category.html로 이동
    if (hot) {
      hot.addEventListener('click', ()=> {
        window.location.href = 'category.html';
      });
    }
  
    // --- category.html (카테고리 페이지)용 스크립트 ---
    const catAttraction = document.getElementById('cat-attraction');
    
    // 'Landmarks' 버튼 클릭 시 landmark.html로 이동
    if (catAttraction) {
      catAttraction.addEventListener('click', ()=>{
        // fillAttractionList(); // <- 로직은 landmark.html에서 실행
        window.location.href = 'landmark.html';
      });
    }
  
    // --- landmark.html (목록 페이지)용 스크립트 ---
    // 페이지가 로드되면 목록을 채웁니다.
    fillAttractionList();
  
  });