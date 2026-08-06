// 데이터 접근 계층.
// 지금은 로컬 JSON을 읽지만, 실제 판매처 API/크롤링으로 바뀌어도 이 파일만 교체하면 된다.

import { DIMS_BASIS } from './constants.js';

const DATA_URL = './data/products.json';

let cache = null;

export async function loadProducts() {
    if (cache) return cache;

    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!res.ok) {
        throw new Error(`상품 데이터를 불러오지 못했습니다. (HTTP ${res.status})`);
    }

    const raw = await res.json();
    cache = raw.map(normalize);
    return cache;
}

/** 데이터 결손을 여기서 한 번에 방어한다. 렌더/판정 코드가 undefined를 신경 쓰지 않도록. */
function normalize(product) {
    const packQty = Number(product.packQty) || 1;
    // 묶음가와 개당 단가 중 하나만 있어도 나머지를 채운다.
    const unitPrice = Number(product.unitPrice) || 0;
    const packPrice = Number(product.packPrice) || unitPrice * packQty;

    return {
        ...product,
        packQty,
        packPrice,
        unitPrice: unitPrice || Math.round(packPrice / packQty),
        wallThickness: Number(product.wallThickness) || 3,
        // 표기 기준과 검증 여부는 누락 시 "모른다"가 안전한 기본값이다.
        dimsBasis: product.dimsBasis ?? DIMS_BASIS.UNKNOWN,
        verified: product.verified === true,
    };
}
