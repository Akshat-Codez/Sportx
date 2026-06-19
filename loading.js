/* ═══════════════════════════════════════════════════════════
   SPORTX LOADING SYSTEM  —  loading.js
   Drop-in utilities for skeleton screens & button loaders.
   Zero dependencies. Works with the existing vanilla JS stack.
═══════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────
   1.  SKELETON HTML FACTORIES
   Each returns an HTMLElement ready to inject into the DOM.
──────────────────────────────────────────────────────── */

const SXLoading = (() => {

  /** Product-card skeleton that mirrors the real card layout */
  function productCard() {
    const el = document.createElement('div');
    el.className = 'sx-card-skeleton';
    el.setAttribute('aria-busy', 'true');
    el.setAttribute('aria-label', 'Loading product');
    el.innerHTML = `
      <div class="sk-img sx-skeleton"></div>
      <div class="sk-body">
        <div class="sk-name  sx-skeleton"></div>
        <div class="sk-price sx-skeleton"></div>
        <div class="sk-rent  sx-skeleton"></div>
        <div class="sk-actions">
          <div class="sk-btn sx-skeleton"></div>
          <div class="sk-btn sx-skeleton"></div>
        </div>
      </div>`;
    return el;
  }

  /** Renders N product-card skeletons into a grid container */
  function showProductSkeletons(gridEl, count = 8) {
    gridEl.innerHTML = '';
    gridEl.classList.add('sx-appear-stagger');
    for (let i = 0; i < count; i++) {
      gridEl.appendChild(productCard());
    }
  }

  /** Admin stat-card skeleton */
  function statCard() {
    const el = document.createElement('div');
    el.className = 'sx-stat-skeleton';
    el.setAttribute('aria-busy', 'true');
    el.innerHTML = `
      <div class="sk-icon sx-skeleton"></div>
      <div class="sk-val  sx-skeleton"></div>
      <div class="sk-lbl  sx-skeleton"></div>`;
    return el;
  }

  /** Renders N stat skeletons inside a stats-grid */
  function showStatSkeletons(gridEl, count = 4) {
    gridEl.innerHTML = '';
    for (let i = 0; i < count; i++) gridEl.appendChild(statCard());
  }

  /** One skeleton table row with configurable column count */
  function tableRow(cols = 4, widths = []) {
    const tr = document.createElement('tr');
    tr.className = 'sx-table-row-skeleton';
    tr.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < cols; i++) {
      const td = document.createElement('td');
      const div = document.createElement('div');
      div.className = 'sk-cell sx-skeleton';
      div.style.width = widths[i] || (40 + Math.random() * 40 | 0) + '%';
      td.appendChild(div);
      tr.appendChild(td);
    }
    return tr;
  }

  /** Renders N skeleton rows into a <tbody> */
  function showTableSkeletons(tbodyEl, rows = 5, cols = 4, widths = []) {
    tbodyEl.innerHTML = '';
    for (let i = 0; i < rows; i++) {
      tbodyEl.appendChild(tableRow(cols, widths));
    }
  }

  /** Cart-item skeleton */
  function cartItem() {
    const el = document.createElement('div');
    el.className = 'sx-cart-item-skeleton';
    el.setAttribute('aria-busy', 'true');
    el.innerHTML = `
      <div class="sk-icon sx-skeleton"></div>
      <div class="sk-details">
        <div class="sk-name  sx-skeleton"></div>
        <div class="sk-type  sx-skeleton"></div>
        <div class="sk-price sx-skeleton"></div>
      </div>`;
    return el;
  }

  /** Renders N cart skeletons inside a cart-items container */
  function showCartSkeletons(containerEl, count = 3) {
    containerEl.innerHTML = '';
    for (let i = 0; i < count; i++) containerEl.appendChild(cartItem());
  }

  /* ────────────────────────────────────────────────────────
     2.  CONTENT REVEAL  –  fade real content in after load
  ──────────────────────────────────────────────────────── */

  /**
   * Replace skeleton content with real content and fade it in.
   * @param {HTMLElement} container  Parent that held skeletons
   * @param {Function}    renderFn   Sync function that populates container
   */
  function reveal(container, renderFn) {
    renderFn();
    container.classList.remove('sx-appear-stagger');
    // Reflow trick so animation fires even if class was already present
    void container.offsetWidth;
    container.classList.add('sx-appear-stagger');
  }

  /* ────────────────────────────────────────────────────────
     3.  BUTTON LOADER
  ──────────────────────────────────────────────────────── */

  /**
   * Put a button into loading state.
   * @param {HTMLButtonElement} btn
   * @param {string} [spinnerVariant]  'gold' | 'dark' | '' (default)
   * @returns {Function}  Call to restore the button
   */
  function buttonStart(btn, spinnerVariant = '') {
    // Freeze dimensions
    const { width, height } = btn.getBoundingClientRect();
    btn.style.setProperty('--sx-btn-w', width + 'px');
    btn.style.setProperty('--sx-btn-h', height + 'px');

    // Wrap text so we can hide it while keeping the button width
    if (!btn.querySelector('.sx-btn-text')) {
      btn.innerHTML = `<span class="sx-btn-text">${btn.innerHTML}</span>`;
    } else {
      btn.querySelector('.sx-btn-text').style.visibility = 'hidden';
    }

    btn.classList.add('sx-btn-loading');
    if (spinnerVariant) btn.classList.add(`sx-btn-${spinnerVariant}`);
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');

    // Return restore function
    return function buttonStop(newLabel) {
      btn.classList.remove('sx-btn-loading', `sx-btn-${spinnerVariant}`);
      btn.disabled = false;
      btn.setAttribute('aria-busy', 'false');
      const textEl = btn.querySelector('.sx-btn-text');
      if (textEl) {
        if (newLabel !== undefined) textEl.innerHTML = newLabel;
        textEl.style.visibility = '';
      }
      btn.style.removeProperty('--sx-btn-w');
      btn.style.removeProperty('--sx-btn-h');
    };
  }

  /**
   * Convenience wrapper: runs an async action with button in loading state.
   * @param {HTMLButtonElement} btn
   * @param {Function}          asyncFn   async () => {}
   * @param {string}            [variant] spinner variant
   */
  async function buttonAction(btn, asyncFn, variant = 'gold') {
    const stop = buttonStart(btn, variant);
    try {
      await asyncFn();
    } finally {
      stop();
    }
  }

  /* ────────────────────────────────────────────────────────
     4.  PAGE LOADER  (full-screen brand splash)
  ──────────────────────────────────────────────────────── */

  let _pageLoader = null;

  function showPageLoader() {
    if (_pageLoader) return;
    _pageLoader = document.createElement('div');
    _pageLoader.className = 'sx-page-loader';
    _pageLoader.setAttribute('role', 'status');
    _pageLoader.setAttribute('aria-label', 'Loading SportX');
    _pageLoader.innerHTML = `
      <div class="sx-page-loader-logo">SPORT<span>X</span></div>
      <div class="sx-page-loader-bar"></div>`;
    document.body.appendChild(_pageLoader);
  }

  function hidePageLoader() {
    if (!_pageLoader) return;
    _pageLoader.classList.add('sx-loaded');
    setTimeout(() => {
      _pageLoader?.remove();
      _pageLoader = null;
    }, 450);
  }

  /* ────────────────────────────────────────────────────────
     5.  PUBLIC API
  ──────────────────────────────────────────────────────── */
  return {
    // Skeletons
    showProductSkeletons,
    showStatSkeletons,
    showTableSkeletons,
    showCartSkeletons,
    // Reveal
    reveal,
    // Button
    buttonStart,
    buttonAction,
    // Page loader
    showPageLoader,
    hidePageLoader,
  };
})();

// Make available globally
window.SXLoading = SXLoading;