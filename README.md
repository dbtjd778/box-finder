# 딱맞는박스 (box-finder)

가로·깊이·높이만 입력하면 조건에 맞는 **국내 택배상자·수납함**을 개당 단가 순으로 비교해 주는 웹서비스. 현재 MVP 단계.

## 핵심 기획 포인트 — 측정 기준에 따른 양방향 필터링

사용자가 **무엇을 쟀는지**에 따라 필터 조건이 정반대로 뒤집힌다.

| 옵션 | 측정 대상 | 조건 | 비교 기준 치수 |
|---|---|---|---|
| A (기본) | 넣을 물건 | 상자가 물건보다 **크거나 같아야** 함 | 상품 **내치수** |
| B | 들어갈 선반/공간 | 수납함이 공간보다 **작거나 같아야** 함 | 상품 **외치수** |

구현에서는 분기를 두 벌 만들지 않고, `gap`("남는 여유 공간 mm")을 아래처럼 정의해 판정식을 하나로 통일했다.

- 옵션 A: `gap = 상품 내치수 - 입력값`
- 옵션 B: `gap = 입력값 - 상품 외치수`

이후 조건은 양쪽 모두 **`0 ≤ gap ≤ 허용 여유`** 한 줄. 부호 스위칭은 `fit.js`의 `calcGap()` 한 곳에만 존재한다.

## 실행

번들러·의존성 없는 순수 ES 모듈 구조라 설치 과정이 없다.
단, ES 모듈이므로 `index.html`을 더블클릭(`file://`)하면 CORS로 막힌다. **로컬 서버가 필요하다.**

VS Code 확장 [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)를 설치하고 `index.html` 우클릭 → *Open with Live Server*.

또는 로컬에 런타임이 있다면:

```bash
python -m http.server 8792
# http://localhost:8792/index.html
```

## 폴더 구조

```
box-finder/
├─ index.html                  # 단일 페이지 마크업
├─ assets/
│  ├─ css/style.css            # 모바일 퍼스트 (640px / 960px 확장), 다크모드 대응
│  └─ img/products/            # 상품 썸네일 (없으면 placeholder.svg로 폴백)
├─ data/products.json          # 더미 상품 데이터
└─ src/js/
   ├─ main.js                  # 진입점. 상태 관리 + 이벤트 바인딩
   ├─ constants.js             # CATEGORY / MEASURE_TARGET 등 상수
   ├─ fit.js                   # ★ 규격 판정 엔진 (순수 함수, DOM 의존 없음)
   ├─ repository.js            # 데이터 접근 계층 (추후 실제 API로 교체될 자리)
   ├─ format.js                # 원화·치수 포맷
   └─ render.js                # 결과 카드 DOM 생성
```

## 데이터 스키마

| 필드 | 설명 |
|---|---|
| `category` | `"parcel"`(택배/포장) \| `"storage"`(수납함/리빙박스) |
| `outer` / `inner` | 외치수 / 내치수 `{w,d,h}` (mm). `inner`가 `null`이면 `wallThickness`로 추정하고 UI에 "내치수 추정" 뱃지 표시 |
| `packQty` / `packPrice` / `unitPrice` | 묶음 수량 / 묶음 가격 / 개당 단가 (KRW) |
| `seller` / `url` | 국내 판매처명 / 구매 링크 |

## ⚠️ 현재 데이터는 더미다

`data/products.json`의 규격·가격·링크는 **로직 검증용 임시값**이다. 서비스 공개 전 각 판매처 상세페이지에서 재수집이 필요하며, 특히 우체국 박스의 "1~5호 표기 치수가 내치수인지 외치수인지"는 판매처마다 표기가 달라 검증 대상이다.

## 남은 작업

- [ ] 실제 판매처 데이터 수집 및 검증
- [ ] 상품 썸네일 이미지 추가
- [ ] 부피/무게 기반 택배 요금 비교
- [ ] 결과 공유 링크 (URL 쿼리로 입력값 복원)
