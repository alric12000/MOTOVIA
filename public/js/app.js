// Application State
let currentTab = 'dashboard';
let productsList = [];
let ordersList = [];
let expensesList = [];
let adSpendList = [];
let customersList = [];
let inventoryList = [];

// Pagination for Orders
let orderPage = 1;
const ordersPerPage = 10;

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  
  // Bind form listeners
  document.getElementById('orderForm').addEventListener('submit', (e) => e.preventDefault());
  document.getElementById('editOrderForm').addEventListener('submit', (e) => e.preventDefault());
  document.getElementById('expenseForm').addEventListener('submit', (e) => e.preventDefault());
  document.getElementById('adspendForm').addEventListener('submit', (e) => e.preventDefault());
  document.getElementById('customerForm').addEventListener('submit', (e) => e.preventDefault());
  document.getElementById('restockForm').addEventListener('submit', (e) => e.preventDefault());
});

// Toast Notifications helper
function showToast(message, type = 'success') {
  const toast = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.innerText = message;
  toast.className = 'toast active ' + type;
  
  if (type === 'success') {
    toastIcon.className = 'fa-solid fa-circle-check';
    toastIcon.style.color = 'var(--color-success)';
  } else if (type === 'danger') {
    toastIcon.className = 'fa-solid fa-circle-exclamation';
    toastIcon.style.color = 'var(--color-danger)';
  } else if (type === 'warning') {
    toastIcon.className = 'fa-solid fa-triangle-exclamation';
    toastIcon.style.color = 'var(--color-warning)';
  } else {
    toastIcon.className = 'fa-solid fa-circle-info';
    toastIcon.style.color = 'var(--color-primary)';
  }

  setTimeout(() => {
    toast.classList.remove('active');
  }, 4000);
}

// Session check
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await res.json();
    
    // Set user display
    document.getElementById('userNameDisplay').innerText = data.username;
    document.getElementById('userInitials').innerText = data.username.slice(0, 2).toUpperCase();
    
    // Initial data load
    await loadBaseData();
    switchTab('dashboard');
  } catch (err) {
    window.location.href = '/login.html';
  }
}

// Logout handler
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    showToast('Logged out successfully');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 500);
  } catch (err) {
    showToast('Error logging out', 'danger');
  }
}

// Pre-load supporting reference tables (e.g. Products list)
async function loadBaseData() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      productsList = await res.json();
      populateProductDropdowns();
    }
  } catch (err) {
    console.error('Failed to pre-fetch products:', err);
  }
}

// Populate product selections inside order forms
function populateProductDropdowns() {
  const orderDropdown = document.getElementById('orderProduct');
  const editDropdown = document.getElementById('editOrderProduct');

  if (orderDropdown && editDropdown) {
    let options = '<option value="">Select Product</option>';
    productsList.forEach(p => {
      options += `<option value="${p.id}">${p.name} (${p.sku})</option>`;
    });
    orderDropdown.innerHTML = options;
    editDropdown.innerHTML = options;
  }
}

// Handle Auto-fill Selling Price when Product is chosen
function handleProductChange(productId, priceInputId) {
  const priceInput = document.getElementById(priceInputId);
  if (!productId) {
    priceInput.value = '';
    return;
  }

  const selectedProd = productsList.find(p => p.id === parseInt(productId));
  if (selectedProd) {
    priceInput.value = selectedProd.default_selling_price;
  }
}

// TAB ROUTING & CONTROLLERS
function switchTab(tabName) {
  currentTab = tabName;

  // Toggle nav bar highlights
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-tab') === tabName) {
      item.classList.add('active');
    }
  });

  // Toggle view panels
  document.querySelectorAll('.tab-content').forEach(view => {
    view.classList.remove('active');
  });
  const activeView = document.getElementById(`${tabName}Tab`);
  if (activeView) activeView.classList.add('active');

  // Customize layout descriptions and dynamic headers
  const title = document.getElementById('viewTitle');
  const subtitle = document.getElementById('viewSubtitle');
  const headerActions = document.getElementById('headerActions');

  headerActions.innerHTML = ''; // reset action buttons

  if (tabName === 'dashboard') {
    title.innerText = 'Dashboard Overview';
    subtitle.innerText = 'Live business KPIs and summary trends.';
    headerActions.innerHTML = `<button class="btn-primary" onclick="openOrderModal()"><i class="fa-solid fa-plus"></i> New Order</button>`;
    fetchStats();
  } else if (tabName === 'orders') {
    title.innerText = 'Sales Orders';
    subtitle.innerText = 'Record, update, and audit all order placements.';
    headerActions.innerHTML = `<button class="btn-primary" onclick="openOrderModal()"><i class="fa-solid fa-plus"></i> Place Order</button>`;
    orderPage = 1;
    fetchOrders();
  } else if (tabName === 'expenses') {
    title.innerText = 'Expense Tracker';
    subtitle.innerText = 'Log packaging materials, salaries, utility bills, and other overheads.';
    headerActions.innerHTML = `<button class="btn-primary" onclick="openExpenseModal()"><i class="fa-solid fa-plus"></i> Log Expense</button>`;
    fetchExpenses();
  } else if (tabName === 'adspend') {
    title.innerText = 'Ad Spend Tracker';
    subtitle.innerText = 'Track advertising investments across digital channels.';
    headerActions.innerHTML = `<button class="btn-primary" onclick="openAdSpendModal()"><i class="fa-solid fa-plus"></i> Record Campaign</button>`;
    fetchAdSpend();
  } else if (tabName === 'customers') {
    title.innerText = 'Customer Database';
    subtitle.innerText = 'Centralized record of customer profiles, purchase history, and acquisition channels.';
    headerActions.innerHTML = `<button class="btn-primary" onclick="openCustomerModal()"><i class="fa-solid fa-plus"></i> Add Customer</button>`;
    fetchCustomers();
  } else if (tabName === 'inventory') {
    title.innerText = 'Inventory Hub';
    subtitle.innerText = 'Real-time tracking of item stocks, restocks, and automatic reorder alerts.';
    headerActions.innerHTML = `<button class="btn-primary" onclick="openProductModal()"><i class="fa-solid fa-plus"></i> Add Product</button>`;
    fetchInventory();
  } else if (tabName === 'pl') {
    title.innerText = 'Profit & Loss Statement';
    subtitle.innerText = 'Yearly monthly breakdown of gross sales, costs, margins, and net performance.';
    headerActions.innerHTML = `<button class="btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Export P&L</button>`;
    fetchPL();
  }
}

// 1. DASHBOARD COMPONENT
async function fetchStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) throw new Error('Failed to load stats');
    const stats = await res.json();

    // Render Metrics
    document.getElementById('statRevenue').innerText = 'Rs. ' + stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('statCOGS').innerText = 'Rs. ' + stats.totalCOGS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('statExpenses').innerText = 'Rs. ' + stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('statAdSpend').innerText = 'Rs. ' + stats.totalAdSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('statNetProfit').innerText = 'Rs. ' + stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Style profit positive/negative
    if (stats.netProfit < 0) {
      document.getElementById('statNetProfit').style.color = 'var(--color-danger)';
    } else {
      document.getElementById('statNetProfit').style.color = '#fff';
    }

    // Profit Margin
    const margin = stats.totalRevenue > 0 ? ((stats.netProfit / stats.totalRevenue) * 100) : 0;
    document.getElementById('statProfitMargin').innerText = `Profit Margin: ${margin.toFixed(1)}%`;
    
    document.getElementById('statOrders').innerText = stats.totalOrders;
    document.getElementById('statCustomers').innerText = stats.totalCustomers;
    document.getElementById('statLowStock').innerText = stats.lowStockItemsCount;

    // Red alert if low stock count > 0
    if (stats.lowStockItemsCount > 0) {
      document.getElementById('statLowStock').style.color = 'var(--color-danger)';
    } else {
      document.getElementById('statLowStock').style.color = 'var(--color-success)';
    }

    // Load visual charts
    renderDashboardCharts(stats.monthlyPerformance, stats.topProducts);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// 2. SALES ORDERS COMPONENT
async function fetchOrders() {
  const search = document.getElementById('orderSearch').value;
  const status = document.getElementById('orderFilterStatus').value;
  const platform = document.getElementById('orderFilterPlatform').value;

  let url = '/api/orders?';
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (status) url += `status=${status}&`;
  if (platform) url += `platform=${platform}&`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load orders');
    ordersList = await res.json();
    renderOrdersTable();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderOrdersTable() {
  const tbody = document.querySelector('#ordersTable tbody');
  tbody.innerHTML = '';

  const total = ordersList.length;
  const startIndex = (orderPage - 1) * ordersPerPage;
  const endIndex = Math.min(startIndex + ordersPerPage, total);
  
  document.getElementById('orderTableRange').innerText = `Showing ${total > 0 ? startIndex + 1 : 0}-${endIndex} of ${total} entries`;
  
  const pagedOrders = ordersList.slice(startIndex, endIndex);

  if (pagedOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--text-secondary);">No orders found.</td></tr>`;
    return;
  }

  pagedOrders.forEach(o => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--color-primary);">${o.id}</td>
      <td>${o.date}</td>
      <td>
        <div style="font-weight: 600;">${o.customer_name}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">${o.phone_number || '-'}</div>
      </td>
      <td>${o.product_name || 'Deleted Product'}</td>
      <td style="text-align: center;">${o.qty}</td>
      <td><i class="fa-brands fa-${o.platform.toLowerCase() === 'instagram' ? 'instagram' : o.platform.toLowerCase() === 'facebook' ? 'facebook' : 'hash'}"></i> ${o.platform}</td>
      <td>Rs. ${o.selling_price.toLocaleString()}</td>
      <td style="font-weight: 600;">Rs. ${o.revenue.toLocaleString()}</td>
      <td style="font-weight: 600; color: ${o.profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">Rs. ${o.profit.toLocaleString()}</td>
      <td>${o.payment_method}</td>
      <td><span class="badge ${o.delivery_status.toLowerCase()}">${o.delivery_status}</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon invoice" onclick="openInvoiceModal('${o.id}')" title="Generate Invoice"><i class="fa-solid fa-receipt"></i></button>
          <button class="btn-icon edit" onclick="openEditOrderModal('${o.id}')" title="Edit Order"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn-icon delete" onclick="deleteOrder('${o.id}')" title="Delete Order"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function prevOrderPage() {
  if (orderPage > 1) {
    orderPage--;
    renderOrdersTable();
  }
}

function nextOrderPage() {
  const maxPage = Math.ceil(ordersList.length / ordersPerPage);
  if (orderPage < maxPage) {
    orderPage++;
    renderOrdersTable();
  }
}

// Add Order Action
async function openOrderModal() {
  const modal = document.getElementById('orderModal');
  modal.classList.add('active');

  // Set today's date
  document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
  
  // Clean inputs
  document.getElementById('orderCustomer').value = '';
  document.getElementById('orderPhone').value = '';
  document.getElementById('orderAddress').value = '';
  document.getElementById('orderProduct').value = '';
  document.getElementById('orderQty').value = 1;
  document.getElementById('orderSellingPrice').value = '';
  document.getElementById('orderNotes').value = '';
  
  // Fetch next Order ID
  try {
    const res = await fetch('/api/orders/next-id');
    if (res.ok) {
      const data = await res.json();
      document.getElementById('orderId').value = data.nextId;
    }
  } catch (err) {
    document.getElementById('orderId').value = 'ORD-XXXX';
  }
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.remove('active');
}

async function submitOrder() {
  const payload = {
    date: document.getElementById('orderDate').value,
    customer_name: document.getElementById('orderCustomer').value.trim(),
    phone_number: document.getElementById('orderPhone').value.trim(),
    address: document.getElementById('orderAddress').value.trim(),
    product_id: parseInt(document.getElementById('orderProduct').value),
    qty: parseInt(document.getElementById('orderQty').value),
    selling_price: parseFloat(document.getElementById('orderSellingPrice').value),
    platform: document.getElementById('orderPlatform').value,
    payment_method: document.getElementById('orderPayment').value,
    delivery_status: document.getElementById('orderStatus').value,
    notes: document.getElementById('orderNotes').value.trim()
  };

  if (!payload.customer_name || !payload.product_id || isNaN(payload.selling_price)) {
    showToast('Please fill out all required fields.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('New order created successfully.');
      closeOrderModal();
      if (currentTab === 'orders') fetchOrders();
      else if (currentTab === 'dashboard') fetchStats();
      // Reload products list to update inventory metrics inside front memory
      loadBaseData();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to place order', 'danger');
    }
  } catch (err) {
    showToast('Network error saving order.', 'danger');
  }
}

// Edit Order Actions
function openEditOrderModal(orderId) {
  const order = ordersList.find(o => o.id === orderId);
  if (!order) return;

  const modal = document.getElementById('editOrderModal');
  document.getElementById('editOrderTitleId').innerText = `(${orderId})`;
  document.getElementById('editOrderId').value = orderId;
  document.getElementById('editOrderDate').value = order.date;
  document.getElementById('editOrderCustomer').value = order.customer_name;
  document.getElementById('editOrderPhone').value = order.phone_number || '';
  document.getElementById('editOrderAddress').value = order.address || '';
  document.getElementById('editOrderProduct').value = order.product_id;
  document.getElementById('editOrderQty').value = order.qty;
  document.getElementById('editOrderSellingPrice').value = order.selling_price;
  document.getElementById('editOrderPlatform').value = order.platform;
  document.getElementById('editOrderPayment').value = order.payment_method;
  document.getElementById('editOrderStatus').value = order.delivery_status;
  document.getElementById('editOrderNotes').value = order.notes || '';

  modal.classList.add('active');
}

function closeEditOrderModal() {
  document.getElementById('editOrderModal').classList.remove('active');
}

async function submitEditOrder() {
  const orderId = document.getElementById('editOrderId').value;
  const payload = {
    date: document.getElementById('editOrderDate').value,
    customer_name: document.getElementById('editOrderCustomer').value.trim(),
    phone_number: document.getElementById('editOrderPhone').value.trim(),
    address: document.getElementById('editOrderAddress').value.trim(),
    product_id: parseInt(document.getElementById('editOrderProduct').value),
    qty: parseInt(document.getElementById('editOrderQty').value),
    selling_price: parseFloat(document.getElementById('editOrderSellingPrice').value),
    platform: document.getElementById('editOrderPlatform').value,
    payment_method: document.getElementById('editOrderPayment').value,
    delivery_status: document.getElementById('editOrderStatus').value,
    notes: document.getElementById('editOrderNotes').value.trim()
  };

  try {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Order details updated.');
      closeEditOrderModal();
      fetchOrders();
      loadBaseData();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update order', 'danger');
    }
  } catch (err) {
    showToast('Network error saving changes.', 'danger');
  }
}

// Delete Order Action
async function deleteOrder(orderId) {
  if (!confirm(`Are you sure you want to permanently delete order ${orderId}?`)) return;

  try {
    const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Order deleted successfully.');
      fetchOrders();
      loadBaseData();
    } else {
      showToast('Failed to delete order.', 'danger');
    }
  } catch (err) {
    showToast('Network error.', 'danger');
  }
}

// 3. EXPENSES COMPONENT
async function fetchExpenses() {
  try {
    const res = await fetch('/api/expenses');
    if (!res.ok) throw new Error('Failed to load expenses');
    expensesList = await res.json();
    renderExpensesTable();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderExpensesTable() {
  const tbody = document.querySelector('#expensesTable tbody');
  tbody.innerHTML = '';

  if (expensesList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No expenses recorded.</td></tr>`;
    return;
  }

  expensesList.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.date}</td>
      <td><span class="badge" style="background-color: rgba(245,158,11,0.15); color: var(--color-warning);">${e.category}</span></td>
      <td>${e.description}</td>
      <td style="font-weight: 600;">Rs. ${e.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
      <td>${e.payment_method}</td>
      <td>
        <button class="btn-icon delete" onclick="deleteExpense(${e.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openExpenseModal() {
  const modal = document.getElementById('expenseModal');
  modal.classList.add('active');
  document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDesc').value = '';
  document.getElementById('expenseAmount').value = '';
}

function closeExpenseModal() {
  document.getElementById('expenseModal').classList.remove('active');
}

async function submitExpense() {
  const payload = {
    date: document.getElementById('expenseDate').value,
    category: document.getElementById('expenseCategory').value,
    description: document.getElementById('expenseDesc').value.trim(),
    amount: parseFloat(document.getElementById('expenseAmount').value),
    payment_method: document.getElementById('expensePayment').value
  };

  if (!payload.date || !payload.description || isNaN(payload.amount)) {
    showToast('Please fill out all required fields.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Expense recorded successfully.');
      closeExpenseModal();
      fetchExpenses();
    } else {
      showToast('Failed to record expense.', 'danger');
    }
  } catch (err) {
    showToast('Network error.', 'danger');
  }
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense record?')) return;
  try {
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Expense record deleted.');
      fetchExpenses();
    } else {
      showToast('Failed to delete.', 'danger');
    }
  } catch (err) {
    showToast('Network error.', 'danger');
  }
}

// 4. AD SPEND COMPONENT
async function fetchAdSpend() {
  try {
    const res = await fetch('/api/adspend');
    if (!res.ok) throw new Error('Failed to load ad spend');
    adSpendList = await res.json();
    renderAdSpendTable();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderAdSpendTable() {
  const tbody = document.querySelector('#adspendTable tbody');
  tbody.innerHTML = '';

  if (adSpendList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No ad campaigns logged.</td></tr>`;
    return;
  }

  adSpendList.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${a.date}</td>
      <td><span class="badge" style="background-color: rgba(59,130,246,0.15); color: var(--color-info);"><i class="fa-brands fa-${a.platform.toLowerCase()}"></i> ${a.platform}</span></td>
      <td style="font-weight: 600;">${a.campaign}</td>
      <td style="font-weight: 600;">Rs. ${a.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
      <td>${a.notes_objective || '-'}</td>
      <td>
        <button class="btn-icon delete" onclick="deleteAdSpend(${a.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openAdSpendModal() {
  const modal = document.getElementById('adspendModal');
  modal.classList.add('active');
  document.getElementById('adDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('adCampaign').value = '';
  document.getElementById('adAmount').value = '';
  document.getElementById('adNotes').value = '';
}

function closeAdSpendModal() {
  document.getElementById('adspendModal').classList.remove('active');
}

async function submitAdSpend() {
  const payload = {
    date: document.getElementById('adDate').value,
    platform: document.getElementById('adPlatform').value,
    campaign: document.getElementById('adCampaign').value.trim(),
    amount: parseFloat(document.getElementById('adAmount').value),
    notes_objective: document.getElementById('adNotes').value.trim()
  };

  if (!payload.date || !payload.campaign || isNaN(payload.amount)) {
    showToast('Please fill out all required fields.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/adspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Advertising campaign logged successfully.');
      closeAdSpendModal();
      fetchAdSpend();
    } else {
      showToast('Failed to record ad spend.', 'danger');
    }
  } catch (err) {
    showToast('Network error.', 'danger');
  }
}

async function deleteAdSpend(id) {
  if (!confirm('Delete this advertising spend record?')) return;
  try {
    const res = await fetch(`/api/adspend/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Campaign record deleted.');
      fetchAdSpend();
    } else {
      showToast('Failed to delete.', 'danger');
    }
  } catch (err) {
    showToast('Network error.', 'danger');
  }
}

// 5. CUSTOMERS COMPONENT
async function fetchCustomers() {
  try {
    const res = await fetch('/api/customers');
    if (!res.ok) throw new Error('Failed to load customers');
    customersList = await res.json();
    renderCustomersTable();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderCustomersTable() {
  const tbody = document.querySelector('#customersTable tbody');
  tbody.innerHTML = '';

  if (customersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary);">No customers in database.</td></tr>`;
    return;
  }

  // Sort by Customer ID
  customersList.sort((a, b) => a.id.localeCompare(b.id));

  customersList.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--color-primary);">${c.id}</td>
      <td style="font-weight: 600;">${c.name}</td>
      <td>${c.phone}</td>
      <td>${c.address}</td>
      <td><span class="badge" style="background-color: rgba(255,255,255,0.05); color: var(--text-primary);">${c.platform}</span></td>
      <td style="text-align: center; font-weight: 600;">${c.total_orders}</td>
      <td style="font-weight: 600;">Rs. ${c.total_spent.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
      <td>${c.last_order_date}</td>
      <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.notes || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openCustomerModal() {
  const modal = document.getElementById('customerModal');
  modal.classList.add('active');
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  document.getElementById('custAddress').value = '';
  document.getElementById('custNotes').value = '';
}

function closeCustomerModal() {
  document.getElementById('customerModal').classList.remove('active');
}

async function submitCustomer() {
  const payload = {
    name: document.getElementById('custName').value.trim(),
    phone: document.getElementById('custPhone').value.trim(),
    address: document.getElementById('custAddress').value.trim(),
    platform: document.getElementById('custPlatform').value,
    notes: document.getElementById('custNotes').value.trim()
  };

  if (!payload.name) {
    showToast('Customer Name is required.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Customer record added.');
      closeCustomerModal();
      fetchCustomers();
    } else {
      showToast('Failed to save customer.', 'danger');
    }
  } catch (err) {
    showToast('Network error.', 'danger');
  }
}

// 6. INVENTORY COMPONENT
async function fetchInventory() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to load inventory');
    inventoryList = await res.json();
    renderInventoryTable();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderInventoryTable() {
  const tbody = document.querySelector('#inventoryTable tbody');
  tbody.innerHTML = '';

  if (inventoryList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-secondary);">No products set up.</td></tr>`;
    return;
  }

  inventoryList.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--color-primary);">${p.sku}</td>
      <td style="font-weight: 600;">${p.name}</td>
      <td>${p.category || '-'}</td>
      <td style="text-align: center;">${p.opening_stock}</td>
      <td style="text-align: center; color: var(--color-success); font-weight: 600;">+${p.restocked_qty}</td>
      <td style="text-align: center; color: var(--color-danger); font-weight: 600;">-${p.sold_qty}</td>
      <td style="text-align: center; font-weight: 700; font-size: 1rem;">${p.remaining_stock}</td>
      <td style="text-align: center;">${p.reorder_level}</td>
      <td><span class="badge ${p.stock_status === 'LOW STOCK' ? 'low-stock' : 'ok'}">${p.stock_status}</span></td>
      <td>
        <button class="btn-primary" style="padding: 6px 12px; font-size: 0.75rem; border-radius: 4px;" onclick="openRestockModal(${p.id})">
          <i class="fa-solid fa-plus-circle"></i> Restock
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openRestockModal(productId) {
  const product = inventoryList.find(p => p.id === productId);
  if (!product) return;

  const modal = document.getElementById('restockModal');
  document.getElementById('restockProductId').value = productId;
  document.getElementById('restockProductName').value = product.name;
  document.getElementById('restockDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('restockQty').value = '';
  document.getElementById('restockNotes').value = '';

  modal.classList.add('active');
}

function closeRestockModal() {
  document.getElementById('restockModal').classList.remove('active');
}

async function submitRestock() {
  const payload = {
    product_id: parseInt(document.getElementById('restockProductId').value),
    qty: parseInt(document.getElementById('restockQty').value),
    date: document.getElementById('restockDate').value,
    notes: document.getElementById('restockNotes').value.trim()
  };

  if (isNaN(payload.qty) || payload.qty <= 0 || !payload.date) {
    showToast('Please enter a valid date and quantity.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/inventory/restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Restocking successfully logged.');
      closeRestockModal();
      fetchInventory();
    } else {
      showToast('Failed to record restock.', 'danger');
    }
  } catch (err) {
    showToast('Network error.', 'danger');
  }
}

// 7. P&L STATEMENT COMPONENT
async function fetchPL() {
  try {
    const res = await fetch('/api/pl');
    if (!res.ok) throw new Error('Failed to load P&L');
    const plReports = await res.json();
    renderPLTable(plReports);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderPLTable(reports) {
  const tbody = document.querySelector('#plTable tbody');
  tbody.innerHTML = '';

  // Aggregated totals
  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalGrossProfit = 0;
  let totalExpenses = 0;
  let totalAdSpend = 0;
  let totalNetProfit = 0;

  reports.forEach(r => {
    // Skip rendering months that have absolutely zero entries to keep view clean,
    // but keep July/August since we seeded them.
    // To match user experience, let's render all months, but only calculate totals.
    totalRevenue += r.revenue;
    totalCOGS += r.cogs;
    totalGrossProfit += r.grossProfit;
    totalExpenses += r.expenses;
    totalAdSpend += r.adSpend;
    totalNetProfit += r.netProfit;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600;">${r.monthName}</td>
      <td>${r.revenue > 0 ? 'Rs. ' + r.revenue.toLocaleString() : '-'}</td>
      <td>${r.cogs > 0 ? 'Rs. ' + r.cogs.toLocaleString() : '-'}</td>
      <td style="font-weight: 600;">${r.grossProfit > 0 ? 'Rs. ' + r.grossProfit.toLocaleString() : r.grossProfit < 0 ? 'Rs. ' + r.grossProfit.toLocaleString() : '-'}</td>
      <td>${r.expenses > 0 ? 'Rs. ' + r.expenses.toLocaleString() : '-'}</td>
      <td>${r.adSpend > 0 ? 'Rs. ' + r.adSpend.toLocaleString() : '-'}</td>
      <td class="pl-net-profit" style="color: ${r.netProfit > 0 ? 'var(--color-success)' : r.netProfit < 0 ? 'var(--color-danger)' : 'inherit'}">
        ${r.netProfit !== 0 ? 'Rs. ' + r.netProfit.toLocaleString() : '-'}
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Append Total Row
  const totalTr = document.createElement('tr');
  totalTr.className = 'pl-row-highlight';
  totalTr.innerHTML = `
    <td>TOTAL</td>
    <td>Rs. ${totalRevenue.toLocaleString()}</td>
    <td>Rs. ${totalCOGS.toLocaleString()}</td>
    <td>Rs. ${totalGrossProfit.toLocaleString()}</td>
    <td>Rs. ${totalExpenses.toLocaleString()}</td>
    <td>Rs. ${totalAdSpend.toLocaleString()}</td>
    <td style="font-size: 1rem; color: ${totalNetProfit > 0 ? 'var(--color-success)' : totalNetProfit < 0 ? 'var(--color-danger)' : 'inherit'}">
      Rs. ${totalNetProfit.toLocaleString()}
    </td>
  `;
  tbody.appendChild(totalTr);
}

// 8. INVOICE MODAL LOGIC
function openInvoiceModal(orderId) {
  // Let's fetch orders locally from our ordersList
  const order = ordersList.find(o => o.id === orderId);
  if (!order) return;

  document.getElementById('invId').innerText = order.id;
  document.getElementById('invDate').innerText = order.date;
  document.getElementById('invCustomerName').innerText = order.customer_name;
  document.getElementById('invCustomerPhone').innerText = 'Phone: ' + (order.phone_number || '-');
  document.getElementById('invCustomerAddress').innerText = 'Address: ' + (order.address || '-');
  document.getElementById('invPaymentMethod').innerText = order.payment_method;
  document.getElementById('invPlatform').innerText = order.platform;
  document.getElementById('invDeliveryStatus').innerText = order.delivery_status;
  
  // Style status badge on printed invoice
  const statusEl = document.getElementById('invDeliveryStatus');
  if (order.delivery_status === 'Delivered') statusEl.style.color = '#10b981';
  else if (order.delivery_status === 'Cancelled') statusEl.style.color = '#ef4444';
  else statusEl.style.color = '#f59e0b';

  // Details
  document.getElementById('invProductDesc').innerText = order.product_name || 'Item Code ' + order.product_id;
  document.getElementById('invQty').innerText = order.qty;
  document.getElementById('invUnitPrice').innerText = order.selling_price.toLocaleString(undefined, {minimumFractionDigits: 2});
  
  const totalAmount = order.qty * order.selling_price;
  document.getElementById('invLineTotal').innerText = totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2});
  document.getElementById('invSubtotal').innerText = totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2});
  document.getElementById('invGrandTotal').innerText = totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2});

  document.getElementById('invoiceModal').classList.add('active');
}

function closeInvoiceModal() {
  document.getElementById('invoiceModal').classList.remove('active');
}

function printInvoice() {
  window.print();
}
