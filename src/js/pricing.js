// 실제로 얼마를 내야 하는지 계산한다.
//
// 개당 단가만 비교하면 오답이 나온다. 박스포유 439번은 개당 121원이지만
// 176개 묶음(21,363원)이 최소 구매 단위라, 5개만 필요한 사람에게는
// 개당 1,100원짜리 우체국 3호(5개 5,500원)가 4배 가까이 싸다.
// 그래서 랭킹 기준은 개당 단가가 아니라 '이번에 실제로 나가는 돈'이어야 한다.

import { DEFAULT_QTY } from './constants.js';

/**
 * @param {object} product  packQty / packPrice / unitPrice를 가진 상품
 * @param {number} quantity 사용자가 필요한 개수
 * @returns {{quantity:number, packsNeeded:number, actualQty:number,
 *            surplus:number, totalPrice:number, effectiveUnitPrice:number}}
 */
export function calcPurchase(product, quantity = DEFAULT_QTY) {
    const qty = Math.max(1, Math.floor(Number(quantity)) || DEFAULT_QTY);
    const packQty = Math.max(1, product.packQty || 1);

    // 묶음은 쪼개 살 수 없으므로 항상 올림.
    const packsNeeded = Math.ceil(qty / packQty);
    const actualQty = packsNeeded * packQty;
    const totalPrice = packsNeeded * product.packPrice;

    return {
        quantity: qty,
        packsNeeded,
        actualQty,
        surplus: actualQty - qty,          // 쓰지도 않는데 딸려오는 개수
        totalPrice,                        // 이번에 실제로 나가는 돈
        effectiveUnitPrice: Math.round(totalPrice / qty), // 필요 개수로 나눈 체감 단가
    };
}
