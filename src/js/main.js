// 진입점 — 상태 관리와 DOM 이벤트 바인딩만 담당한다.

import { CATEGORY, MEASURE_TARGET, DEFAULT_MARGIN, MAX_INPUT_MM } from './constants.js';
import { findMatchingProducts, suggestMinimumMargin } from './fit.js';
import { loadProducts } from './repository.js';
import { renderResults } from './render.js';
import {
    readStateFromUrl, writeStateToUrl, clearUrlState, buildShareUrl,
} from './urlState.js';

const dom = {
    tabs: document.querySelector('.tabs'),
    measureRadios: document.querySelectorAll('input[name="measure-target"]'),
    measureGuide: document.getElementById('measure-guide'),
    inputs: {
        w: document.getElementById('input-w'),
        d: document.getElementById('input-d'),
        h: document.getElementById('input-h'),
    },
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
    category: CATEGORY.PARCEL,
    measureTarget: MEASURE_TARGET.ITEM,
    margin: DEFAULT_MARGIN,
    allowSwapWD: true,
    products: [],
    loadError: null,
};

const GUIDE_TEXT = {
    [MEASURE_TARGET.ITEM]: '상자가 물건보다 <b>크거나 같은</b> 것만 보여드립니다. 물건보다 작은 상자는 제외됩니다.',
    [MEASURE_TARGET.SPACE]: '수납함이 공간보다 <b>작거나 같은</b> 것만 보여드립니다. 1mm라도 크면 제외됩니다.',
};

const MARGIN_GUIDE = {
    [MEASURE_TARGET.ITEM]: (mm) => `물건보다 최대 ${mm}mm까지 큰 상자만 봅니다. 값을 키우면 넉넉한 상자도 함께 나옵니다.`,
    [MEASURE_TARGET.SPACE]: (mm) => `공간보다 최대 ${mm}mm까지 작은 수납함만 봅니다. 값을 키우면 더 작은 제품도 함께 나옵니다.`,
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

function buildInput(size) {
    return {
        category: state.category,
        size,
        measureTarget: state.measureTarget,
        margin: state.margin,
        allowSwapWD: state.allowSwapWD,
    };
}

// ---------------- 렌더 ----------------

function update() {
    dom.measureGuide.innerHTML = GUIDE_TEXT[state.measureTarget];
    dom.marginValue.textContent = `${state.margin}mm`;
    dom.marginGuide.textContent = MARGIN_GUIDE[state.measureTarget](state.margin);

    if (state.loadError) {
        renderResults(dom.results, dom.summary, { status: 'error', message: state.loadError });
        return;
    }

    const { size, error } = readSize();
    dom.inputError.textContent = error;

    if (!size) {
        dom.shareBtn.hidden = true;
        clearUrlState();
        renderResults(dom.results, dom.summary, { status: 'idle' });
        return;
    }

    dom.shareBtn.hidden = false;
    writeStateToUrl(state, size);

    const input = buildInput(size);
    const matches = findMatchingProducts(state.products, input);

    if (matches.length === 0) {
        renderResults(dom.results, dom.summary, {
            status: 'empty',
            input,
            suggestedMargin: suggestMinimumMargin(state.products, input),
        });
        return;
    }

    renderResults(dom.results, dom.summary, { status: 'ok', matches, input });
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

/** state를 화면 컨트롤에 반영한다. URL로 복원할 때와 탭을 누를 때 같은 경로를 쓴다. */
function syncControls() {
    dom.tabs.querySelectorAll('.tabs__btn').forEach((tab) => {
        const active = tab.dataset.category === state.category;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
    });
    dom.measureRadios.forEach((radio) => {
        radio.checked = radio.value === state.measureTarget;
    });
    dom.marginRange.value = String(state.margin);
    dom.allowSwap.checked = state.allowSwapWD;
}

// ---------------- 이벤트 바인딩 ----------------

dom.tabs.addEventListener('click', (event) => {
    const button = event.target.closest('.tabs__btn');
    if (!button) return;

    state.category = button.dataset.category;
    syncControls();
    update();
});

dom.measureRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
        state.measureTarget = radio.value;
        update();
    });
});

Object.values(dom.inputs).forEach((input) => {
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

// 결과 영역의 "여유를 NNmm로 늘리기" 버튼 (동적으로 생성되므로 위임 처리)
dom.results.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="apply-margin"]');
    if (!button) return;

    state.margin = Number(button.dataset.margin);
    dom.marginRange.value = String(state.margin);
    update();
});

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
    syncControls();

    update(); // 데이터 로딩 전에도 안내 문구는 먼저 그린다
    try {
        state.products = await loadProducts();
    } catch (error) {
        state.loadError = `${error.message} (Live Server 등 로컬 서버로 실행했는지 확인해 주세요.)`;
    }
    update();
})();
