// 검색 조건을 URL 쿼리에 싣고 되읽는다.
// 새로고침해도 입력값이 남고, 링크를 그대로 공유할 수 있다.
//
// 예) ?w=300&d=200&h=140&m=30&q=5&r=1

import { AXES, MAX_MARGIN, MAX_INPUT_MM, MAX_QTY } from './constants.js';

const PARAM = {
    margin: 'm',
    quantity: 'q',
    allowSwapWD: 'r',
};

/** 정수로 파싱하고 범위를 벗어나면 null. URL 값은 어떤 쓰레기가 들어와도 이상하지 않다. */
function parseInt_(raw, min, max) {
    if (raw === null) return null;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) return null;
    return value;
}

/**
 * 현재 URL에서 복원 가능한 상태를 읽는다.
 * 유효하지 않은 값은 조용히 버리고 기본값을 쓰게 둔다.
 *
 * @returns {{patch:object, size:object|null}}
 *   patch — state에 덮어쓸 부분 (없으면 빈 객체)
 *   size  — 세 축이 모두 유효할 때만 채워지고, 아니면 null
 */
export function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const patch = {};

    const margin = parseInt_(params.get(PARAM.margin), 0, MAX_MARGIN);
    if (margin !== null) patch.margin = margin;

    const quantity = parseInt_(params.get(PARAM.quantity), 1, MAX_QTY);
    if (quantity !== null) patch.quantity = quantity;

    const rotate = params.get(PARAM.allowSwapWD);
    if (rotate === '0' || rotate === '1') patch.allowSwapWD = rotate === '1';

    // 규격은 세 축이 전부 유효할 때만 복원한다. 하나라도 빠지면 의미가 없다.
    const size = {};
    for (const axis of AXES) {
        const value = parseInt_(params.get(axis), 1, MAX_INPUT_MM);
        if (value === null) return { patch, size: null };
        size[axis] = value;
    }

    return { patch, size };
}

/** 공유용 절대 URL 문자열을 만든다. */
export function buildShareUrl(state, size) {
    const params = new URLSearchParams();
    for (const axis of AXES) params.set(axis, String(size[axis]));
    params.set(PARAM.margin, String(state.margin));
    params.set(PARAM.quantity, String(state.quantity));
    params.set(PARAM.allowSwapWD, state.allowSwapWD ? '1' : '0');

    const { origin, pathname } = window.location;
    return `${origin}${pathname}?${params}`;
}

/**
 * 주소창만 갱신한다. pushState가 아니라 replaceState인 이유는
 * 슬라이더를 한 번 움직일 때마다 뒤로가기 기록이 쌓이면 못 쓰기 때문이다.
 */
export function writeStateToUrl(state, size) {
    window.history.replaceState(null, '', buildShareUrl(state, size));
}

/** 규격이 아직 유효하지 않을 때 쿼리를 걷어낸다. */
export function clearUrlState() {
    if (!window.location.search) return;
    const { origin, pathname } = window.location;
    window.history.replaceState(null, '', `${origin}${pathname}`);
}
