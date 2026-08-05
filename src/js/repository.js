// 데이터 접근 계층.
// 지금은 로컬 JSON을 읽지만, 실제 판매처 API/크롤링으로 바뀌어도 이 파일만 교체하면 된다.

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
    const packPrice = Number(product.packPrice) || 0;

    return {
        ...product,
        packQty,
        packPrice,
        // unitPrice가 누락되면 묶음가에서 역산한다.
        unitPrice: Number(product.unitPrice) || Math.round(packPrice / packQty),
        wallThickness: Number(product.wallThickness) || 3,
        inner: product.inner ?? null,
    };
}
