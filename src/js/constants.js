// 상수 정의 — 매직 스트링이 코드 곳곳에 흩어지는 것을 방지한다.

export const CATEGORY = {
    PARCEL: 'parcel',    // 택배/포장 상자
    STORAGE: 'storage',  // 수납함/리빙박스
};

export const CATEGORY_LABEL = {
    [CATEGORY.PARCEL]: '택배/포장 상자',
    [CATEGORY.STORAGE]: '수납함/리빙박스',
};

// 사용자가 '무엇의' 크기를 측정했는가
export const MEASURE_TARGET = {
    ITEM: 'item',    // 옵션 A: 넣을 물건을 쟀다  → 상품이 물건보다 크거나 같아야 함
    SPACE: 'space',  // 옵션 B: 들어갈 공간을 쟀다 → 상품이 공간보다 작거나 같아야 함
};

// 상품 데이터에 적힌 규격이 '무엇'을 잰 값인가.
// 판매처가 표기를 안 하는 경우가 대단히 흔하므로 unknown을 1급 상태로 둔다.
export const DIMS_BASIS = {
    INNER: 'inner',
    OUTER: 'outer',
    UNKNOWN: 'unknown',
};

// 판정에 쓴 치수의 신뢰도
export const DIMS_ACCURACY = {
    EXACT: 'exact',          // 필요한 기준과 표기 기준이 일치
    CONVERTED: 'converted',  // 반대 기준이라 벽 두께로 환산
    UNKNOWN: 'unknown',      // 표기 기준 자체가 불명
};

export const AXES = ['w', 'd', 'h'];

export const AXIS_LABEL = {
    w: '가로',
    d: '깊이',
    h: '높이',
};

export const DEFAULT_MARGIN = 30;   // 기본 여유 허용치 (mm)
export const MAX_MARGIN = 100;      // 슬라이더 상한 (mm)
export const MAX_INPUT_MM = 2000;   // 입력 가능한 최대 치수 (mm)
