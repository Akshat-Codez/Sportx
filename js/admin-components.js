/* ═══════════════════════════════════════════════════════════
   SPORTX ADMIN — UI Components  (js/admin-components.js)
   ─────────────────────────────────────────────────────────
   Responsibilities:
   • Rendering functions for every dashboard section
   • Chart.js integration for revenue trend
   • Badge / pill / countdown UI factories
   • Modal, toast, tab switching, and sidebar toggle logic

   All rendering functions consume data provided by SXData
   and output into DOM elements defined in admin.html.
═══════════════════════════════════════════════════════════ */

const SXAdmin = (() => {

  /* ────────────────────────────────────────────────────────
     BADGE & PILL FACTORIES
     Reusable UI micro-components for status indicators.
  ──────────────────────────────────────────────────────── */

  /** Colored payment method badge (UPI = blue, COD = yellow). */
  function payBadge(method) {
    const m = (method || 'COD').toUpperCase();
    if (m === 'UPI') return `<span class="badge upi">UPI</span>`;
    return `<span class="badge cod">COD</span>`;
  }

  /** Colored order status badge using effective status. */
  function statusBadge(order) {
    const st = SXData.effectiveStatus(order);
    if (st === 'delivered') return `<span class="badge delivered">DELIVERED</span>`;
    return `<span class="badge confirmed">CONFIRMED</span>`;
  }

  /** Auto-delivery countdown pill with live ticker. */
  function deliveryPill(order, cellId) {
    const ms = SXData.msUntilDelivery(order.createdAt);
    if (ms === 0 || order.status === 'delivered') {
      return `<span class="delivery-pill done">✓ Delivered</span>`;
    }
    const mins = Math.ceil(ms / 60000);
    const html = `<span class="delivery-pill" id="pill-${cellId}">⏱ ${mins}m left</span>`;
    setTimeout(() => startCountdown(order, cellId), 0);
    return html;
  }

  /* ── Live countdown timer management ── */
  const _countdownTimers = {};
  function startCountdown(order, cellId) {
    if (_countdownTimers[cellId]) clearInterval(_countdownTimers[cellId]);
    _countdownTimers[cellId] = setInterval(() => {
      const el = document.getElementById('pill-' + cellId);
      if (!el) { clearInterval(_countdownTimers[cellId]); return; }
      const ms = SXData.msUntilDelivery(order.createdAt);
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
     RENDER: METRICS CARDS
     Populates the 4 stat cards in the Overview tab.
  ──────────────────────────────────────────────────────── */
  function renderMetrics(data) {
    document.getElementById('s-rev').innerText  = '₹' + (data.totalRevenue || 0).toLocaleString();
    document.getElementById('s-ord').innerText  = data.totalOrders;
    document.getElementById('s-prod').innerText = data.totalProducts;
    document.getElementById('s-low').innerText  = data.lowStock.length;
  }

  /* ────────────────────────────────────────────────────────
     RENDER: RECENT ORDERS TABLE  (Overview — 6 cols)
     Shows the latest 8 orders with clickable rows.
  ──────────────────────────────────────────────────────── */
  function renderDashOrders(orders) {
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
        <td>${payBadge(o.paymentMethod)}</td>
        <td id="status-${cellId}">${statusBadge(o)}</td>
        <td>${deliveryPill(o, cellId)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ────────────────────────────────────────────────────────
     RENDER: ALL ORDERS TABLE  (Orders tab — 7 cols)
  ──────────────────────────────────────────────────────── */
  function renderAllOrders(orders) {
    const tbody = document.getElementById('dash-orders-full');
    tbody.innerHTML = '';
    orders.forEach((o, i) => {
      const cellId = 'all-' + i;
      const date = new Date(o.createdAt).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const tr = document.createElement('tr');
      tr.onclick = () => showOrderDetails(o.id);
      tr.innerHTML = `
        <td><span style="font-family:monospace;color:var(--gold)">${o.id}</span></td>
        <td>${date}</td>
        <td>${o.phone || '—'}</td>
        <td style="font-weight:700;color:#fff">₹${o.total.toLocaleString()}</td>
        <td>${payBadge(o.paymentMethod)}</td>
        <td id="status-${cellId}">${statusBadge(o)}</td>
        <td>${deliveryPill(o, cellId)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ────────────────────────────────────────────────────────
     RENDER: REVENUE CHART  (Chart.js line chart)
     Receives 7-day trend data [{date, revenue}, ...].
  ──────────────────────────────────────────────────────── */
  let _chartInstance = null;

  function renderRevenueChart(trendData) {
    const ctx = document.getElementById('revenue-chart');
    if (!ctx) return;

    const labels  = trendData.map(d => {
      const dt = new Date(d.date + 'T00:00:00');
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    const values = trendData.map(d => d.revenue);

    // Update badge with total
    const totalWeek = values.reduce((s, v) => s + v, 0);
    const badgeEl = document.getElementById('chart-total-badge');
    if (badgeEl) badgeEl.textContent = '₹' + totalWeek.toLocaleString() + ' this week';

    // Destroy previous chart if exists
    if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; }

    _chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue (₹)',
          data: values,
          fill: true,
          tension: 0.4,
          borderColor: '#F5A623',
          borderWidth: 2.5,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(245,166,35,0.1)';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(245,166,35,0.25)');
            gradient.addColorStop(1, 'rgba(245,166,35,0.0)');
            return gradient;
          },
          pointBackgroundColor: '#F5A623',
          pointBorderColor: '#000',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#F5A623',
          pointHoverBorderWidth: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleColor: '#F5A623',
            bodyColor: '#fff',
            borderColor: 'rgba(245,166,35,0.3)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (ctx) => '₹' + ctx.parsed.y.toLocaleString()
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: { color: '#666', font: { size: 12, family: 'Inter' } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: {
              color: '#666',
              font: { size: 12, family: 'Inter' },
              callback: (v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
            },
            beginAtZero: true
          }
        }
      }
    });
  }

  /* ────────────────────────────────────────────────────────
     RENDER: LOW STOCK ALERTS
     Products with stock < 6 shown as cards.
     Stock < 5 = critical (red highlight + pulse animation).
  ──────────────────────────────────────────────────────── */
  function renderLowStockAlerts(products) {
    const grid = document.getElementById('low-stock-grid');
    if (!grid) return;

    if (!products || products.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;padding:12px;">All products are well-stocked. 🎉</p>';
      return;
    }

    grid.innerHTML = '';
    products.forEach(p => {
      const isCritical = p.stock < 5;
      const card = document.createElement('div');
      card.className = 'low-stock-card' + (isCritical ? ' critical' : '');
      card.innerHTML = `
        <div class="low-stock-icon">${isCritical ? '🚨' : '⚠️'}</div>
        <div class="low-stock-info">
          <div class="low-stock-name">${p.name}</div>
          <div class="low-stock-stock">${p.stock} left in stock</div>
        </div>
        <button class="low-stock-restock" onclick="SXAdmin.goToInventory()">Restock →</button>
      `;
      grid.appendChild(card);
    });
  }

  /* ────────────────────────────────────────────────────────
     RENDER: INVENTORY TABLE  (Inventory tab)
  ──────────────────────────────────────────────────────── */
  function renderInventory(products) {
    const tbody = document.getElementById('dash-inventory');
    tbody.innerHTML = '';
    products.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td><span style="font-weight:600">${p.icon} ${p.name}</span></td>
        <td>₹${p.price.toLocaleString()}</td>
        <td>
          <input type="number" id="stock-input-${p.id}" value="${p.stock}"
            style="width:80px;padding:6px;background:rgba(0,0,0,0.4);border:1px solid #333;color:#fff;border-radius:4px;" />
        </td>
        <td>
          <button id="update-btn-${p.id}" onclick="SXData.updateStock(${p.id})"
            style="padding:6px 12px;background:var(--gold);border:none;border-radius:4px;color:#000;font-weight:600;cursor:pointer;min-width:80px;">
            Update
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ────────────────────────────────────────────────────────
     RENDER: USERS TABLE  (Users tab with expandable rows)
  ──────────────────────────────────────────────────────── */
  function renderUsers(users, orders) {
    const tbody = document.getElementById('dash-users');
    tbody.innerHTML = '';
    users.forEach((u, idx) => {
      const userOrders = orders.filter(o => o.userId === u.id);
      const spent = userOrders.reduce((s, o) => s + (o.total || 0), 0);
      const joined = new Date(u.createdAt).toLocaleDateString(undefined,
        { year: 'numeric', month: 'short', day: 'numeric' });

      const tr = document.createElement('tr');
      tr.id = `urow-${idx}`;
      tr.onclick = () => toggleUserExpand(idx, u, userOrders);
      tr.innerHTML = `
        <td style="width:32px;text-align:center;">
          <span class="expand-arrow" id="arrow-${idx}">▶</span>
        </td>
        <td style="font-weight:600">${u.name || '—'}</td>
        <td>${u.phone}</td>
        <td><span class="badge ${u.verified ? 'success' : 'danger'}">${u.verified ? 'VERIFIED' : 'PENDING'}</span></td>
        <td>${joined}</td>
        <td style="color:#fff;font-weight:600">${userOrders.length}</td>
        <td style="color:var(--gold);font-weight:700">${spent ? '₹' + spent.toLocaleString() : '—'}</td>
      `;
      tbody.appendChild(tr);

      // Hidden expandable row for user order history
      const expandTr = document.createElement('tr');
      expandTr.id = `uexpand-${idx}`;
      expandTr.className = 'user-row-expand';
      expandTr.style.display = 'none';
      expandTr.innerHTML = `<td colspan="7"><div class="user-expand-inner" id="uexpand-inner-${idx}"></div></td>`;
      tbody.appendChild(expandTr);
    });
  }

  /** Toggle user row expansion showing their order history. */
  function toggleUserExpand(idx, user, userOrders) {
    const expandRow = document.getElementById(`uexpand-${idx}`);
    const arrow     = document.getElementById(`arrow-${idx}`);
    const inner     = document.getElementById(`uexpand-inner-${idx}`);
    const isOpen    = expandRow.style.display !== 'none';

    if (isOpen) {
      expandRow.style.display = 'none';
      arrow.classList.remove('open');
      return;
    }

    let html = `
      <h4>👤 ${user.name || user.phone} — Account Details</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:16px;font-size:13px;color:#aaa;">
        <div><span style="color:#555">ID:</span> <span style="font-family:monospace;color:#666;font-size:11px">${user.id}</span></div>
        <div><span style="color:#555">Phone:</span> <span style="color:#ccc">${user.phone}</span></div>
        <div><span style="color:#555">Status:</span> <span style="color:${user.verified ? '#2ed573' : '#ff4757'}">${user.verified ? 'Verified' : 'Pending'}</span></div>
        <div><span style="color:#555">Joined:</span> <span style="color:#ccc">${new Date(user.createdAt).toLocaleString()}</span></div>
        ${user.address ? `<div style="grid-column:span 2"><span style="color:#555">Address:</span> <span style="color:#ccc">${user.address}</span></div>` : ''}
      </div>
      <h4>📦 Order History (${userOrders.length})</h4>
    `;

    if (userOrders.length === 0) {
      html += `<div style="color:#555;font-size:13px;padding:8px 0;">No orders placed yet.</div>`;
    } else {
      userOrders.forEach(o => {
        const st = SXData.effectiveStatus(o);
        const date = new Date(o.createdAt).toLocaleString(undefined,
          { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const itemNames = (o.items || []).map(it => it.name).join(', ') || '—';
        html += `
          <div class="user-order-card" onclick="event.stopPropagation(); SXAdmin.showOrderDetails('${o.id}')">
            <div>
              <div class="oid">${o.id}</div>
              <div style="color:#aaa;font-size:12px;margin-top:2px">${itemNames}</div>
              <div class="ometa">${date}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <span class="oamt">₹${o.total.toLocaleString()}</span>
              ${payBadge(o.paymentMethod)}
              ${st === 'delivered'
                ? `<span class="badge delivered" style="font-size:11px">DELIVERED</span>`
                : `<span class="badge confirmed" style="font-size:11px">CONFIRMED</span>`}
            </div>
          </div>
        `;
      });
    }

    inner.innerHTML = html;
    expandRow.style.display = 'table-row';
    arrow.classList.add('open');
  }

  /* ────────────────────────────────────────────────────────
     ORDER DETAIL MODAL
  ──────────────────────────────────────────────────────── */
  function showOrderDetails(id) {
    const o = SXData.allOrders.find(x => x.id === id);
    if (!o) return;
    const st = SXData.effectiveStatus(o);
    const date = new Date(o.createdAt).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const msLeft = SXData.msUntilDelivery(o.createdAt);
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

    let actionsHtml = '';
    // If order is cancelled, we shouldn't show action buttons.
    // If order is delivered, we also might not need to show them, but let's allow "Cancel" just in case, or maybe nothing if delivered.
    if (st !== 'cancelled' && st !== 'delivered') {
      actionsHtml = `
        <div style="margin-top: 24px; display: flex; gap: 10px; justify-content: flex-end;">
          <button id="btn-cancel-${o.id}" class="sx-save-btn" style="background:rgba(255,71,87,.15); color:#ff4757; border:1px solid rgba(255,71,87,.3); width:auto; padding:8px 16px; font-size:12px; box-shadow:none;" onclick="SXData.updateOrderStatus('${o.id}', 'cancelled', 'btn-cancel-${o.id}')">Cancel Order</button>
          
          <button id="btn-transit-${o.id}" class="sx-save-btn" style="background:rgba(30,200,255,.15); color:#1ec8ff; border:1px solid rgba(30,200,255,.3); width:auto; padding:8px 16px; font-size:12px; box-shadow:none;" onclick="SXData.updateOrderStatus('${o.id}', 'transit', 'btn-transit-${o.id}')">Mark Out for Delivery</button>

          <button id="btn-deliver-${o.id}" class="sx-save-btn" style="width:auto; padding:8px 16px; font-size:12px;" onclick="SXData.updateOrderStatus('${o.id}', 'delivered', 'btn-deliver-${o.id}')">Mark Delivered</button>
        </div>
      `;
    } else if (st === 'cancelled') {
      actionsHtml = `<div style="margin-top: 20px; text-align: right; color: #ff4757; font-weight: 600; font-size: 13px;">This order has been cancelled.</div>`;
    }

    document.getElementById('order-details-content').innerHTML = `
      <div class="sx-detail-row"><span class="sx-detail-label">Order ID</span>      <span class="sx-detail-val" style="font-family:monospace;color:var(--gold)">${o.id}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Date</span>           <span class="sx-detail-val">${date}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Customer</span>       <span class="sx-detail-val">${o.phone || '—'}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Address</span>        <span class="sx-detail-val">${o.address || '—'}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Payment</span>        <span class="sx-detail-val">${payBadge(o.paymentMethod)}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Total</span>          <span class="sx-detail-val" style="color:var(--gold);font-weight:700;font-size:16px">₹${o.total.toLocaleString()}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Status</span>         <span class="sx-detail-val">${statusBadge(o)}</span></div>
      <div class="sx-detail-row"><span class="sx-detail-label">Auto-Deliver</span>   <span class="sx-detail-val">${deliverInfo}</span></div>
      ${itemsHtml}
      ${actionsHtml}
    `;
    openModal('order-modal');
  }

  /* ────────────────────────────────────────────────────────
     TAB SWITCHING
     Controls which view is visible and triggers data fetches.
  ──────────────────────────────────────────────────────── */
  function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-' + tab).classList.add('active');
    ['dash', 'inventory', 'orders', 'users'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = 'none';
    });
    const titles = {
      dash: 'Dashboard Overview',
      inventory: 'Inventory Management',
      orders: 'All Orders',
      users: 'Registered Users'
    };
    document.getElementById('page-title').innerText = titles[tab] || '';
    document.getElementById('view-' + tab).style.display = 'block';

    // Fetch data for the selected tab
    if (tab === 'inventory') SXData.fetchInventory();
    else if (tab === 'orders') SXData.fetchAllOrders();
    else if (tab === 'users') SXData.fetchUsers();

    // Close sidebar on mobile after navigation
    closeSidebar();
  }

  /* ────────────────────────────────────────────────────────
     SIDEBAR TOGGLE  (responsive hamburger menu)
  ──────────────────────────────────────────────────────── */
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

  /* ────────────────────────────────────────────────────────
     MODAL HELPERS
  ──────────────────────────────────────────────────────── */
  function openModal(id)  { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  /* ────────────────────────────────────────────────────────
     TOAST NOTIFICATIONS
  ──────────────────────────────────────────────────────── */
  function showToast(msg, isError = false) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;
      background:#111;border-left:4px solid ${isError ? '#ff4757' : 'var(--gold)'};
      color:#fff;padding:14px 22px;border-radius:4px;font-size:14px;font-weight:500;
      box-shadow:0 4px 12px rgba(0,0,0,0.5);`;
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = 0; t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300); }, 2800);
  }

  /** Navigate to inventory tab (used by low-stock "Restock" buttons). */
  function goToInventory() {
    switchTab('inventory');
  }

  /* ────────────────────────────────────────────────────────
     PUBLIC API
  ──────────────────────────────────────────────────────── */
  return {
    // Rendering
    renderMetrics,
    renderDashOrders,
    renderAllOrders,
    renderRevenueChart,
    renderLowStockAlerts,
    renderInventory,
    renderUsers,

    // UI Actions
    switchTab,
    showOrderDetails,
    openSidebar,
    closeSidebar,
    openModal,
    closeModal,
    showToast,
    goToInventory,
  };
})();

// Expose globally
window.SXAdmin = SXAdmin;
