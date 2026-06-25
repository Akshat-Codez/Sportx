/* ═══════════════════════════════════════════════════════════
   USER DASHBOARD — Data & UI  (js/user-dashboard.js)
   ─────────────────────────────────────────────────────────
   Responsibilities:
   • Auth checking and session management
   • Address CRUD (saved in localStorage as sportx_addresses)
   • Rendering address cards with edit/delete/default actions
   • Exposing helpers for checkout address selection
═══════════════════════════════════════════════════════════ */

const SXUserDash = (() => {

  const currentUser  = localStorage.getItem('sportx_user');
  const currentPhone = localStorage.getItem('sportx_phone');
  const token        = localStorage.getItem('sportx_token');

  /* ────────────────────────────────────────────────────────
     ADDRESS STORAGE  (persisted in localStorage)
  ──────────────────────────────────────────────────────── */
  const ADDR_KEY = 'sportx_addresses';

  function getAddresses() {
    try { return JSON.parse(localStorage.getItem(ADDR_KEY)) || []; }
    catch { return []; }
  }

  function saveAddresses(list) {
    localStorage.setItem(ADDR_KEY, JSON.stringify(list));
  }

  function generateId() {
    return 'addr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  /* ────────────────────────────────────────────────────────
     AUTH CHECK
  ──────────────────────────────────────────────────────── */
  function checkAuth() {
    if (!token || !currentUser) {
      window.location.href = '/auth.html';
      return false;
    }
    // Populate header display name
    const nameEl = document.getElementById('profile-name-display');
    if (nameEl) nameEl.innerText = currentUser;
    return true;
  }

  function logout() {
    localStorage.removeItem('sportx_user');
    localStorage.removeItem('sportx_phone');
    localStorage.removeItem('sportx_token');
    localStorage.removeItem('sportx_userId');
    window.location.href = '/';
  }

  /* ────────────────────────────────────────────────────────
     ADDRESS RENDERING
  ──────────────────────────────────────────────────────── */
  function renderAddresses() {
    const container = document.getElementById('address-cards');
    if (!container) return;

    const addresses = getAddresses();

    if (addresses.length === 0) {
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
  function addAddress(data) {
    const addresses = getAddresses();
    const newAddr = { ...data, id: generateId(), isDefault: addresses.length === 0 };
    addresses.push(newAddr);
    saveAddresses(addresses);
    renderAddresses();
  }

  function updateAddress(id, data) {
    const addresses = getAddresses();
    const idx = addresses.findIndex(a => a.id === id);
    if (idx === -1) return;
    addresses[idx] = { ...addresses[idx], ...data };
    saveAddresses(addresses);
    renderAddresses();
  }

  function deleteAddress(id) {
    let addresses = getAddresses();
    const wasDefault = addresses.find(a => a.id === id)?.isDefault;
    addresses = addresses.filter(a => a.id !== id);
    // If deleted was default, promote the first remaining one
    if (wasDefault && addresses.length > 0) addresses[0].isDefault = true;
    saveAddresses(addresses);
    renderAddresses();
    showToast('Address removed.', 'neutral');
  }

  function setDefault(id) {
    const addresses = getAddresses();
    addresses.forEach(a => a.isDefault = (a.id === id));
    saveAddresses(addresses);
    renderAddresses();
    showToast('Default address updated!', 'success');
  }

  /* ────────────────────────────────────────────────────────
     MODAL — Add / Edit Address
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
    openModal('addr-form-modal');
  }

  function saveAddressForm() {
    const type   = document.getElementById('af-type').value.trim()   || 'Home';
    const name   = document.getElementById('af-name').value.trim();
    const street = document.getElementById('af-street').value.trim();
    const pin    = document.getElementById('af-pin').value.trim();
    const phone  = document.getElementById('af-phone').value.trim();

    if (!name || !street || !pin) {
      showToast('Please fill Name, Street & Pincode.', 'error'); return;
    }

    if (_editingId) {
      updateAddress(_editingId, { type, name, street, pin, phone });
      showToast('Address updated!', 'success');
    } else {
      addAddress({ type, name, street, pin, phone });
      showToast('Address saved!', 'success');
    }
    closeModal('addr-form-modal');
  }

  function clearAddressForm() {
    ['af-type','af-name','af-street','af-pin','af-phone'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = id === 'af-type' ? 'Home' : '';
    });
  }

  /* ────────────────────────────────────────────────────────
     TOAST
  ──────────────────────────────────────────────────────── */
  function showToast(msg, type = 'success') {
    const container = document.getElementById('dash-toasts');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `dash-toast dash-toast--${type}`;
    t.innerText = msg;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('dash-toast--in'));
    setTimeout(() => {
      t.classList.remove('dash-toast--in');
      setTimeout(() => t.remove(), 350);
    }, 2800);
  }

  /* ────────────────────────────────────────────────────────
     UI HELPERS
  ──────────────────────────────────────────────────────── */
  function loadDashboard() {
    if (!checkAuth()) return;
    renderAddresses();
  }

  function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-' + tab)?.classList.add('active');
    ['addresses'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = 'none';
    });
    const titles = { addresses: 'My Addresses' };
    document.getElementById('page-title').innerText = titles[tab] || '';
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
