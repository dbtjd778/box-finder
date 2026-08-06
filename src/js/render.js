// 결과 리스트 DOM 렌더링. 판정 로직은 여기서 다루지 않는다.

import { AXES, AXIS_LABEL, MAX_MARGIN, DIMS_ACCURACY } from './constants.js';
import { formatKRW, formatDims, formatGap, formatPack } from './format.js';

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * @param {HTMLElement} root      결과가 그려질 컨테이너
 * @param {HTMLElement} summary   결과 건수/정렬 안내 영역
 * @param {object} viewModel      { status, matches, suggestedMargin, message }
 */
export function renderResults(root, summary, viewModel) {
    root.replaceChildren();
    summary.replaceChildren();

    const { status } = viewModel;

    if (status === 'idle') {
        root.append(emptyState(
            '📏',
            viewModel.title ?? '물건 크기를 입력해 주세요',
            viewModel.message ?? '가로 · 깊이 · 높이를 mm 단위로 입력하면 그 물건이 들어가는 상자를 찾아드립니다.'
        ));
        return;
    }

    if (status === 'error') {
        root.append(emptyState('⚠️', '문제가 발생했습니다', viewModel.message));
        return;
    }

    if (status === 'empty') {
        root.append(renderNoMatch(viewModel));
        return;
    }

    const { matches } = viewModel;

    summary.append(
        el('strong', 'summary__count', `${matches.length}개`),
        el('span', 'summary__text', '· 실구매 금액 낮은 순')
    );

    const list = el('ul', 'card-list');
    matches.forEach(({ product, fit, purchase }, index) => {
        list.append(renderCard(product, fit, purchase, index === 0));
    });
    root.append(list);
}

function renderCard(product, fit, purchase, isCheapest) {
    const item = el('li', 'card');
    const body = el('div', 'card__body');

    const head = el('div', 'card__head');
    head.append(el('span', 'chip chip--seller', product.seller));
    if (isCheapest) head.append(el('span', 'chip chip--best', '최저가'));
    if (fit.swapped) head.append(el('span', 'chip chip--rotate', '↻ 회전 배치'));
    if (!product.verified) head.append(el('span', 'chip chip--unverified', '미검증 데이터'));
    body.append(head);

    body.append(el('h3', 'card__name', product.name));
    body.append(el('p', 'card__dims', `내치수 ${formatDims(fit.usedDims)}`));

    // 판정에 쓴 치수가 확실한 값인지 여기서 솔직하게 밝힌다.
    if (fit.dimsAccuracy === DIMS_ACCURACY.UNKNOWN) {
        body.append(el('p', 'card__warn',
            '⚠ 판매처가 내치수/외치수를 표기하지 않아 위 값을 내치수로 간주했습니다.'));
    } else if (fit.dimsAccuracy === DIMS_ACCURACY.CONVERTED) {
        body.append(el('p', 'card__warn',
            `외치수 표기를 벽 두께 ${product.wallThickness}mm 기준으로 환산한 값입니다.`));
    }

    // ---- 축별 여유 ----
    const gapRow = el('div', 'gap-row');
    AXES.forEach((axis) => {
        const gap = el('span', 'gap');
        if (axis === fit.tightestAxis) gap.classList.add('gap--tight');
        gap.append(
            el('span', 'gap__axis', AXIS_LABEL[axis]),
            el('span', 'gap__value', formatGap(fit.gaps[axis]))
        );
        gapRow.append(gap);
    });
    body.append(gapRow);

    body.append(renderPrice(product, purchase));

    const link = el('a', 'card__link', `${product.seller}에서 확인하기 ↗`);
    link.href = product.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    body.append(link);

    item.append(body);
    return item;
}

/**
 * 총 지불액을 크게 보여주고, 그 금액이 어떻게 나온 건지를 아래에 풀어 쓴다.
 * 묶음 때문에 남는 수량이 생기면 그걸 숨기지 않는 것이 이 블록의 핵심이다.
 */
function renderPrice(product, purchase) {
    const { quantity, packsNeeded, surplus, totalPrice, effectiveUnitPrice } = purchase;
    const wrap = el('div', 'card__price');

    wrap.append(el('strong', 'price__total', formatKRW(totalPrice)));

    if (quantity > 1) {
        wrap.append(el('span', 'price__per', `${quantity}개 기준`));
        wrap.append(el('span', 'price__meta', `개당 ${formatKRW(effectiveUnitPrice)} 꼴`));
    } else if (product.packQty > 1) {
        wrap.append(el('span', 'price__meta', `개당 ${formatKRW(product.unitPrice)} 꼴`));
    }

    const pack = formatPack(product.packQty, product.packPrice);
    if (pack) {
        const detail = packsNeeded > 1 ? `${pack} × ${packsNeeded}세트` : pack;
        wrap.append(el('span', 'price__pack', detail));
    }

    if (purchase.shipping > 0) {
        wrap.append(el('span', 'price__pack',
            `상품 ${formatKRW(purchase.goodsTotal)} + 배송비 ${formatKRW(purchase.shipping)}`));
    }

    if (surplus > 0) {
        wrap.append(el('span', 'price__surplus', `⚠ ${surplus}개가 남습니다`));
    }

    return wrap;
}

function renderNoMatch({ suggestedMargin }) {
    const wrap = el('div', 'empty');
    wrap.append(el('div', 'empty__icon', '🔍'));
    wrap.append(el('h2', 'empty__title', '조건에 맞는 상자가 없습니다'));
    wrap.append(el('p', 'empty__desc',
        '입력하신 물건보다 크면서 여유 범위 안에 드는 상자가 없습니다.'));

    if (suggestedMargin === null) {
        wrap.append(el('p', 'empty__hint', '여유를 늘려도 맞는 상자가 없습니다. 규격을 다시 확인해 주세요.'));
        return wrap;
    }

    if (suggestedMargin > MAX_MARGIN) {
        wrap.append(el('p', 'empty__hint', `가장 근접한 상자도 ${suggestedMargin}mm 여유가 필요합니다. (슬라이더 최대 ${MAX_MARGIN}mm)`));
        return wrap;
    }

    const hint = el('p', 'empty__hint');
    hint.append(document.createTextNode('여유를 '));
    const button = el('button', 'link-btn', `${suggestedMargin}mm`);
    button.type = 'button';
    button.dataset.action = 'apply-margin';
    button.dataset.margin = String(suggestedMargin);
    hint.append(button, document.createTextNode('로 늘리면 결과가 나옵니다.'));
    wrap.append(hint);

    return wrap;
}

function emptyState(icon, title, desc) {
    const wrap = el('div', 'empty');
    wrap.append(el('div', 'empty__icon', icon));
    wrap.append(el('h2', 'empty__title', title));
    wrap.append(el('p', 'empty__desc', desc));
    return wrap;
}
