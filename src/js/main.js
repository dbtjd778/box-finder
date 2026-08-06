// 진입점 — 상태 관리와 DOM 이벤트 바인딩만 담당한다.

import { DEFAULT_MARGIN, MAX_INPUT_MM, DEFAULT_QTY, MAX_QTY } from './constants.js';
import { findMatchingProducts, suggestMinimumMargin } from './fit.js';
import { loadProducts } from './repository.js';
import { renderResults } from './render.js';
import {
    readStateFromUrl, writeStateToUrl, clearUrlState, buildShareUrl,
} from './urlState.js';

const dom = {
    inputs: {
        w: document.getElementById('input-w'),
        d: document.getElementById('input-d'),
        h: document.getElementById('input-h'),
    },
    qty: document.getElementById('input-qty'),
    inputError: document.getElementById('input-error'),
    marginRange: document.getElementById('margin-range'),
    marginValue: document.getElementById('margin-value'),
    marginGuide: document.getElementById('margin-guide'),
    allowSwap: document.getElementById('allow-swap'),
    resetBtn: document.getElementById('reset-btn'),
    shareBtn: document.getElementById('share-btn'),
    summary: document.getElementById('summary'),
    results: document.getElementById('results'),
};

const state = {
    margin: DEFAULT_MARGIN,
    quantity: DEFAULT_QTY,
    allowSwapWD: true,
    products: [],
    loadError: null,
};

// ---------------- 입력 읽기 ----------------

/** 세 축 모두 유효한 양수일 때만 size를 반환. 아니면 null. */
function readSize() {
    const size = {};
    for (const [axis, input] of Object.entries(dom.inputs)) {
        const raw = input.value.trim();
        if (raw === '') return { size: null, error: '' };

        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) {
            return { size: null, error: '규격은 0보다 큰 숫자로 입력해 주세요.' };
        }
        if (value > MAX_INPUT_MM) {
            return { size: null, error: `${MAX_INPUT_MM}mm(2m)를 넘는 규격은 지원하지 않습니다.` };
        }
        size[axis] = value;
    }
    return { size, error: '' };
}

/** 비어 있으면 1개로 본다. 범위를 벗어난 값만 오류로 취급. */
function readQuantity() {
    const raw = dom.qty.value.trim();
    if (raw === '') return { quantity: DEFAULT_QTY, error: '' };

    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > MAX_QTY) {
        return { quantity: null, error: `수량은 1~${MAX_QTY}개 사이의 정수로 입력해 주세요.` };
    }
    return { quantity: value, error: '' };
}

function buildInput(size) {
    return {
        size,
        margin: state.margin,
        quantity: state.quantity,
        allowSwapWD: state.allowSwapWD,
    };
}

// ---------------- 렌더 ----------------

function update() {
    dom.marginValue.textContent = `${state.margin}mm`;
    dom.marginGuide.textContent =
        `물건보다 최대 ${state.margin}mm까지 큰 상자만 봅니다. 값을 키우면 넉넉한 상자도 함께 나옵니다.`;

    if (state.loadError) {
        renderResults(dom.results, dom.summary, { status: 'error', message: state.loadError });
        return;
    }

    const { quantity, error: qtyError } = readQuantity();
    state.quantity = quantity ?? DEFAULT_QTY;

    const { size, error } = readSize();
    dom.inputError.textContent = error || qtyError;

    if (!size || quantity === null) {
        dom.shareBtn.hidden = true;
        clearUrlState();
        // 규격은 멀쩡한데 수량만 틀린 경우 "규격을 입력하세요"는 엉뚱한 안내가 된다.
        const qtyOnly = size && quantity === null;
        renderResults(dom.results, dom.summary, {
            status: 'idle',
            title: qtyOnly ? '필요 수량을 확인해 주세요' : undefined,
            message: qtyOnly ? qtyError : undefined,
        });
        return;
    }

    dom.shareBtn.hidden = false;
    writeStateToUrl(state, size);

    const input = buildInput(size);
    const matches = findMatchingProducts(state.products, input);

    if (matches.length === 0) {
        renderResults(dom.results, dom.summary, {
            status: 'empty',
            suggestedMargin: suggestMinimumMargin(state.products, input),
        });
        return;
    }

    renderResults(dom.results, dom.summary, { status: 'ok', matches });
}

/** 입력 타이핑마다 전체 재계산이 도는 것을 막는다. */
function debounce(fn, delay = 180) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

const debouncedUpdate = debounce(update);

// ---------------- 이벤트 바인딩 ----------------

[...Object.values(dom.inputs), dom.qty].forEach((input) => {
    input.addEventListener('input', debouncedUpdate);
});

dom.marginRange.addEventListener('input', () => {
    state.margin = Number(dom.marginRange.value);
    update();
});

dom.allowSwap.addEventListener('change', () => {
    state.allowSwapWD = dom.allowSwap.checked;
    update();
});

dom.resetBtn.addEventListener('click', () => {
    Object.values(dom.inputs).forEach((input) => { input.value = ''; });
    dom.inputs.w.focus();
    update();
});

// 결과 영역의 "여유를 NNmm로 늘리기" 버튼 (동적으로 생성되므로 위임 처리)
dom.results.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="apply-margin"]');
    if (!button) return;

    state.margin = Number(button.dataset.margin);
    dom.marginRange.value = String(state.margin);
    update();
});

// ---------------- 결과 공유 ----------------

let shareResetTimer;

dom.shareBtn.addEventListener('click', async () => {
    const { size } = readSize();
    if (!size) return;

    const url = buildShareUrl(state, size);
    const ok = await copyText(url);

    clearTimeout(shareResetTimer);
    dom.shareBtn.textContent = ok ? '링크 복사됨 ✓' : '복사 실패 — 주소창을 복사해 주세요';
    dom.shareBtn.classList.toggle('is-done', ok);
    shareResetTimer = setTimeout(() => {
        dom.shareBtn.textContent = '링크 복사';
        dom.shareBtn.classList.remove('is-done');
    }, 2000);
});

/** clipboard API는 보안 컨텍스트(https/localhost)에서만 동작해서 폴백을 둔다. */
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const helper = document.createElement('textarea');
            helper.value = text;
            helper.setAttribute('readonly', '');
            helper.style.position = 'fixed';
            helper.style.opacity = '0';
            document.body.append(helper);
            helper.select();
            const ok = document.execCommand('copy');
            helper.remove();
            return ok;
        } catch {
            return false;
        }
    }
}

// ---------------- 초기화 ----------------

(async function init() {
    // 공유 링크로 들어온 경우 조건을 먼저 복원한다.
    const { patch, size } = readStateFromUrl();
    Object.assign(state, patch);
    if (size) {
        for (const [axis, input] of Object.entries(dom.inputs)) {
            input.value = String(size[axis]);
        }
    }
    dom.qty.value = String(state.quantity);
    dom.marginRange.value = String(state.margin);
    dom.allowSwap.checked = state.allowSwapWD;

    update(); // 데이터 로딩 전에도 안내 문구는 먼저 그린다
    try {
        state.products = await loadProducts();
    } catch (error) {
        state.loadError = `${error.message} (Live Server 등 로컬 서버로 실행했는지 확인해 주세요.)`;
    }
    update();
})();
