// 실제로 얼마를 내야 하는지 계산한다.
//
// 개당 단가만 비교하면 오답이 나온다. 박스포유 439번은 개당 121원이지만
// 176개 묶음(21,363원)이 최소 구매 단위라, 5개만 필요한 사람에게는
// 개당 1,100원짜리 우체국 3호(5개 5,500원)가 4배 가까이 싸다.
// 그래서 랭킹 기준은 개당 단가가 아니라 '이번에 실제로 나가는 돈'이어야 한다.

// 배송비도 같은 이유로 포함한다. 낱개 60원짜리 박스에 배송비 2,800원이 붙으면
// 개당 800원짜리 무료배송 상품보다 훨씬 비싸다.

import { DEFAULT_QTY } from './constants.js?v=3';

/**
 * 배송비를 구한다. freeShippingOver가 있으면 상품가 합계로 무료 여부를 판단한다.
 */
function calcShipping(product, goodsTotal) {
    const fee = Number(product.shippingFee) || 0;
    if (fee === 0) return 0;

    const threshold = Number(product.freeShippingOver) || 0;
    if (threshold > 0 && goodsTotal >= threshold) return 0;

    return fee;
}

/**
 * @param {object} product  packQty / packPrice / shippingFee 등을 가진 상품
 * @param {number} quantity 사용자가 필요한 개수
 * @returns {{quantity:number, packsNeeded:number, actualQty:number, surplus:number,
 *            goodsTotal:number, shipping:number, totalPrice:number,
 *            effectiveUnitPrice:number}}
 */
export function calcPurchase(product, quantity = DEFAULT_QTY) {
    const qty = Math.max(1, Math.floor(Number(quantity)) || DEFAULT_QTY);
    const packQty = Math.max(1, product.packQty || 1);

    // 묶음은 쪼개 살 수 없으므로 항상 올림.
    const packsNeeded = Math.ceil(qty / packQty);
    const actualQty = packsNeeded * packQty;
    const goodsTotal = packsNeeded * product.packPrice;
    const shipping = calcShipping(product, goodsTotal);
    const totalPrice = goodsTotal + shipping;

    return {
        quantity: qty,
        packsNeeded,
        actualQty,
        surplus: actualQty - qty,          // 쓰지도 않는데 딸려오는 개수
        goodsTotal,
        shipping,
        totalPrice,                        // 배송비까지 포함해 실제로 나가는 돈
        effectiveUnitPrice: Math.round(totalPrice / qty), // 필요 개수로 나눈 체감 단가
    };
}
