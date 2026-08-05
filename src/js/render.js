// 결과 리스트 DOM 렌더링. 판정 로직은 여기서 다루지 않는다.

import { AXES, AXIS_LABEL, MEASURE_TARGET, MAX_MARGIN } from './constants.js';
import { formatKRW, formatDims, formatGap, formatPack } from './format.js';

const PLACEHOLDER_IMG = './assets/img/products/placeholder.svg';

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * @param {HTMLElement} root      결과가 그려질 컨테이너
 * @param {HTMLElement} summary   결과 건수/정렬 안내 영역
 * @param {object} viewModel      { status, matches, input, suggestedMargin, message }
 */
export function renderResults(root, summary, viewModel) {
    root.replaceChildren();
    summary.replaceChildren();

    const { status } = viewModel;

    if (status === 'idle') {
        root.append(emptyState('📏', '규격을 입력해 주세요', '가로 · 깊이 · 높이를 mm 단위로 입력하면 조건에 맞는 상품을 찾아드립니다.'));
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

    const { matches, input } = viewModel;

    summary.append(
        el('strong', 'summary__count', `${matches.length}개`),
        el('span', 'summary__text', '· 개당 단가 낮은 순')
    );

    const list = el('ul', 'card-list');
    matches.forEach(({ product, fit }, index) => {
        list.append(renderCard(product, fit, input, index === 0));
    });
    root.append(list);
}

function renderCard(product, fit, input, isCheapest) {
    const item = el('li', 'card');

    // ---- 썸네일 ----
    const thumb = el('div', 'card__thumb');
    const img = document.createElement('img');
    img.src = product.imageUrl || PLACEHOLDER_IMG;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => { img.src = PLACEHOLDER_IMG; }, { once: true });
    thumb.append(img);

    // ---- 본문 ----
    const body = el('div', 'card__body');

    const head = el('div', 'card__head');
    head.append(el('span', 'chip chip--seller', product.seller));
    if (isCheapest) head.append(el('span', 'chip chip--best', '최저가'));
    if (fit.swapped) head.append(el('span', 'chip chip--rotate', '↻ 회전 배치'));
    if (fit.dimsEstimated) head.append(el('span', 'chip chip--estimate', '내치수 추정'));
    body.append(head);

    body.append(el('h3', 'card__name', product.name));

    const dimsLabel = input.measureTarget === MEASURE_TARGET.ITEM ? '내치수' : '외치수';
    body.append(el('p', 'card__dims', `${dimsLabel} ${formatDims(fit.usedDims)}`));

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

    // ---- 가격 ----
    const price = el('div', 'card__price');
    price.append(el('strong', 'price__unit', formatKRW(product.unitPrice)));
    price.append(el('span', 'price__per', '/ 개'));
    const pack = formatPack(product.packQty, product.packPrice);
    if (pack) price.append(el('span', 'price__pack', pack));
    body.append(price);

    // ---- 구매 링크 ----
    const link = el('a', 'card__link', '구매처 보기');
    link.href = product.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    body.append(link);

    item.append(thumb, body);
    return item;
}

function renderNoMatch({ input, suggestedMargin }) {
    const wrap = el('div', 'empty');
    wrap.append(el('div', 'empty__icon', '🔍'));
    wrap.append(el('h2', 'empty__title', '조건에 맞는 상품이 없습니다'));

    const guide = input.measureTarget === MEASURE_TARGET.ITEM
        ? '입력하신 물건보다 크면서 여유 범위 안에 드는 상자가 없습니다.'
        : '입력하신 공간에 들어가면서 여유 범위 안에 드는 수납함이 없습니다.';
    wrap.append(el('p', 'empty__desc', guide));

    if (suggestedMargin === null) {
        wrap.append(el('p', 'empty__hint', '여유를 늘려도 맞는 상품이 없습니다. 규격이나 카테고리를 다시 확인해 주세요.'));
        return wrap;
    }

    if (suggestedMargin > MAX_MARGIN) {
        wrap.append(el('p', 'empty__hint', `가장 근접한 상품도 ${suggestedMargin}mm 여유가 필요합니다. (슬라이더 최대 ${MAX_MARGIN}mm)`));
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
