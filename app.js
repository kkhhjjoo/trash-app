// Leaflet 지도 초기화
const map = L.map('map').setView([37.5665, 126.978], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const listElem = document.getElementById('trashList');
const findMeBtn = document.getElementById('findMeBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

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

// 전체 데이터 저장
let allTrashData = [];

// 주소 지오코딩 함수 (OpenStreetMap Nominatim API 사용)
async function geocodeAddress(address) {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&countrycodes=kr`,
      {
        headers: {
          'User-Agent': 'TrashBinMap/1.0',
        },
      }
    );

    const data = await response.json();
    if (data && data.length > 0) {
      return {
        위도: parseFloat(data[0].lat),
        경도: parseFloat(data[0].lon),
      };
    }
  } catch (err) {
    console.error(`지오코딩 실패: ${address}`, err);
  }
  return null;
}

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

      const json = await res.json();
      console.log('📊 data.json 원본:', json);

      // 데이터 구조 확인
      if (Array.isArray(json)) {
        items = json;
      } else if (json.data && Array.isArray(json.data)) {
        items = json.data;
      } else if (json.데이터 && Array.isArray(json.데이터)) {
        items = json.데이터;
      } else if (json.items && Array.isArray(json.items)) {
        items = json.items;
      } else {
        throw new Error(
          'data.json의 구조가 올바르지 않습니다. 배열 형식이어야 합니다.'
        );
      }

      console.log('✅ data.json 로드 완료:', items.length, '개');
    }

    // 데이터가 배열인지 확인
    if (!Array.isArray(items)) {
      throw new Error(`데이터가 배열이 아닙니다: ${typeof items}`);
    }

    // 위도/경도가 없는 항목에 대해 지오코딩 수행
    console.log('🗺️ 지오코딩 시작...');
    for (let i = 0; i < Math.min(items.length, 100); i++) {
      const item = items[i];
      if (!item['위도'] || !item['경도']) {
        const address = `서울특별시 종로구 ${item['설치위치(도로명 주소)']}`;
        console.log(`지오코딩 중: ${address}`);
        const coords = await geocodeAddress(address);
        if (coords) {
          item['위도'] = coords.위도;
          item['경도'] = coords.경도;
          console.log(
            `✅ 지오코딩 완료: 위도 ${coords.위도}, 경도 ${coords.경도}`
          );
        }
        // API 요청 간격 조절 (초당 1개)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    console.log('✅ 지오코딩 완료');

    // 전체 데이터 저장
    allTrashData = items;

    // 현재 지도 영역에 맞는 데이터 표시
    updateMapItems();
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

    // 필드명 매핑
    const name = item['세부 위치'] || item['설치장소명'] || '이름 없음';
    const district = item['자치구명'] || '';
    const address =
      item['설치위치(도로명 주소)'] ||
      item['소재지도로명주소'] ||
      '주소 정보 없음';
    const fullAddress = district ? `서울 ${district} ${address}` : address;
    const type = item['설치 장소 유형'] || item['설치장소특성'] || '기타';
    const trashType =
      item['수거 쓰레기 종류'] ||
      item['수거쓰레기종류'] ||
      item['휴지통종류'] ||
      '일반';
    const lat = item['위도'];
    const lng = item['경도'];

    li.innerHTML = `
      <strong>🏢 ${name}</strong><br/>
      📍 ${fullAddress}<br/>
      🏷️ 유형: ${type}<br/>
      🗑️ 수거종류: ${trashType}${
      lat && lng ? `<br/>📍 좌표: 위도 ${lat}, 경도 ${lng}` : ''
    }
    `;

    // 클릭 이벤트 추가 (위도/경도가 있는 경우만)
    if (lat && lng) {
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        const markerKey = `${lat}_${lng}`;
        const marker = markerMap.get(markerKey);

        if (marker) {
          // 지도 이동
          map.setView([lat, lng], 17);

          // 팝업 열기
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
    } else {
      // 위치 정보가 없어도 표시 (클릭 불가)
      li.style.opacity = '0.8';
      li.innerHTML +=
        '<br/><small style="color: #999;">📍 위치 정보 없음 - 클릭 불가</small>';
    }

    listElem.appendChild(li);
  });
}

function renderMarkers(items) {
  // 마커 맵 초기화
  markerMap.clear();

  items.forEach((item) => {
    // 필드명 매핑
    const lat = item['위도'];
    const lng = item['경도'];

    // 위도/경도가 있는 경우만 마커 생성
    if (!lat || !lng) {
      console.log('위치 정보 없음:', item);
      return;
    }

    const name = item['세부 위치'] || item['설치장소명'] || '이름 없음';
    const address =
      item['설치위치(도로명 주소)'] || item['소재지도로명주소'] || '주소 없음';
    const type = item['설치 장소 유형'] || item['설치장소특성'] || '기타';
    const trashType =
      item['수거 쓰레기 종류'] ||
      item['수거쓰레기종류'] ||
      item['휴지통종류'] ||
      '일반';

    const marker = L.marker([lat, lng]).bindPopup(`
        <b>${name}</b><br/>
        ${address}<br/>
        🏷️ ${type}<br/>
        종류: ${trashType}
      `);
    markerGroup.addLayer(marker);

    // 마커 저장 (리스트 클릭 시 찾기 위해)
    const markerKey = `${lat}_${lng}`;
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

// 지도 영역 변경 시 해당 영역의 휴지통만 표시
function updateMapItems() {
  const bounds = map.getBounds();
  const southwest = bounds.getSouthWest();
  const northeast = bounds.getNorthEast();

  console.log('🗺️ 지도 영역:', {
    남서: [southwest.lat, southwest.lng],
    북동: [northeast.lat, northeast.lng],
  });

  // 위도/경도가 있는 항목만 필터링
  const itemsWithLocation = allTrashData.filter((i) => {
    const itemLat = i['위도'];
    const itemLng = i['경도'];
    return itemLat && itemLng && !isNaN(itemLat) && !isNaN(itemLng);
  });

  console.log('📍 위치 정보 있는 항목:', itemsWithLocation.length, '개');

  // 지도 영역 내의 휴지통만 필터링
  const nearby = itemsWithLocation.filter((item) => {
    const lat = item['위도'];
    const lng = item['경도'];
    return (
      lat >= southwest.lat &&
      lat <= northeast.lat &&
      lng >= southwest.lng &&
      lng <= northeast.lng
    );
  });

  console.log('📍 지도 영역 내 휴지통:', nearby.length, '개');
  renderMarkers(nearby);
  renderList(nearby);
}

// 검색 기능
function performSearch() {
  const searchQuery = searchInput.value.trim().toLowerCase();

  if (!searchQuery) {
    // 검색어가 없으면 지도 영역 기준으로 표시
    updateMapItems();
    return;
  }

  console.log('🔍 검색어:', searchQuery);

  // 위도/경도가 있는 항목만 필터링
  const itemsWithLocation = allTrashData.filter((i) => {
    const itemLat = i['위도'];
    const itemLng = i['경도'];
    return itemLat && itemLng && !isNaN(itemLat) && !isNaN(itemLng);
  });

  // 검색 필터링 (장소명, 주소, 유형 검색)
  const searchResults = itemsWithLocation.filter((item) => {
    const name = (item['세부 위치'] || item['설치장소명'] || '').toLowerCase();
    const address = (
      item['설치위치(도로명 주소)'] ||
      item['소재지도로명주소'] ||
      ''
    ).toLowerCase();
    const district = (item['자치구명'] || '').toLowerCase();
    const type = (
      item['설치 장소 유형'] ||
      item['설치장소특성'] ||
      ''
    ).toLowerCase();
    const trashType = (
      item['수거 쓰레기 종류'] ||
      item['수거쓰레기종류'] ||
      item['휴지통종류'] ||
      ''
    ).toLowerCase();

    return (
      name.includes(searchQuery) ||
      address.includes(searchQuery) ||
      district.includes(searchQuery) ||
      type.includes(searchQuery) ||
      trashType.includes(searchQuery)
    );
  });

  console.log('📊 검색 결과:', searchResults.length, '개');
  console.log('검색 결과 샘플 (처음 3개):', searchResults.slice(0, 3));

  // 검색 결과가 있으면 지도 이동 및 표시
  if (searchResults.length > 0) {
    console.log('검색 결과 상세 (첫 번째):', searchResults[0]);
    console.log(
      '위도/경도 정보:',
      searchResults[0]['위도'],
      searchResults[0]['경도']
    );

    // 첫 번째 결과로 지도 이동 (위도/경도가 있는 경우만)
    const firstResult = searchResults[0];
    if (firstResult['위도'] && firstResult['경도']) {
      map.setView([firstResult['위도'], firstResult['경도']], 16);
    } else {
      // 위도/경도가 없으면 검색된 모든 항목을 포함하도록 지도 확대
      const bounds = searchResults
        .filter((r) => r['위도'] && r['경도'])
        .map((r) => [r['위도'], r['경도']]);

      if (bounds.length > 0) {
        map.fitBounds(bounds);
      }
    }

    // 모든 검색 결과 표시
    renderMarkers(searchResults);
    renderList(searchResults);
    console.log('✅ 검색 결과 표시 완료');
  } else {
    listElem.innerHTML = '<li>🔍 검색 결과가 없습니다.</li>';
    markerGroup.clearLayers();
  }
}

// 검색 버튼 클릭
searchBtn.addEventListener('click', performSearch);

// 엔터 키로 검색
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performSearch();
  }
});

// 지도 이동/확대 시 업데이트
map.on('moveend', () => {
  if (!searchInput.value.trim()) {
    updateMapItems();
  }
});

// 초기 로드 시 실행
fetchTrashData();
