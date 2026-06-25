/* ═══════════════════════════════════════════════════════════
   SPORTX ADMIN — Data Layer  (js/admin-data.js)
   ─────────────────────────────────────────────────────────
   Responsibilities:
   • Global state management (allOrders, allUsers, lowStockProducts)
   • API fetch functions for all dashboard views
   • Utility / helper functions (time calculations, formatting)

   Data Flow:
   1. On page load → fetchStats() + fetchDashboardData()
   2. Stats response populates metric cards via SXAdmin.renderMetrics()
   3. Orders response populates the recent-orders table and revenue chart
   4. Tab switches trigger view-specific fetches (inventory, users, etc.)
   5. A 30-second auto-refresh keeps the Overview tab live.
═══════════════════════════════════════════════════════════ */

const SXData = (() => {

  /* ────────────────────────────────────────────────────────
     GLOBAL STATE
     Shared across all views. Updated by fetch functions.
  ──────────────────────────────────────────────────────── */
  let allOrders  = [];
  let allUsers   = [];
  let lowStockProducts = [];

  /* ────────────────────────────────────────────────────────
     TIME / DELIVERY UTILITIES
  ──────────────────────────────────────────────────────── */
  const ONE_HOUR = 60 * 60 * 1000;

  /** Milliseconds remaining until an order auto-delivers (1-hour window). */
  function msUntilDelivery(createdAt) {
    return Math.max(0, new Date(createdAt).getTime() + ONE_HOUR - Date.now());
  }

  /** True when the order has passed the 1-hour delivery window. */
  function shouldBeDelivered(order) {
    return order.status === 'delivered' || msUntilDelivery(order.createdAt) === 0;
  }

  /** Returns the effective status factoring in auto-delivery logic. */
  function effectiveStatus(order) {
    return shouldBeDelivered(order) ? 'delivered' : order.status;
  }

  /* ────────────────────────────────────────────────────────
     API: STATS  (Overview metric cards)
  ──────────────────────────────────────────────────────── */
  async function fetchStats() {
    try {
      const res  = await fetch('/api/stats');
      const json = await res.json();
      if (json.success) {
        lowStockProducts = json.data.lowStock || [];
        // Delegate rendering to the components layer
        SXAdmin.renderMetrics(json.data);
        SXAdmin.renderLowStockAlerts(lowStockProducts);
      }
    } catch (e) { console.error('Stats fetch error:', e); }
  }

  /* ────────────────────────────────────────────────────────
     API: DASHBOARD DATA  (recent orders + revenue chart)
     Fetches from /api/admin/orders (no auth required).
  ──────────────────────────────────────────────────────── */
  async function fetchDashboardData() {
    const tbody = document.getElementById('dash-orders');
    SXLoading.showTableSkeletons(tbody, 5, 6, ['18%','18%','12%','12%','12%','14%']);
    try {
      // Fetch all orders and revenue trend in parallel
      const [ordRes, trendRes] = await Promise.all([
        fetch('/api/admin/orders'),
        fetch('/api/admin/revenue-trend')
      ]);
      const ordJson   = await ordRes.json();
      const trendJson = await trendRes.json();

      if (ordJson.success && ordJson.data.length > 0) {
        allOrders = ordJson.data;
        SXLoading.reveal(tbody, () => SXAdmin.renderDashOrders(ordJson.data.slice(0, 8)));
      } else {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No recent orders.</td></tr>';
      }

      // Render revenue chart from trend data
      if (trendJson.success) {
        SXAdmin.renderRevenueChart(trendJson.data);
      }
    } catch (e) { console.error('Dashboard data error:', e); }
  }

  /* ────────────────────────────────────────────────────────
     API: ALL ORDERS  (Orders tab — 7 columns)
  ──────────────────────────────────────────────────────── */
  async function fetchAllOrders() {
    const tbody = document.getElementById('dash-orders-full');
    SXLoading.showTableSkeletons(tbody, 8, 7, ['18%','15%','12%','10%','10%','10%','12%']);
    try {
      const res  = await fetch('/api/admin/orders');
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        allOrders = json.data;
        SXLoading.reveal(tbody, () => SXAdmin.renderAllOrders(json.data));
      } else {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No orders yet.</td></tr>';
      }
    } catch (e) { console.error(e); }
  }

  /* ────────────────────────────────────────────────────────
     API: INVENTORY  (Inventory tab)
  ──────────────────────────────────────────────────────── */
  async function fetchInventory() {
    const tbody = document.getElementById('dash-inventory');
    SXLoading.showTableSkeletons(tbody, 6, 5, ['8%','32%','16%','18%','14%']);
    try {
      const res  = await fetch('/api/products');
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        SXLoading.reveal(tbody, () => SXAdmin.renderInventory(json.data));
      } else {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No products found.</td></tr>';
      }
    } catch (e) { console.error(e); }
  }

  /* ────────────────────────────────────────────────────────
     API: USERS  (Users tab — with expandable history)
  ──────────────────────────────────────────────────────── */
  async function fetchUsers() {
    const tbody = document.getElementById('dash-users');
    SXLoading.showTableSkeletons(tbody, 5, 7, ['5%','20%','18%','12%','16%','10%','10%']);
    try {
      const [uRes, oRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/orders')
      ]);
      const uJson = await uRes.json();
      const oJson = await oRes.json();
      if (uJson.success && uJson.data.length > 0) {
        allUsers  = uJson.data;
        allOrders = oJson.success ? oJson.data : [];
        SXLoading.reveal(tbody, () => SXAdmin.renderUsers(allUsers, allOrders));
      } else {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No registered users yet.</td></tr>';
      }
    } catch (e) {
      document.getElementById('dash-users').innerHTML =
        '<tr><td colspan="7" class="empty-state">Could not load users.</td></tr>';
    }
  }

  /* ────────────────────────────────────────────────────────
     API: UPDATE STOCK  (Inventory tab action)
  ──────────────────────────────────────────────────────── */
  async function updateStock(id) {
    const stock = document.getElementById(`stock-input-${id}`).value;
    const btn   = document.getElementById(`update-btn-${id}`);
    await SXLoading.buttonAction(btn, async () => {
      const res  = await fetch(`/api/products/${id}/stock`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: parseInt(stock, 10) })
      });
      const json = await res.json();
      if (json.success) { SXAdmin.showToast('Stock updated!'); fetchStats(); }
      else               SXAdmin.showToast('Failed to update stock', true);
    }, 'gold');
  }

  /* ────────────────────────────────────────────────────────
     API: UPDATE ORDER STATUS
  ──────────────────────────────────────────────────────── */
  async function updateOrderStatus(id, status, btnId) {
    const btn = document.getElementById(btnId);
    await SXLoading.buttonAction(btn, async () => {
      const res = await fetch(`/api/admin/order-status/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const json = await res.json();
      if (json.success) {
        SXAdmin.showToast('Order status updated!');
        // Refresh whichever view we're on
        fetchDashboardData();
        fetchAllOrders();
        // Close modal if open
        SXAdmin.closeModal('order-modal');
      } else {
        SXAdmin.showToast(json.message || 'Failed to update order', true);
      }
    }, 'gold');
  }

  /* ────────────────────────────────────────────────────────
     PUBLIC API
  ──────────────────────────────────────────────────────── */
  return {
    // State accessors
    get allOrders()  { return allOrders; },
    get allUsers()   { return allUsers; },
    set allOrders(v) { allOrders = v; },

    // Utilities
    msUntilDelivery,
    shouldBeDelivered,
    effectiveStatus,

    // Fetch functions
    fetchStats,
    fetchDashboardData,
    fetchAllOrders,
    fetchInventory,
    fetchUsers,
    updateStock,
    updateOrderStatus,
  };
})();

// Expose globally
window.SXData = SXData;
