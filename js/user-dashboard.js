/* ═══════════════════════════════════════════════════════════
   USER DASHBOARD — Data & UI  (js/user-dashboard.js)
   ─────────────────────────────────────────────────────────
   Tabs:  Addresses | Orders
   Features:
   • Address CRUD (localStorage)
   • Order history with delivery progress bar
   • Rental return deadlines (5 PM on return day)
   • Live countdown tickers
═══════════════════════════════════════════════════════════ */

const SXUserDash = (() => {

  const currentUser  = localStorage.getItem('sportx_user');
  const currentPhone = localStorage.getItem('sportx_phone');
  const token        = localStorage.getItem('sportx_token');

  let userOrders = [];
  const _tickers = {};

  /* ────────────────────────────────────────────────────────
     ADDRESS STORAGE
  ──────────────────────────────────────────────────────── */
  const ADDR_KEY = 'sportx_addresses';

  function getAddresses() {
    try { return JSON.parse(localStorage.getItem(ADDR_KEY)) || []; } catch { return []; }
  }
  function saveAddresses(list) { localStorage.setItem(ADDR_KEY, JSON.stringify(list)); }
  function genId()  { return 'addr_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

  /* ────────────────────────────────────────────────────────
     AUTH
  ──────────────────────────────────────────────────────── */
  function checkAuth() {
    if (!token || !currentUser) { window.location.href = '/auth.html'; return false; }
    const el = document.getElementById('profile-name-display');
    if (el) el.innerText = currentUser;
    return true;
  }

  function logout() {
    ['sportx_user','sportx_phone','sportx_token','sportx_userId']
      .forEach(k => localStorage.removeItem(k));
    window.location.href = '/';
  }

  /* ────────────────────────────────────────────────────────
     API
  ──────────────────────────────────────────────────────── */
  async function apiFetch(url, opts = {}) {
    if (!opts.headers) opts.headers = {};
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, opts);
    if (res.status === 401) { logout(); return null; }
    return res;
  }

  /* ────────────────────────────────────────────────────────
     TIME UTILITIES
  ──────────────────────────────────────────────────────── */
  const ONE_HOUR_MS = 60 * 60 * 1000;

  // Delivery happens 1 h after order creation
  function deliveryDeadlineMs(order) {
    return new Date(order.createdAt).getTime() + ONE_HOUR_MS;
  }
  function msUntilDelivery(order) {
    return Math.max(0, deliveryDeadlineMs(order) - Date.now());
  }
  function isDelivered(order) {
    return order.status === 'delivered' || msUntilDelivery(order) === 0;
  }

  // Rental return deadline: createdAt + days + 5 PM on that day
  function rentalReturnDeadline(order) {
    if (!order.items) return null;
    const rentItem = order.items.find(i => i.type === 'rent');
    if (!rentItem) return null;
    const days = rentItem.days || 7;
    const d = new Date(order.createdAt);
    d.setDate(d.getDate() + days);
    d.setHours(17, 0, 0, 0); // 5 PM
    return d;
  }

  function msUntilReturn(order) {
    const deadline = rentalReturnDeadline(order);
    if (!deadline) return null;
    return Math.max(0, deadline.getTime() - Date.now());
  }

  function fmtDuration(ms) {
    if (ms <= 0) return 'Now';
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function fmtDate(date) {
    return new Date(date).toLocaleString(undefined, {
      year:'numeric', month:'short', day:'numeric',
      hour:'2-digit', minute:'2-digit'
    });
  }

  /* Delivery progress 0–100 */
  function deliveryProgress(order) {
    const start = new Date(order.createdAt).getTime();
    const end   = deliveryDeadlineMs(order);
    if (Date.now() >= end) return 100;
    return Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100));
  }

  /* ────────────────────────────────────────────────────────
     ORDER RENDERING
  ──────────────────────────────────────────────────────── */
  function hasRental(order) {
    return order.items && order.items.some(i => i.type === 'rent');
  }

  function renderOrders(orders) {
    const container = document.getElementById('order-list');
    if (!container) return;

    if (!orders.length) {
      container.innerHTML = `
        <div class="addr-empty">
          <div class="addr-empty-icon">📦</div>
          <p>No orders placed yet.</p>
          <p style="font-size:12px;color:#555;margin-top:4px">Start shopping to see your orders here.</p>
          <a href="index.html" class="sx-save-btn" style="display:inline-block;margin-top:20px;padding:11px 28px;text-decoration:none;width:auto;">Browse Store</a>
        </div>`;
      return;
    }

    container.innerHTML = '';
    orders.forEach((order, idx) => renderOrderCard(order, idx, container));
  }

  function renderOrderCard(order, idx, container) {
    const card = document.createElement('div');
    card.className = 'order-card';
    card.id = 'order-card-' + idx;

    const delivered = isDelivered(order);
    const prog = deliveryProgress(order);
    const rentReturn = rentalReturnDeadline(order);
    const hasRent = hasRental(order);
    const msLeft = msUntilDelivery(order);

    // ── Delivery milestones ─────────────────────────────
    // Step 1 — Confirmed    : immediately on order creation
    // Step 2 — Out for Delivery : after 15 minutes
    // Step 3 — Delivered    : after 60 minutes
    const elapsedMs   = Date.now() - new Date(order.createdAt).getTime();
    const FIFTEEN_MIN = 15 * 60 * 1000;
    const step1done   = true;                                // always confirmed once created
    const step2done   = delivered || elapsedMs >= FIFTEEN_MIN;
    const step3done   = delivered;

    // Payment badge
    const payMethod = (order.paymentMethod || 'COD').toUpperCase();
    const payBadge = payMethod === 'UPI'
      ? `<span class="ord-badge ord-badge--upi">UPI</span>`
      : `<span class="ord-badge ord-badge--cod">COD</span>`;

    // Status badge — reflects current milestone
    const statusBadge = delivered
      ? `<span class="ord-badge ord-badge--delivered" id="sbadge-${idx}">DELIVERED</span>`
      : step2done
        ? `<span class="ord-badge ord-badge--transit" id="sbadge-${idx}">OUT FOR DELIVERY</span>`
        : `<span class="ord-badge ord-badge--active" id="sbadge-${idx}">CONFIRMED</span>`;

    // Items list
    const itemsHtml = order.items
      ? order.items.map(it => `
          <div class="ord-item">
            <span class="ord-item-name">${it.name}</span>
            <span class="ord-item-meta">${it.type === 'rent' ? `Rental · ${it.days || 7}d` : 'Buy'} · ${it.qty}×</span>
            <span class="ord-item-price">₹${(it.price * it.qty).toLocaleString()}</span>
          </div>`).join('')
      : '';

    // Rental return section
    let returnHtml = '';
    if (hasRent && rentReturn) {
      const retMs = msUntilReturn(order);
      const retOverdue = retMs === 0;
      returnHtml = `
        <div class="ord-return ${retOverdue ? 'ord-return--overdue' : ''}">
          <div class="ord-return__label">
            ${retOverdue ? '⚠️ RETURN OVERDUE' : '📅 RETURN DEADLINE'}
          </div>
          <div class="ord-return__date">${fmtDate(rentReturn)} (5:00 PM)</div>
          ${!retOverdue ? `<div class="ord-return__countdown" id="retcnt-${idx}">Time left: ${fmtDuration(retMs)}</div>` : '<div class="ord-return__overdue-msg">Please return the equipment immediately.</div>'}
        </div>`;
    }

    card.innerHTML = `
      <div class="ord-card__header">
        <div class="ord-card__id"><span style="color:#555;font-size:11px">ORDER</span> <span class="ord-id-text">${order.id}</span></div>
        <div class="ord-card__badges">${statusBadge} ${payBadge}</div>
      </div>

      <div class="ord-card__meta">
        <span>🕐 ${fmtDate(order.createdAt)}</span>
        <span style="font-weight:700;color:var(--gold)">₹${order.total.toLocaleString()}</span>
      </div>

      <!-- Delivery Progress -->
      <div class="ord-progress-section">
        <div class="ord-steps">
          <div class="ord-step ${step1done ? 'done' : ''}">
            <div class="ord-step__dot"></div>
            <div class="ord-step__label">Confirmed</div>
          </div>
          <div class="ord-step-line ${step2done ? 'done' : ''}"></div>
          <div class="ord-step ${step2done ? 'done' : ''}">
            <div class="ord-step__dot"></div>
            <div class="ord-step__label">Out for Delivery</div>
          </div>
          <div class="ord-step-line ${step3done ? 'done' : ''}"></div>
          <div class="ord-step ${step3done ? 'done' : ''}">
            <div class="ord-step__dot"></div>
            <div class="ord-step__label">Delivered</div>
          </div>
        </div>
        <div class="ord-progress-bar">
          <div class="ord-progress-fill" id="prog-fill-${idx}" style="width:${prog}%"></div>
        </div>
        ${!delivered
          ? `<div class="ord-eta" id="ord-eta-${idx}">⏱ Arriving in ${fmtDuration(msLeft)}</div>`
          : `<div class="ord-eta ord-eta--done">✓ Delivered</div>`
        }
      </div>

      <!-- Items -->
      <details class="ord-items-details">
        <summary class="ord-items-summary">${order.items?.length || 0} item${order.items?.length !== 1 ? 's' : ''} · Tap to expand</summary>
        <div class="ord-items-list">
          ${itemsHtml}
          ${order.securityDeposit ? `
          <div class="ord-item">
            <span class="ord-item-name">Security Deposit</span>
            <span class="ord-item-meta">Refundable</span>
            <span class="ord-item-price">₹${order.securityDeposit.toLocaleString()}</span>
          </div>` : ''}
        </div>
      </details>

      ${returnHtml}
    `;

    container.appendChild(card);

    // Start live ticker if order not yet delivered
    if (!delivered) startDeliveryTicker(order, idx);
    if (hasRent && rentReturn && msUntilReturn(order) > 0) startReturnTicker(order, idx);
  }

  function startDeliveryTicker(order, idx) {
    if (_tickers['d' + idx]) clearInterval(_tickers['d' + idx]);
    const FIFTEEN_MIN = 15 * 60 * 1000;

    _tickers['d' + idx] = setInterval(() => {
      const eta    = document.getElementById('ord-eta-' + idx);
      const fill   = document.getElementById('prog-fill-' + idx);
      const badge  = document.getElementById('sbadge-' + idx);
      const card   = document.getElementById('order-card-' + idx);
      const ms     = msUntilDelivery(order);
      const prog   = deliveryProgress(order);
      const elapsedMs = Date.now() - new Date(order.createdAt).getTime();

      // ── Update progress bar ──
      if (fill) fill.style.width = prog + '%';

      // ── Delivered (60 min) ──
      if (ms === 0) {
        clearInterval(_tickers['d' + idx]);
        if (eta) { eta.className = 'ord-eta ord-eta--done'; eta.textContent = '✓ Delivered'; }
        if (fill) fill.style.width = '100%';
        if (card) card.querySelectorAll('.ord-step, .ord-step-line').forEach(el => el.classList.add('done'));
        if (badge) { badge.className = 'ord-badge ord-badge--delivered'; badge.textContent = 'DELIVERED'; }
        return;
      }

      // ── Out for Delivery milestone (15 min) ──
      if (elapsedMs >= FIFTEEN_MIN) {
        // Light up step 2 dot and line if not already
        if (card) {
          const steps = card.querySelectorAll('.ord-step');
          const lines = card.querySelectorAll('.ord-step-line');
          if (steps[1]) steps[1].classList.add('done');
          if (lines[0]) lines[0].classList.add('done');
        }
        if (badge && badge.textContent !== 'OUT FOR DELIVERY') {
          badge.className = 'ord-badge ord-badge--transit';
          badge.textContent = 'OUT FOR DELIVERY';
        }
      }

      // ── ETA countdown ──
      if (eta) eta.textContent = `⏱ Arriving in ${fmtDuration(ms)}`;
    }, 1000);
  }

  function startReturnTicker(order, idx) {
    if (_tickers['r' + idx]) clearInterval(_tickers['r' + idx]);
    _tickers['r' + idx] = setInterval(() => {
      const el = document.getElementById('retcnt-' + idx);
      if (!el) { clearInterval(_tickers['r' + idx]); return; }
      const ms = msUntilReturn(order);
      if (ms === 0) {
        clearInterval(_tickers['r' + idx]);
        el.textContent = 'Return deadline passed!';
        el.style.color = '#ff4757';
        return;
      }
      el.textContent = 'Time left: ' + fmtDuration(ms);
    }, 1000);
  }

  /* ────────────────────────────────────────────────────────
     ADDRESS RENDERING
  ──────────────────────────────────────────────────────── */
  function renderAddresses() {
    const container = document.getElementById('address-cards');
    if (!container) return;
    const addresses = getAddresses();
    if (!addresses.length) {
      container.innerHTML = `
        <div class="addr-empty">
          <div class="addr-empty-icon">📭</div>
          <p>No saved addresses yet.</p>
          <p style="font-size:12px;color:#555;margin-top:4px">Add one below to speed up checkout!</p>
        </div>`;
      return;
    }
    container.innerHTML = addresses.map(addr => `
      <div class="addr-card ${addr.isDefault ? 'addr-card--default' : ''}" id="addrcard-${addr.id}">
        <div class="addr-card__header">
          <div class="addr-card__label">
            <span class="addr-type-pill">${addr.type || 'Home'}</span>
            ${addr.isDefault ? '<span class="addr-default-badge">DEFAULT</span>' : ''}
          </div>
          <div class="addr-card__actions">
            ${!addr.isDefault ? `<button class="addr-btn addr-btn--ghost" onclick="SXUserDash.setDefault('${addr.id}')">Set Default</button>` : ''}
            <button class="addr-btn addr-btn--edit" onclick="SXUserDash.openEditModal('${addr.id}')">Edit</button>
            <button class="addr-btn addr-btn--delete" onclick="SXUserDash.deleteAddress('${addr.id}')">Delete</button>
          </div>
        </div>
        <div class="addr-card__body">
          <div class="addr-name">${addr.name}</div>
          <div class="addr-street">${addr.street}</div>
          <div class="addr-pin">📍 PIN: ${addr.pin}</div>
          ${addr.phone ? `<div class="addr-phone">📞 ${addr.phone}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  /* ────────────────────────────────────────────────────────
     ADDRESS CRUD
  ──────────────────────────────────────────────────────── */
  let _editingId = null;

  function openAddModal() {
    _editingId = null;
    document.getElementById('addr-modal-title').innerText = 'ADD NEW ADDRESS';
    clearAddressForm();
    openModal('addr-form-modal');
  }

  function openEditModal(id) {
    _editingId = id;
    const addr = getAddresses().find(a => a.id === id);
    if (!addr) return;
    document.getElementById('addr-modal-title').innerText = 'EDIT ADDRESS';
    document.getElementById('af-type').value   = addr.type   || 'Home';
    document.getElementById('af-name').value   = addr.name   || '';
    document.getElementById('af-street').value = addr.street || '';
    document.getElementById('af-pin').value    = addr.pin    || '';
    document.getElementById('af-phone').value  = addr.phone  || '';
    // Sync type chips
    document.querySelectorAll('#type-chips .type-chip').forEach(c => {
      c.classList.toggle('selected', c.dataset.type === addr.type);
    });
    openModal('addr-form-modal');
  }

  function saveAddressForm() {
    const type   = document.getElementById('af-type').value.trim() || 'Home';
    const name   = document.getElementById('af-name').value.trim();
    const street = document.getElementById('af-street').value.trim();
    const pin    = document.getElementById('af-pin').value.trim();
    const phone  = document.getElementById('af-phone').value.trim();
    if (!name || !street || !pin) { showToast('Please fill Name, Street & Pincode.', 'error'); return; }
    if (_editingId) {
      const addrs = getAddresses();
      const idx = addrs.findIndex(a => a.id === _editingId);
      if (idx > -1) { addrs[idx] = { ...addrs[idx], type, name, street, pin, phone }; saveAddresses(addrs); }
      showToast('Address updated!', 'success');
    } else {
      const addrs = getAddresses();
      addrs.push({ id: genId(), type, name, street, pin, phone, isDefault: addrs.length === 0 });
      saveAddresses(addrs);
      showToast('Address saved!', 'success');
    }
    renderAddresses();
    closeModal('addr-form-modal');
  }

  function deleteAddress(id) {
    let addrs = getAddresses();
    const wasDefault = addrs.find(a => a.id === id)?.isDefault;
    addrs = addrs.filter(a => a.id !== id);
    if (wasDefault && addrs.length) addrs[0].isDefault = true;
    saveAddresses(addrs);
    renderAddresses();
    showToast('Address removed.', 'neutral');
  }

  function setDefault(id) {
    const addrs = getAddresses();
    addrs.forEach(a => a.isDefault = (a.id === id));
    saveAddresses(addrs);
    renderAddresses();
    showToast('Default address updated!', 'success');
  }

  function clearAddressForm() {
    ['af-name','af-street','af-pin','af-phone'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('af-type').value = 'Home';
    document.querySelectorAll('#type-chips .type-chip').forEach(c => {
      c.classList.toggle('selected', c.dataset.type === 'Home');
    });
  }

  /* ────────────────────────────────────────────────────────
     TOAST
  ──────────────────────────────────────────────────────── */
  function showToast(msg, type = 'success') {
    const cont = document.getElementById('dash-toasts');
    if (!cont) return;
    const t = document.createElement('div');
    t.className = `dash-toast dash-toast--${type}`;
    t.innerText = msg;
    cont.appendChild(t);
    requestAnimationFrame(() => t.classList.add('dash-toast--in'));
    setTimeout(() => {
      t.classList.remove('dash-toast--in');
      setTimeout(() => t.remove(), 350);
    }, 2800);
  }

  /* ────────────────────────────────────────────────────────
     UI: TAB SWITCHING & INIT
  ──────────────────────────────────────────────────────── */
  async function loadDashboard() {
    if (!checkAuth()) return;
    renderAddresses();
    // Fetch orders
    try {
      const res = await apiFetch('/api/orders');
      if (!res) return;
      const json = await res.json();
      if (json.success) {
        userOrders = json.data;
        renderOrders(userOrders);
      }
    } catch(e) {
      console.error('Failed to load orders', e);
      const el = document.getElementById('order-list');
      if (el) el.innerHTML = '<div class="addr-empty"><p>Failed to load orders.</p></div>';
    }
  }

  const TABS = ['addresses', 'orders'];
  const TITLES = { addresses: 'My Addresses', orders: 'Order History' };

  function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-' + tab)?.classList.add('active');
    TABS.forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = 'none';
    });
    document.getElementById('page-title').innerText = TITLES[tab] || '';
    const view = document.getElementById('view-' + tab);
    if (view) view.style.display = 'block';
    closeSidebar();
  }

  function openSidebar() {
    document.querySelector('.sidebar').classList.add('open');
    document.getElementById('sidebar-backdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('open');
    document.body.style.overflow = '';
  }
  function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

  return {
    loadDashboard, logout, switchTab, openSidebar, closeSidebar,
    openModal, closeModal,
    openAddModal, openEditModal, saveAddressForm,
    deleteAddress, setDefault,
    getAddresses
  };
})();

window.SXUserDash = SXUserDash;
