// 규격 비교·판정 엔진.
// DOM에 전혀 의존하지 않는 순수 함수만 둔다. (테스트 용이 / 추후 서버 이식 가능)
//
// 판정 규칙은 하나뿐이다: 넣을 물건보다 상자가 크거나 같아야 한다.
//   gap = 상자 내치수 - 물건 치수
//   gap < 0       → 안 들어감
//   gap > margin  → 들어가긴 하지만 사용자가 정한 여유를 초과

import { AXES, DEFAULT_MARGIN, DIMS_BASIS, DIMS_ACCURACY } from './constants.js';
import { calcPurchase } from './pricing.js';

/**
 * 물건이 들어갈 '안쪽 치수'를 구한다.
 *
 * 판매처가 외치수로 표기했으면 벽 두께만큼 깎고, 표기 기준을 모르면(unknown)
 * 값을 그대로 쓰되 신뢰도를 낮춰 UI에 밝힌다.
 * 조용히 추정해서 맞는 척하지 않는 것이 이 함수의 목적이다.
 */
function resolveInnerDims(product) {
    const { dims, dimsBasis = DIMS_BASIS.UNKNOWN, wallThickness = 3 } = product;

    if (dimsBasis === DIMS_BASIS.INNER) {
        return { dims, accuracy: DIMS_ACCURACY.EXACT };
    }
    if (dimsBasis === DIMS_BASIS.UNKNOWN) {
        return { dims, accuracy: DIMS_ACCURACY.UNKNOWN };
    }

    // 외치수 표기 → 가로/깊이는 양쪽 벽, 높이는 바닥 한 면만 차감.
    return {
        dims: {
            w: dims.w - wallThickness * 2,
            d: dims.d - wallThickness * 2,
            h: dims.h - wallThickness,
        },
        accuracy: DIMS_ACCURACY.CONVERTED,
    };
}

/** margin을 숫자 하나로 받든 축별 객체로 받든 {w,d,h} 형태로 정규화 */
function normalizeMargin(margin) {
    if (typeof margin === 'number') {
        return { w: margin, d: margin, h: margin };
    }
    return { w: DEFAULT_MARGIN, d: DEFAULT_MARGIN, h: DEFAULT_MARGIN, ...margin };
}

/**
 * 단일 상품의 적합 여부를 판정한다.
 *
 * @param {object} product
 * @param {object} input
 *   @param {{w:number,d:number,h:number}} input.size   넣을 물건 규격 (mm)
 *   @param {number|object} [input.margin=30]           여유 허용치 (mm)
 *   @param {boolean} [input.allowSwapWD=true]          가로/깊이 90° 회전 허용
 * @returns {{fits:boolean, gaps:object, failedAxes:string[], totalGap:number,
 *            tightestAxis:string, requiredMargin:number, swapped:boolean,
 *            dimsAccuracy:string, usedDims:object}}
 */
export function evaluateFit(product, input) {
    const { size, margin = DEFAULT_MARGIN, allowSwapWD = true } = input;

    const limit = normalizeMargin(margin);
    const { dims, accuracy } = resolveInnerDims(product);

    // 높이(h)는 세워두는 방향이 정해져 있으므로 회전 대상에서 제외하고,
    // 평면상 가로/깊이만 90° 돌려본다.
    const orientations = [
        { swapped: false, dims: { w: dims.w, d: dims.d, h: dims.h } },
    ];
    if (allowSwapWD && dims.w !== dims.d) {
        orientations.push({
            swapped: true,
            dims: { w: dims.d, d: dims.w, h: dims.h },
        });
    }

    let best = null;

    for (const orientation of orientations) {
        const gaps = {};
        const failedAxes = [];

        for (const axis of AXES) {
            const gap = orientation.dims[axis] - size[axis];
            gaps[axis] = gap;
            if (gap < 0 || gap > limit[axis]) failedAxes.push(axis);
        }

        const gapValues = AXES.map((axis) => gaps[axis]);
        const totalGap = gapValues.reduce((sum, gap) => sum + gap, 0);

        // 가장 여유가 적은 축 = 가장 아슬아슬한 지점 (UI에 "높이 5mm 여유"로 노출)
        const tightestAxis = AXES.reduce(
            (tight, axis) => (gaps[axis] < gaps[tight] ? axis : tight),
            AXES[0]
        );

        // 이 상품이 통과하려면 필요한 최소 여유치.
        // 음수 gap이 하나라도 있으면 여유를 아무리 늘려도 물리적으로 불가능.
        const physicallyPossible = gapValues.every((gap) => gap >= 0);
        const requiredMargin = physicallyPossible ? Math.max(...gapValues) : Infinity;

        const candidate = {
            fits: failedAxes.length === 0,
            gaps,
            failedAxes,
            totalGap,
            tightestAxis,
            requiredMargin,
            swapped: orientation.swapped,
            dimsAccuracy: accuracy,
            usedDims: orientation.dims,
        };

        if (!best) {
            best = candidate;
        } else if (candidate.fits !== best.fits) {
            if (candidate.fits) best = candidate;    // 통과한 방향 우선
        } else if (candidate.requiredMargin < best.requiredMargin) {
            // 방향 비교의 기준은 totalGap이 아니라 requiredMargin(= 가장 큰 축 여유)이다.
            // 가로/깊이를 맞바꿔도 세 축의 합은 항상 같으므로 totalGap으로는 두 방향을
            // 구분할 수 없고, 항상 첫 번째 방향이 채택되어 버린다.
            best = candidate;
        }
    }

    return best;
}

/**
 * 적합도 판정 → 실구매 금액 최저순 정렬.
 *
 * 정렬 기준이 개당 단가가 아니라 총 지불액인 이유는 pricing.js 주석 참고.
 * @returns {Array<{product:object, fit:object, purchase:object}>}
 */
export function findMatchingProducts(products, input) {
    return products
        .map((product) => ({ product, fit: evaluateFit(product, input) }))
        .filter(({ fit }) => fit.fits)
        .map((match) => ({
            ...match,
            purchase: calcPurchase(match.product, input.quantity),
        }))
        .sort((a, b) => {
            // 1순위: 이번에 실제로 나가는 돈 (배송비 포함)
            const priceDiff = a.purchase.totalPrice - b.purchase.totalPrice;
            if (priceDiff !== 0) return priceDiff;
            // 2순위: 금액이 같으면 남는 수량이 적은 쪽
            const surplusDiff = a.purchase.surplus - b.purchase.surplus;
            if (surplusDiff !== 0) return surplusDiff;
            // 3순위: 더 딱 맞는(여유가 적은) 상품을 위로
            return a.fit.totalGap - b.fit.totalGap;
        });
}

/**
 * 결과가 0건일 때 "여유를 몇 mm로 늘리면 결과가 나오는지"를 계산한다.
 * 어떤 값으로도 불가능하면 null.
 */
export function suggestMinimumMargin(products, input) {
    const required = products
        .map((product) => evaluateFit(product, { ...input, margin: Infinity }).requiredMargin)
        .filter((value) => Number.isFinite(value));

    if (required.length === 0) return null;
    return Math.min(...required);
}
