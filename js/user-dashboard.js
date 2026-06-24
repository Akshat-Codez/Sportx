/* ═══════════════════════════════════════════════════════════
   USER DASHBOARD — Data & UI  (js/user-dashboard.js)
   ─────────────────────────────────────────────────────────
   Responsibilities:
   • Fetching logged-in user's orders and profile info
   • Computing stats (Total Spent, Total Orders, Active Rentals)
   • Rendering tables and stat cards using same patterns as admin
═══════════════════════════════════════════════════════════ */

const SXUserDash = (() => {

  let userOrders = [];
  const currentUser = localStorage.getItem('sportx_user');
  const currentPhone = localStorage.getItem('sportx_phone');
  const token = localStorage.getItem('sportx_token');

  /* ────────────────────────────────────────────────────────
     AUTH CHECK
  ──────────────────────────────────────────────────────── */
  function checkAuth() {
    if (!token || !currentUser) {
      window.location.href = '/auth.html';
      return false;
    }
    document.getElementById('profile-name-display').innerText = currentUser;
    document.getElementById('profile-phone-display').innerText = currentPhone || '—';
    return true;
  }

  /* ────────────────────────────────────────────────────────
     API HELPERS
  ──────────────────────────────────────────────────────── */
  async function apiFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    const res = await window.fetch(url, options);
    if (res.status === 401) {
      logout();
      return null;
    }
    return res;
  }

  function logout() {
    localStorage.removeItem('sportx_user');
    localStorage.removeItem('sportx_phone');
    localStorage.removeItem('sportx_token');
    localStorage.removeItem('sportx_userId');
    window.location.href = '/';
  }

  /* ────────────────────────────────────────────────────────
     TIME / DELIVERY UTILITIES (Copied from admin-data)
  ──────────────────────────────────────────────────────── */
  const ONE_HOUR = 60 * 60 * 1000;

  function msUntilDelivery(createdAt) {
    return Math.max(0, new Date(createdAt).getTime() + ONE_HOUR - Date.now());
  }

  function shouldBeDelivered(order) {
    return order.status === 'delivered' || msUntilDelivery(order.createdAt) === 0;
  }

  function effectiveStatus(order) {
    return shouldBeDelivered(order) ? 'delivered' : order.status;
  }

  /* ────────────────────────────────────────────────────────
     BADGES & PILLS
  ──────────────────────────────────────────────────────── */
  function payBadge(method) {
    const m = (method || 'COD').toUpperCase();
    if (m === 'UPI') return `<span class="badge upi">UPI</span>`;
    return `<span class="badge cod">COD</span>`;
  }

  function statusBadge(order) {
    const st = effectiveStatus(order);
    if (st === 'delivered') return `<span class="badge delivered">DELIVERED</span>`;
    return `<span class="badge confirmed">CONFIRMED</span>`;
  }

  function deliveryPill(order, cellId) {
    const ms = msUntilDelivery(order.createdAt);
    if (ms === 0 || order.status === 'delivered') {
      return `<span class="delivery-pill done">✓ Delivered</span>`;
    }
    const mins = Math.ceil(ms / 60000);
    const html = `<span class="delivery-pill" id="pill-${cellId}">⏱ ${mins}m left</span>`;
    setTimeout(() => startCountdown(order, cellId), 0);
    return html;
  }

  const _countdownTimers = {};
  function startCountdown(order, cellId) {
    if (_countdownTimers[cellId]) clearInterval(_countdownTimers[cellId]);
    _countdownTimers[cellId] = setInterval(() => {
      const el = document.getElementById('pill-' + cellId);
      if (!el) { clearInterval(_countdownTimers[cellId]); return; }
      const ms = msUntilDelivery(order.createdAt);
      if (ms === 0) {
        clearInterval(_countdownTimers[cellId]);
        el.className = 'delivery-pill done';
        el.textContent = '✓ Delivered';
        const badge = document.getElementById('status-' + cellId);
        if (badge) badge.outerHTML = `<span class="badge delivered" id="status-${cellId}">DELIVERED</span>`;
        return;
      }
      el.textContent = `⏱ ${Math.ceil(ms / 60000)}m left`;
    }, 10000);
  }

  /* ────────────────────────────────────────────────────────
     DATA FETCH & RENDER
  ──────────────────────────────────────────────────────── */
  async function loadDashboard() {
    if (!checkAuth()) return;

    const tbodyDash = document.getElementById('dash-orders');
    const tbodyAll = document.getElementById('dash-orders-full');
    
    SXLoading.showTableSkeletons(tbodyDash, 5, 5, ['20%','20%','15%','15%','15%']);
    SXLoading.showTableSkeletons(tbodyAll, 8, 6, ['18%','15%','12%','15%','15%','15%']);

    try {
      const res = await apiFetch('/api/orders');
      if (!res) return;
      const json = await res.json();
      
      if (json.success) {
        userOrders = json.data;
        computeStats(userOrders);
        
        if (userOrders.length > 0) {
          SXLoading.reveal(tbodyDash, () => renderRecentOrders(userOrders.slice(0, 5)));
          SXLoading.reveal(tbodyAll, () => renderAllOrders(userOrders));
        } else {
          tbodyDash.innerHTML = '<tr><td colspan="5" class="empty-state">No orders placed yet.</td></tr>';
          tbodyAll.innerHTML = '<tr><td colspan="6" class="empty-state">No orders found.</td></tr>';
        }
      }
    } catch (e) {
      console.error('Failed to load user orders:', e);
      tbodyDash.innerHTML = '<tr><td colspan="5" class="empty-state">Failed to load data.</td></tr>';
    }
  }

  function computeStats(orders) {
    const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrdersCount = orders.length;
    
    // Count active rentals (orders not yet returned or just check items)
    let activeRentalsCount = 0;
    orders.forEach(o => {
      if (o.items) {
        o.items.forEach(item => {
          if (item.type === 'rent') activeRentalsCount += item.qty;
        });
      }
    });

    document.getElementById('s-spent').innerText = '₹' + totalSpent.toLocaleString();
    document.getElementById('s-ord').innerText = totalOrdersCount;
    document.getElementById('s-rentals').innerText = activeRentalsCount;
  }

  function renderRecentOrders(orders) {
    const tbody = document.getElementById('dash-orders');
    tbody.innerHTML = '';
    orders.forEach((o, i) => {
      const cellId = 'dash-' + i;
      const date = new Date(o.createdAt).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const tr = document.createElement('tr');
      tr.onclick = () => showOrderDetails(o.id);
      tr.innerHTML = `
        <td><span style="font-family:monospace;color:var(--gold)">${o.id}</span></td>
        <td>${date}</td>
        <td style="font-weight:700;color:#fff">₹${o.total.toLocaleString()}</td>
        <td id="status-${cellId}">${statusBadge(o)}</td>
        <td>${deliveryPill(o, cellId)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAllOrders(orders) {
    const tbody = document.getElementById('dash-orders-full');
    tbody.innerHTML = '';
    orders.forEach((o, i) => {
      const cellId = 'all-' + i;
      const date = new Date(o.createdAt).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const itemNames = o.items ? o.items.map(it => it.name).join(', ') : '—';
      const tr = document.createElement('tr');
      tr.onclick = () => showOrderDetails(o.id);
      tr.innerHTML = `
        <td><span style="font-family:monospace;color:var(--gold)">${o.id}</span></td>
        <td>${date}</td>
        <td style="color:#aaa; font-size:12px">${itemNames}</td>
        <td style="font-weight:700;color:#fff">₹${o.total.toLocaleString()}</td>
        <td id="status-${cellId}">${statusBadge(o)}</td>
        <td>${deliveryPill(o, cellId)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ────────────────────────────────────────────────────────
     ORDER DETAIL MODAL
  ──────────────────────────────────────────────────────── */
  function showOrderDetails(id) {
    const o = userOrders.find(x => x.id === id);
    if (!o) return;
    const st = effectiveStatus(o);
    const date = new Date(o.createdAt).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const msLeft = msUntilDelivery(o.createdAt);
    const deliverInfo = (st === 'delivered')
      ? `<span class="badge delivered" style="font-size:12px;">DELIVERED</span>`
      : `Approx. ${Math.ceil(msLeft / 60000)} min remaining`;

    let itemsHtml = '';
    if (o.items && o.items.length) {
      itemsHtml = `<div class="sx-items-title">Items Ordered</div>`;
      o.items.forEach(it => {
        itemsHtml += `<div class="sx-item-line">
          <span>${it.qty}× ${it.name} <span style="color:#555;font-size:11px">(${it.type})</span></span>
          <span style="color:#fff;font-weight:600">₹${(it.price * it.qty).toLocaleString()}</span>
        </div>`;
      });
      if (o.securityDeposit) {
        itemsHtml += `<div class="sx-item-line">
          <span>Security Deposit <span style="color:#555;font-size:11px">(refundable)</span></span>
          <span style="color:#fff;font-weight:600">₹${o.securityDeposit.toLocaleString()}</span>
        </div>`;
      }
    }

    document.getElementById('order-details-content').innerHTML = `
      <div class="sx-detail-row"><span class="sx-detail-label">Order ID</span>      <span class="sx-detail-val" style="font-family:monospace;color:var(--gold)">${o.id}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Date</span>           <span class="sx-detail-val">${date}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Address</span>        <span class="sx-detail-val">${o.address || '—'}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Payment</span>        <span class="sx-detail-val">${payBadge(o.paymentMethod)}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Total</span>          <span class="sx-detail-val" style="color:var(--gold);font-weight:700;font-size:16px">₹${o.total.toLocaleString()}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Status</span>         <span class="sx-detail-val">${statusBadge(o)}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Delivery</span>       <span class="sx-detail-val">${deliverInfo}</span></div>
      ${itemsHtml}
    `;
    openModal('order-modal');
  }

  /* ────────────────────────────────────────────────────────
     UI HELPERS
  ──────────────────────────────────────────────────────── */
  function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-' + tab).classList.add('active');
    ['dash', 'orders', 'profile'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = 'none';
    });
    
    const titles = {
      dash: 'My Dashboard',
      orders: 'Order History',
      profile: 'My Profile'
    };
    
    document.getElementById('page-title').innerText = titles[tab] || '';
    document.getElementById('view-' + tab).style.display = 'block';

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

  function openModal(id)  { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  return {
    loadDashboard,
    logout,
    switchTab,
    openSidebar,
    closeSidebar,
    openModal,
    closeModal,
    showOrderDetails
  };
})();

// Expose globally
window.SXUserDash = SXUserDash;
