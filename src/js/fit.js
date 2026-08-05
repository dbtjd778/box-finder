// 규격 비교·판정 엔진.
// DOM에 전혀 의존하지 않는 순수 함수만 둔다. (테스트 용이 / 추후 서버 이식 가능)

import { MEASURE_TARGET, AXES, DEFAULT_MARGIN } from './constants.js';

/**
 * 내치수(inner)가 없는 상품의 내치수를 벽 두께로 추정한다.
 * 가로/깊이는 양쪽 벽을, 높이는 바닥 한 면만 차감한다(뚜껑 없는 오픈형 기준).
 */
function estimateInner({ outer, wallThickness = 3 }) {
    return {
        w: outer.w - wallThickness * 2,
        d: outer.d - wallThickness * 2,
        h: outer.h - wallThickness,
    };
}

/**
 * 측정 기준에 따라 '비교에 사용할 상품 치수'를 고른다.
 *
 *  - 옵션 A(물건을 쟀다) : 물건이 상자 "안"에 들어가야 하므로 내치수로 비교
 *  - 옵션 B(공간을 쟀다) : 상자가 선반 "안"에 들어가야 하므로 외치수로 비교
 */
function pickComparableDims(product, measureTarget) {
    if (measureTarget === MEASURE_TARGET.SPACE) {
        return { dims: product.outer, estimated: false };
    }
    if (product.inner) {
        return { dims: product.inner, estimated: false };
    }
    return { dims: estimateInner(product), estimated: true };
}

/** margin을 숫자 하나로 받든 축별 객체로 받든 {w,d,h} 형태로 정규화 */
function normalizeMargin(margin) {
    if (typeof margin === 'number') {
        return { w: margin, d: margin, h: margin };
    }
    return { w: DEFAULT_MARGIN, d: DEFAULT_MARGIN, h: DEFAULT_MARGIN, ...margin };
}

/**
 * ★ 부호 스위칭이 일어나는 유일한 지점 ★
 *
 * gap을 "남는 여유 공간(mm)"으로 정의하면 A/B 모두 판정식이 0 <= gap <= margin 으로 통일된다.
 *
 *   옵션 A : gap = 상품(내치수) - 물건   → 상품이 커야 하므로 (상품 - 입력)
 *   옵션 B : gap = 공간 - 상품(외치수)   → 상품이 작아야 하므로 (입력 - 상품)
 *
 * gap < 0       → 안 들어감 (불합격)
 * gap > margin  → 들어가긴 하나 사용자가 정한 여유를 초과 (불합격)
 */
function calcGap(productSize, inputSize, measureTarget) {
    return measureTarget === MEASURE_TARGET.ITEM
        ? productSize - inputSize
        : inputSize - productSize;
}

/**
 * 단일 상품의 적합 여부를 판정한다.
 *
 * @param {object} product
 * @param {object} input
 *   @param {{w:number,d:number,h:number}} input.size   사용자 입력 규격 (mm)
 *   @param {string}  input.measureTarget               MEASURE_TARGET.ITEM | SPACE
 *   @param {number|object} [input.margin=30]           여유 허용치 (mm)
 *   @param {boolean} [input.allowSwapWD=true]          가로/깊이 90° 회전 허용
 * @returns {{fits:boolean, gaps:object, failedAxes:string[], totalGap:number,
 *            tightestAxis:string, requiredMargin:number, swapped:boolean,
 *            dimsEstimated:boolean, usedDims:object}}
 */
export function evaluateFit(product, input) {
    const {
        size,
        measureTarget,
        margin = DEFAULT_MARGIN,
        allowSwapWD = true,
    } = input;

    const limit = normalizeMargin(margin);
    const { dims, estimated } = pickComparableDims(product, measureTarget);

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
            const gap = calcGap(orientation.dims[axis], size[axis], measureTarget);
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
            dimsEstimated: estimated,
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
 * 카테고리 필터 → 적합도 판정 → 개당 단가 최저가순 정렬.
 * @returns {Array<{product:object, fit:object}>}
 */
export function findMatchingProducts(products, input) {
    return products
        .filter((product) => product.category === input.category)
        .map((product) => ({ product, fit: evaluateFit(product, input) }))
        .filter(({ fit }) => fit.fits)
        .sort((a, b) => {
            // 1순위: 개당 단가 오름차순
            const priceDiff = a.product.unitPrice - b.product.unitPrice;
            if (priceDiff !== 0) return priceDiff;
            // 2순위: 단가가 같으면 더 딱 맞는(여유가 적은) 상품을 위로
            return a.fit.totalGap - b.fit.totalGap;
        });
}

/**
 * 결과가 0건일 때 "여유를 몇 mm로 늘리면 결과가 나오는지"를 계산한다.
 * 어떤 값으로도 불가능하면 null.
 */
export function suggestMinimumMargin(products, input) {
    const required = products
        .filter((product) => product.category === input.category)
        .map((product) => evaluateFit(product, { ...input, margin: Infinity }).requiredMargin)
        .filter((value) => Number.isFinite(value));

    if (required.length === 0) return null;
    return Math.min(...required);
}
