// 표시용 포맷 함수 모음. 통화 단위는 원(KRW) 고정.

const krw = new Intl.NumberFormat('ko-KR');

/** 12900 → "12,900원" */
export function formatKRW(value) {
    return `${krw.format(Math.round(value))}원`;
}

/** {w:340,d:250,h:210} → "340 × 250 × 210mm" */
export function formatDims({ w, d, h }) {
    return `${krw.format(w)} × ${krw.format(d)} × ${krw.format(h)}mm`;
}

/** 0 → "딱 맞음", 12 → "+12mm" */
export function formatGap(mm) {
    if (mm === 0) return '딱 맞음';
    return `+${krw.format(mm)}mm`;
}

/** 묶음 구성 문구. 낱개면 null을 반환해 UI에서 생략한다. */
export function formatPack(packQty, packPrice) {
    if (packQty <= 1) return null;
    return `${krw.format(packQty)}개 묶음 ${formatKRW(packPrice)}`;
}
