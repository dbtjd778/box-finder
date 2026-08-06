// 상수 정의 — 매직 스트링이 코드 곳곳에 흩어지는 것을 방지한다.

// 상품 데이터에 적힌 규격이 '무엇'을 잰 값인가.
// 판매처가 표기를 안 하는 경우가 대단히 흔하므로 unknown을 1급 상태로 둔다.
export const DIMS_BASIS = {
    INNER: 'inner',
    OUTER: 'outer',
    UNKNOWN: 'unknown',
};

// 판정에 쓴 치수의 신뢰도
export const DIMS_ACCURACY = {
    EXACT: 'exact',          // 판매처가 내치수로 표기 → 그대로 사용
    CONVERTED: 'converted',  // 외치수 표기라 벽 두께로 환산
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

export const DEFAULT_QTY = 1;       // 기본 필요 수량 (개)
export const MAX_QTY = 999;         // 입력 가능한 최대 수량 (개)
