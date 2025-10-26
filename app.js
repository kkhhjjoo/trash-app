// Leaflet 지도 초기화
const map = L.map('map').setView([37.5665, 126.978], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const listElem = document.getElementById('trashList');
const findMeBtn = document.getElementById('findMeBtn');

// 공공데이터 API 설정 (실제 API 사용 시)
const USE_API = false; // 🎯 data.json 파일 사용
const SERVICE_KEY =
  'b0439d73407d26dac75e4d5f7f3669ea98ed6c0abe72e74ddb8386ba9b9a6fe9';
const API_BASE_URL =
  'https://api.odcloud.kr/api/15087862/v1/uddi:9e872fe1-0af7-4c8d-a3a9-9c360f496a3a';

// API URL 생성 함수
function getAPIUrl(page = 1, perPage = 100) {
  return `${API_BASE_URL}?page=${page}&perPage=${perPage}&returnType=json&serviceKey=${SERVICE_KEY}`;
}

// 마커 그룹
const markerGroup = L.layerGroup().addTo(map);

// 마커 저장소 (key: 위도+경도, value: marker 객체)
const markerMap = new Map();

// 거리 계산 함수 (단위: m)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 🎯 데이터 로드 함수 (샘플 또는 API)
async function fetchTrashData(lat, lng) {
  listElem.innerHTML = '<li>📡 데이터 불러오는 중...</li>';
  markerGroup.clearLayers();

  try {
    let items;

    if (USE_API) {
      // 실제 API 호출
      console.log('🌐 API 호출 중...');
      const API_URL = getAPIUrl(1, 100);
      console.log('🔍 API URL:', API_URL);

      const res = await fetch(API_URL, {
        method: 'GET',
        mode: 'cors',
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${SERVICE_KEY}`, // 일부 API는 헤더로 인증
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      console.log('📊 받은 응답:', json);

      // 응답 구조 확인 및 데이터 추출
      if (json.data && Array.isArray(json.data)) {
        items = json.data;
        console.log('✅ 데이터 필드:', items.length, '개');
      } else if (Array.isArray(json)) {
        // 배열로 직접 반환되는 경우
        items = json;
        console.log('✅ 배열 데이터:', items.length, '개');
      } else {
        throw new Error(
          '데이터 구조가 올바르지 않습니다. 응답: ' + JSON.stringify(json)
        );
      }
    } else {
      // 🎯 data.json 파일 로드
      console.log('📂 data.json 로드 중...');
      const res = await fetch('data.json');

      if (!res.ok) {
        throw new Error(`data.json을 불러올 수 없습니다: ${res.status}`);
      }

      items = await res.json();
      console.log('✅ data.json 로드 완료:', items.length, '개');
    }

    // 내 위치 기준 반경 1km 필터링
    const nearby =
      lat && lng
        ? items.filter((i) => {
            const d = getDistance(lat, lng, i['위도'], i['경도']);
            return d < 1000;
          })
        : items;

    console.log('📍 표시할 데이터:', nearby.length, '개');
    renderMarkers(nearby);
    renderList(nearby);
  } catch (err) {
    console.error('❌ 에러 발생:', err);
    listElem.innerHTML = `<li>❌ 데이터를 불러오지 못했습니다.<br/><small>${err.message}</small></li>`;
  }
}

function renderList(items) {
  listElem.innerHTML = '';

  // items가 없거나 배열이 아닌 경우
  if (!items || !Array.isArray(items)) {
    listElem.innerHTML = '<li>데이터가 없습니다.</li>';
    return;
  }

  if (items.length === 0) {
    listElem.innerHTML = '<li>근처에 휴지통이 없습니다.</li>';
    return;
  }

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${item['설치장소명'] || '이름 없음'}</strong><br/>
      📍 ${item['소재지도로명주소'] || '주소 정보 없음'}<br/>
      🏷️ ${item['설치장소특성'] || '기타'}<br/>
      종류: ${item['수거쓰레기종류'] || item['휴지통종류'] || '일반'}
    `;

    // 클릭 이벤트 추가
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      const markerKey = `${item['위도']}_${item['경도']}`;
      const marker = markerMap.get(markerKey);

      if (marker) {
        // 지도 이동
        map.setView([item['위도'], item['경도']], 17);

        // 팝업 열기 (약간의 딜레이로 부드럽게)
        setTimeout(() => {
          marker.openPopup();
        }, 300);

        // 클릭된 항목 강조
        document.querySelectorAll('#trashList li').forEach((el) => {
          el.style.backgroundColor = '';
        });
        li.style.backgroundColor = '#fff3cd';
        setTimeout(() => {
          li.style.backgroundColor = '';
        }, 1000);
      }
    });

    listElem.appendChild(li);
  });
}

function renderMarkers(items) {
  // 마커 맵 초기화
  markerMap.clear();

  items.forEach((item) => {
    const marker = L.marker([item['위도'], item['경도']]).bindPopup(`
        <b>${item['설치장소명'] || '이름 없음'}</b><br/>
        ${item['소재지도로명주소'] || '주소 없음'}<br/>
        🏷️ ${item['설치장소특성'] || '기타'}<br/>
        종류: ${item['수거쓰레기종류'] || item['휴지통종류'] || '일반'}
      `);
    markerGroup.addLayer(marker);

    // 마커 저장 (리스트 클릭 시 찾기 위해)
    const markerKey = `${item['위도']}_${item['경도']}`;
    markerMap.set(markerKey, marker);
  });
}

// 내 위치 버튼 클릭
findMeBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('위치 서비스를 지원하지 않습니다.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 15);
      L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup('📍 현재 위치')
        .openPopup();
      fetchTrashData(latitude, longitude);
    },
    () => alert('위치 정보를 가져올 수 없습니다.')
  );
});

// 초기 로드 시 실행
fetchTrashData();
