// Leaflet 지도 초기화
const map = L.map('map').setView([37.5665, 126.978], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const listElem = document.getElementById('trashList');
const findMeBtn = document.getElementById('findMeBtn');

// 🎯 샘플 데이터 (테스트용)
const SAMPLE_DATA = [
  {
    설치장소명: '올림픽공원 정문',
    소재지도로명주소: '서울 송파구 올림픽로 240',
    휴지통종류: '재활용휴지통',
    위도: 37.5176,
    경도: 127.1229,
  },
  {
    설치장소명: '잠실역 1번 출구',
    소재지도로명주소: '서울 송파구 올림픽로 300',
    휴지통종류: '일반휴지통',
    위도: 37.5133,
    경도: 127.1018,
  },
  {
    설치장소명: '한강공원 송파지구',
    소재지도로명주소: '서울 송파구 잠실동',
    휴지통종류: '재활용휴지통',
    위도: 37.5101,
    경도: 127.1072,
  },
  {
    설치장소명: '석촌호수공원',
    소재지도로명주소: '서울 송파구 석촌동',
    휴지통종류: '일반휴지통',
    위도: 37.5056,
    경도: 127.0965,
  },
  {
    설치장소명: '마천역 3번 출구',
    소재지도로명주소: '서울 송파구 마천동',
    휴지통종류: '일반휴지통',
    위도: 37.4965,
    경도: 127.1528,
  },
  {
    설치장소명: '문정역 1번 출구',
    소재지도로명주소: '서울 송파구 문정동',
    휴지통종류: '재활용휴지통',
    위도: 37.4853,
    경도: 127.1214,
  },
];

// 공공데이터 API 설정 (실제 API 사용 시)
const USE_API = false; // 🎯 샘플 데이터 사용: true로 변경하면 API 사용
const SERVICE_KEY =
  'b0439d73407d26dac75e4d5f7f3669ea98ed6c0abe72e74ddb8386ba9b9a6fe9';
const API_BASE_URL =
  'https://api.odcloud.kr/api/15018012/v1/uddi:d188c96d-0c7f-4848-ad32-949efe4c20d3_201908231505';

// API URL 생성 함수
function getAPIUrl(page = 1, perPage = 10) {
  return `${API_BASE_URL}?page=${page}&perPage=${perPage}&serviceKey=${SERVICE_KEY}`;
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
      const API_URL = getAPIUrl(1, 1000);
      console.log('🔍 API URL:', API_URL);

      const res = await fetch(API_URL, {
        method: 'GET',
        mode: 'cors',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();

      if (!json.data || !Array.isArray(json.data)) {
        throw new Error('데이터가 올바르지 않습니다.');
      }

      items = json.data;
    } else {
      // 🎯 샘플 데이터 사용
      console.log('🎨 샘플 데이터 사용 중...');
      await new Promise((resolve) => setTimeout(resolve, 500)); // 로딩 효과
      items = SAMPLE_DATA;
      console.log('📦 샘플 데이터:', items.length, '개');
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
      종류: ${item['휴지통종류'] || '일반'}
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
        종류: ${item['휴지통종류'] || '일반'}
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
