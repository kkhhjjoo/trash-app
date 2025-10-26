const fs = require('fs');

// data.json 읽기
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const items = data.데이터;

console.log(`총 ${items.length}개 항목 처리 시작...`);

// 이미 위도/경도가 있는 항목 확인
let processedCount = 0;
let skippedCount = 0;

// 지오코딩 함수
async function geocodeAddress(address, district) {
  try {
    const fullAddress = `서울 ${district} ${address}`;
    const encodedAddress = encodeURIComponent(fullAddress);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&countrycodes=kr`,
      {
        headers: {
          'User-Agent': 'TrashBinMap/1.0',
        },
      }
    );

    const result = await response.json();
    if (result && result.length > 0) {
      return {
        위도: parseFloat(result[0].lat),
        경도: parseFloat(result[0].lon),
      };
    }
  } catch (err) {
    console.error(`지오코딩 실패: ${address}`, err.message);
  }
  return null;
}

// 각 항목에 대해 처리
async function processItems() {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 이미 위도/경도가 있으면 스킵
    if (item['위도'] && item['경도']) {
      skippedCount++;
      if (skippedCount % 100 === 0) {
        console.log(`⏩ ${skippedCount}개 항목 스킵됨 (이미 좌표 있음)`);
      }
      continue;
    }

    const district = item['자치구명'] || '';
    const address = item['설치위치(도로명 주소)'] || '';

    if (!address) {
      console.log(`⚠️ 주소 없음: ${i + 1}번 항목`);
      continue;
    }

    console.log(`${i + 1}/${items.length} 지오코딩 중: ${address}`);

    const coords = await geocodeAddress(address, district);
    if (coords) {
      item['위도'] = coords.위도;
      item['경도'] = coords.경도;
      processedCount++;
      console.log(`✅ ${i + 1}번 완료: ${coords.위도}, ${coords.경도}`);
    }

    // API 요청 간격 (1초)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 50개마다 저장
    if (processedCount % 50 === 0) {
      console.log(`💾 중간 저장 중... (${processedCount}개 완료)`);
      fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
    }
  }

  // 최종 저장
  console.log(`💾 최종 저장 중...`);
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

  console.log(`\n✅ 완료!`);
  console.log(`처리된 항목: ${processedCount}개`);
  console.log(`스킵된 항목: ${skippedCount}개`);
}

processItems().catch(console.error);
