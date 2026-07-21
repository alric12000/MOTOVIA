const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'motovia_secret_key_12345';

function initializeFirebase() {
  if (admin.apps.length > 0) {
    return;
  }

  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON;
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (keyJson) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(keyJson))
    });
    return;
  }

  if (keyPath) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    return;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

initializeFirebase();
const db = admin.firestore();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7);
}

function orderNumber(orderId) {
  const match = String(orderId || '').match(/ORD-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function customerNumber(customerId) {
  const match = String(customerId || '').match(/CUST-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function getCollectionDocs(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ ...doc.data() }));
}

async function getNextCounter(counterName, startAt = 1) {
  const countersRef = db.collection('meta').doc('counters');

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(countersRef);
    const data = snap.exists ? snap.data() : {};
    const currentValue = Number.isInteger(data[counterName]) ? data[counterName] : (startAt - 1);
    const nextValue = currentValue + 1;
    tx.set(countersRef, { [counterName]: nextValue }, { merge: true });
    return nextValue;
  });
}

async function getNextOrderId() {
  const orders = await getCollectionDocs('orders');
  const maxOrderNum = orders.reduce((acc, order) => Math.max(acc, orderNumber(order.id)), 1000);
  return `ORD-${maxOrderNum + 1}`;
}

async function getNextCustomerId() {
  const customers = await getCollectionDocs('customers');
  const maxCustomerNum = customers.reduce((acc, customer) => Math.max(acc, customerNumber(customer.id)), 0);
  return `CUST-${String(maxCustomerNum + 1).padStart(3, '0')}`;
}

async function ensureSeedData() {
  const adminRef = db.collection('users').doc('admin');
  const adminSnap = await adminRef.get();
  if (!adminSnap.exists) {
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);
    await adminRef.set({
      id: 1,
      username: 'admin',
      password_hash: adminHash
    });
  }

  const products = await getCollectionDocs('products');
  if (products.length === 0) {
    const seedProducts = [
      { id: 1, name: 'Combo Wash', sku: 'WASH-COMBO', category: 'Wash Services & Kits', cost_price: 871.0, default_selling_price: 1750.0, opening_stock: 100, reorder_level: 15 },
      { id: 2, name: 'Foam X', sku: 'FOAM-X', category: 'Shampoo', cost_price: 645.0, default_selling_price: 1499.0, opening_stock: 80, reorder_level: 10 },
      { id: 3, name: 'Talo', sku: 'TALO-WAX', category: 'Wax & Polish', cost_price: 300.0, default_selling_price: 600.0, opening_stock: 50, reorder_level: 8 },
      { id: 4, name: 'Samphoo', sku: 'SHAMPOO-CAR', category: 'Shampoo', cost_price: 400.0, default_selling_price: 800.0, opening_stock: 60, reorder_level: 10 }
    ];

    const batch = db.batch();
    seedProducts.forEach((product) => {
      batch.set(db.collection('products').doc(String(product.id)), product);
    });
    batch.set(db.collection('meta').doc('counters'), { product_id: 4 }, { merge: true });
    await batch.commit();
  }

  const customerRef = db.collection('customers').doc('CUST-001');
  const customerSnap = await customerRef.get();
  if (!customerSnap.exists) {
    await customerRef.set({
      id: 'CUST-001',
      name: 'Sita Sharma',
      phone: '98XXXXXXXX',
      address: 'Kathmandu',
      platform: 'TikTok Shop',
      notes: 'First customer seed'
    });
  }
}

const authenticateToken = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Session expired. Please log in again.' });
    }
    req.user = user;
    next();
  });
};

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const userSnap = await db.collection('users').doc(username).get();
    if (!userSnap.exists) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const user = userSnap.data();
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 });
    return res.json({ message: 'Login successful', username: user.username });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Login error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ username: req.user.username });
});

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const [orders, expenses, adSpend, products, restocks, manualCustomers] = await Promise.all([
      getCollectionDocs('orders'),
      getCollectionDocs('expenses'),
      getCollectionDocs('ad_spend'),
      getCollectionDocs('products'),
      getCollectionDocs('restock_history'),
      getCollectionDocs('customers')
    ]);

    const activeOrders = orders.filter((order) => order.delivery_status !== 'Cancelled');

    const totalRevenue = activeOrders.reduce((sum, order) => sum + ((Number(order.qty) || 0) * (Number(order.selling_price) || 0)), 0);
    const totalCOGS = activeOrders.reduce((sum, order) => sum + ((Number(order.qty) || 0) * (Number(order.cost_price) || 0)), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    const totalAdSpend = adSpend.reduce((sum, ad) => sum + (Number(ad.amount) || 0), 0);
    const netProfit = totalRevenue - totalCOGS - totalExpenses - totalAdSpend;

    const distinctOrderCustomers = new Set(orders.map((order) => (order.customer_name || '').trim().toLowerCase()).filter(Boolean));
    const manualOnlyCount = manualCustomers.filter((customer) => !distinctOrderCustomers.has((customer.name || '').trim().toLowerCase())).length;
    const totalCustomers = distinctOrderCustomers.size + manualOnlyCount;

    const soldByProductId = {};
    activeOrders.forEach((order) => {
      const productId = Number(order.product_id);
      soldByProductId[productId] = (soldByProductId[productId] || 0) + (Number(order.qty) || 0);
    });

    const restockedByProductId = {};
    restocks.forEach((restock) => {
      const productId = Number(restock.product_id);
      restockedByProductId[productId] = (restockedByProductId[productId] || 0) + (Number(restock.qty) || 0);
    });

    let lowStockItemsCount = 0;
    products.forEach((product) => {
      const productId = Number(product.id);
      const soldQty = soldByProductId[productId] || 0;
      const restockedQty = restockedByProductId[productId] || 0;
      const remaining = (Number(product.opening_stock) || 0) + restockedQty - soldQty;
      if (remaining <= (Number(product.reorder_level) || 0)) {
        lowStockItemsCount += 1;
      }
    });

    const monthlyPerformance = {};
    activeOrders.forEach((order) => {
      const month = monthKey(order.date);
      if (!month) return;
      monthlyPerformance[month] = monthlyPerformance[month] || { revenue: 0, cogs: 0, expenses: 0, adspend: 0, netProfit: 0 };
      monthlyPerformance[month].revenue += (Number(order.qty) || 0) * (Number(order.selling_price) || 0);
      monthlyPerformance[month].cogs += (Number(order.qty) || 0) * (Number(order.cost_price) || 0);
    });

    expenses.forEach((expense) => {
      const month = monthKey(expense.date);
      if (!month) return;
      monthlyPerformance[month] = monthlyPerformance[month] || { revenue: 0, cogs: 0, expenses: 0, adspend: 0, netProfit: 0 };
      monthlyPerformance[month].expenses += Number(expense.amount) || 0;
    });

    const adSpendByPlatform = {};
    adSpend.forEach((entry) => {
      const month = monthKey(entry.date);
      if (month) {
        monthlyPerformance[month] = monthlyPerformance[month] || { revenue: 0, cogs: 0, expenses: 0, adspend: 0, netProfit: 0 };
        monthlyPerformance[month].adspend += Number(entry.amount) || 0;
      }

      const platform = entry.platform || 'Other';
      adSpendByPlatform[platform] = (adSpendByPlatform[platform] || 0) + (Number(entry.amount) || 0);
    });

    Object.keys(monthlyPerformance).forEach((month) => {
      const row = monthlyPerformance[month];
      row.netProfit = row.revenue - row.cogs - row.expenses - row.adspend;
    });

    const productNameById = {};
    products.forEach((product) => {
      productNameById[Number(product.id)] = product.name;
    });

    const topProductMap = {};
    activeOrders.forEach((order) => {
      const name = productNameById[Number(order.product_id)] || 'Unknown';
      topProductMap[name] = (topProductMap[name] || 0) + (Number(order.qty) || 0);
    });

    const topProducts = Object.entries(topProductMap)
      .map(([name, total_qty]) => ({ name, total_qty }))
      .sort((a, b) => b.total_qty - a.total_qty);

    return res.json({
      totalRevenue,
      totalCOGS,
      totalExpenses,
      totalAdSpend,
      netProfit,
      totalOrders: activeOrders.length,
      totalCustomers,
      lowStockItemsCount,
      monthlyPerformance,
      topProducts,
      adSpendByPlatform
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { search, status, platform } = req.query;
    const [orders, products] = await Promise.all([
      getCollectionDocs('orders'),
      getCollectionDocs('products')
    ]);

    const productNameById = {};
    products.forEach((product) => {
      productNameById[Number(product.id)] = product.name;
    });

    let rows = orders.map((order) => {
      const qty = Number(order.qty) || 0;
      const sellingPrice = Number(order.selling_price) || 0;
      const costPrice = Number(order.cost_price) || 0;
      return {
        ...order,
        product_name: productNameById[Number(order.product_id)] || null,
        revenue: qty * sellingPrice,
        cost: qty * costPrice,
        profit: (qty * sellingPrice) - (qty * costPrice)
      };
    });

    if (search) {
      const query = String(search).toLowerCase();
      rows = rows.filter((order) =>
        String(order.id || '').toLowerCase().includes(query) ||
        String(order.customer_name || '').toLowerCase().includes(query) ||
        String(order.phone_number || '').toLowerCase().includes(query) ||
        String(order.notes || '').toLowerCase().includes(query)
      );
    }

    if (status) {
      rows = rows.filter((order) => String(order.delivery_status || '') === String(status));
    }

    if (platform) {
      rows = rows.filter((order) => String(order.platform || '') === String(platform));
    }

    rows.sort((a, b) => orderNumber(b.id) - orderNumber(a.id));
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/next-id', authenticateToken, async (req, res) => {
  try {
    const nextId = await getNextOrderId();
    return res.json({ nextId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { date, customer_name, address, phone_number, product_id, qty, selling_price, platform, payment_method, delivery_status, notes } = req.body;

    if (!customer_name || !product_id || !qty || selling_price === undefined) {
      return res.status(400).json({ error: 'Customer Name, Product, Qty, and Selling Price are required' });
    }

    const normalizedProductId = Number(product_id);
    const productSnap = await db.collection('products').doc(String(normalizedProductId)).get();
    if (!productSnap.exists) {
      return res.status(400).json({ error: 'Invalid Product selected' });
    }

    const product = productSnap.data();
    const nextId = await getNextOrderId();
    const orderDate = date || new Date().toISOString().split('T')[0];

    const order = {
      id: nextId,
      date: orderDate,
      customer_name,
      address: address || '',
      phone_number: phone_number || '',
      product_id: normalizedProductId,
      qty: Number(qty),
      cost_price: Number(product.cost_price),
      selling_price: Number(selling_price),
      platform: platform || 'Instagram',
      payment_method: payment_method || 'COD',
      delivery_status: delivery_status || 'Delivered',
      notes: notes || ''
    };

    await db.collection('orders').doc(nextId).set(order);
    return res.json({ message: 'Order placed successfully', orderId: nextId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, customer_name, address, phone_number, product_id, qty, selling_price, platform, payment_method, delivery_status, notes } = req.body;

    const orderRef = db.collection('orders').doc(id);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderSnap.data();

    const selectedProductId = Number(product_id || order.product_id);
    const productSnap = await db.collection('products').doc(String(selectedProductId)).get();
    if (!productSnap.exists) {
      return res.status(400).json({ error: 'Invalid product selected' });
    }
    const product = productSnap.data();

    const updatedOrder = {
      ...order,
      date: date || order.date,
      customer_name: customer_name || order.customer_name,
      address: address !== undefined ? address : order.address,
      phone_number: phone_number !== undefined ? phone_number : order.phone_number,
      product_id: selectedProductId,
      qty: qty !== undefined ? Number(qty) : Number(order.qty),
      cost_price: Number(product.cost_price),
      selling_price: selling_price !== undefined ? Number(selling_price) : Number(order.selling_price),
      platform: platform || order.platform,
      payment_method: payment_method || order.payment_method,
      delivery_status: delivery_status || order.delivery_status,
      notes: notes !== undefined ? notes : order.notes
    };

    await orderRef.set(updatedOrder);
    return res.json({ message: 'Order updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    await db.collection('orders').doc(req.params.id).delete();
    return res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const rows = await getCollectionDocs('expenses');
    rows.sort((a, b) => {
      if ((a.date || '') === (b.date || '')) {
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      }
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const { date, category, description, amount, payment_method } = req.body;
    if (!date || !category || !amount || !payment_method) {
      return res.status(400).json({ error: 'Date, Category, Amount, and Payment Method are required' });
    }

    const id = await getNextCounter('expense_id', 1);
    const expense = {
      id,
      date,
      category,
      description: description || '',
      amount: Number(amount),
      payment_method
    };

    await db.collection('expenses').doc(String(id)).set(expense);
    return res.json({ message: 'Expense logged successfully', id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    await db.collection('expenses').doc(String(req.params.id)).delete();
    return res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/adspend', authenticateToken, async (req, res) => {
  try {
    const rows = await getCollectionDocs('ad_spend');
    rows.sort((a, b) => {
      if ((a.date || '') === (b.date || '')) {
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      }
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/adspend', authenticateToken, async (req, res) => {
  try {
    const { date, platform, campaign, amount, notes_objective } = req.body;
    if (!date || !platform || !campaign || !amount) {
      return res.status(400).json({ error: 'Date, Platform, Campaign, and Amount are required' });
    }

    const id = await getNextCounter('adspend_id', 1);
    const record = {
      id,
      date,
      platform,
      campaign,
      amount: Number(amount),
      notes_objective: notes_objective || ''
    };

    await db.collection('ad_spend').doc(String(id)).set(record);
    return res.json({ message: 'Ad spend entry recorded successfully', id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/adspend/:id', authenticateToken, async (req, res) => {
  try {
    await db.collection('ad_spend').doc(String(req.params.id)).delete();
    return res.json({ message: 'Ad spend entry deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const [products, orders, restocks] = await Promise.all([
      getCollectionDocs('products'),
      getCollectionDocs('orders'),
      getCollectionDocs('restock_history')
    ]);

    const soldByProductId = {};
    orders
      .filter((order) => order.delivery_status !== 'Cancelled')
      .forEach((order) => {
        const productId = Number(order.product_id);
        soldByProductId[productId] = (soldByProductId[productId] || 0) + (Number(order.qty) || 0);
      });

    const restockedByProductId = {};
    restocks.forEach((restock) => {
      const productId = Number(restock.product_id);
      restockedByProductId[productId] = (restockedByProductId[productId] || 0) + (Number(restock.qty) || 0);
    });

    const rows = products.map((product) => {
      const productId = Number(product.id);
      const sold_qty = soldByProductId[productId] || 0;
      const restocked_qty = restockedByProductId[productId] || 0;
      const remaining_stock = (Number(product.opening_stock) || 0) + restocked_qty - sold_qty;
      const stock_status = remaining_stock <= (Number(product.reorder_level) || 0) ? 'LOW STOCK' : 'OK';
      return {
        ...product,
        sold_qty,
        restocked_qty,
        remaining_stock,
        stock_status
      };
    });

    rows.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory/restock', authenticateToken, async (req, res) => {
  try {
    const { product_id, qty, date, notes } = req.body;
    if (!product_id || !qty || !date) {
      return res.status(400).json({ error: 'Product, Qty, and Date are required' });
    }

    const id = await getNextCounter('restock_id', 1);
    const restock = {
      id,
      product_id: Number(product_id),
      qty: Number(qty),
      date,
      notes: notes || ''
    };

    await db.collection('restock_history').doc(String(id)).set(restock);
    return res.json({ message: 'Restocking recorded successfully', id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { name, sku, category, cost_price, default_selling_price, opening_stock, reorder_level } = req.body;
    if (!name || !sku || cost_price === undefined || default_selling_price === undefined) {
      return res.status(400).json({ error: 'Name, SKU, Cost Price, and Default Selling Price are required' });
    }

    const existingProducts = await getCollectionDocs('products');
    const duplicateSku = existingProducts.find((product) => String(product.sku || '').toLowerCase() === String(sku).toLowerCase());
    if (duplicateSku) {
      return res.status(400).json({ error: 'A product with this SKU already exists.' });
    }

    const id = await getNextCounter('product_id', 1);
    const product = {
      id,
      name,
      sku,
      category: category || '',
      cost_price: Number(cost_price),
      default_selling_price: Number(default_selling_price),
      opening_stock: Number(opening_stock || 0),
      reorder_level: Number(reorder_level || 10)
    };

    await db.collection('products').doc(String(id)).set(product);
    return res.json({ message: 'Product created successfully', id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const [orders, manualCustomers] = await Promise.all([
      getCollectionDocs('orders'),
      getCollectionDocs('customers')
    ]);

    const customerMap = {};

    manualCustomers.forEach((customer) => {
      const key = `${String(customer.name || '').toLowerCase().trim()}_${String(customer.phone || '').trim()}`;
      customerMap[key] = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone || '-',
        address: customer.address || '-',
        platform: customer.platform || '-',
        total_orders: 0,
        total_spent: 0,
        last_order_date: '-',
        notes: customer.notes || ''
      };
    });

    const aggregatedFromOrders = {};
    orders.forEach((order) => {
      const key = `${String(order.customer_name || '').toLowerCase().trim()}_${String(order.phone_number || '').trim()}`;
      if (!key || key === '_') return;

      if (!aggregatedFromOrders[key]) {
        aggregatedFromOrders[key] = {
          name: order.customer_name,
          phone: order.phone_number || '-',
          address: order.address || '-',
          platform: order.platform || '-',
          total_orders: 0,
          total_spent: 0,
          last_order_date: '-'
        };
      }

      aggregatedFromOrders[key].total_orders += 1;
      aggregatedFromOrders[key].total_spent += (Number(order.qty) || 0) * (Number(order.selling_price) || 0);

      if (order.date && order.date > aggregatedFromOrders[key].last_order_date) {
        aggregatedFromOrders[key].last_order_date = order.date;
        aggregatedFromOrders[key].address = order.address || aggregatedFromOrders[key].address;
        aggregatedFromOrders[key].platform = order.platform || aggregatedFromOrders[key].platform;
      }
    });

    let customCustCounter = manualCustomers.length + 1;
    Object.values(aggregatedFromOrders).forEach((orderCustomer) => {
      const key = `${String(orderCustomer.name || '').toLowerCase().trim()}_${String(orderCustomer.phone === '-' ? '' : orderCustomer.phone || '').trim()}`;

      if (customerMap[key]) {
        customerMap[key].total_orders = orderCustomer.total_orders;
        customerMap[key].total_spent = orderCustomer.total_spent;
        customerMap[key].last_order_date = orderCustomer.last_order_date;
        if (orderCustomer.address && orderCustomer.address !== '-') customerMap[key].address = orderCustomer.address;
        if (orderCustomer.platform && orderCustomer.platform !== '-') customerMap[key].platform = orderCustomer.platform;
      } else {
        const paddedId = String(customCustCounter++).padStart(3, '0');
        customerMap[key] = {
          id: `CUST-${paddedId}`,
          name: orderCustomer.name,
          phone: orderCustomer.phone || '-',
          address: orderCustomer.address || '-',
          platform: orderCustomer.platform || '-',
          total_orders: orderCustomer.total_orders,
          total_spent: orderCustomer.total_spent,
          last_order_date: orderCustomer.last_order_date,
          notes: 'Dynamically created from sales'
        };
      }
    });

    return res.json(Object.values(customerMap));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { name, phone, address, platform, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const id = await getNextCustomerId();
    const customer = {
      id,
      name,
      phone: phone || '',
      address: address || '',
      platform: platform || '',
      notes: notes || ''
    };

    await db.collection('customers').doc(id).set(customer);
    return res.json({ message: 'Customer added successfully', id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/pl', authenticateToken, async (req, res) => {
  try {
    const [orders, expenses, adSpend] = await Promise.all([
      getCollectionDocs('orders'),
      getCollectionDocs('expenses'),
      getCollectionDocs('ad_spend')
    ]);

    const plData = {};
    const currentYear = new Date().getFullYear();
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

    months.forEach((m) => {
      const key = `${currentYear}-${m}`;
      plData[key] = {
        monthName: new Date(`${currentYear}-${m}-15`).toLocaleString('default', { month: 'long' }),
        monthKey: key,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        expenses: 0,
        adSpend: 0,
        netProfit: 0
      };
    });

    orders
      .filter((order) => order.delivery_status !== 'Cancelled')
      .forEach((order) => {
        const month = monthKey(order.date);
        if (!month) return;
        if (!plData[month]) {
          const parts = month.split('-');
          plData[month] = {
            monthName: `${new Date(`${parts[0]}-${parts[1]}-15`).toLocaleString('default', { month: 'long' })} ${parts[0]}`,
            monthKey: month,
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            expenses: 0,
            adSpend: 0,
            netProfit: 0
          };
        }

        plData[month].revenue += (Number(order.qty) || 0) * (Number(order.selling_price) || 0);
        plData[month].cogs += (Number(order.qty) || 0) * (Number(order.cost_price) || 0);
      });

    expenses.forEach((expense) => {
      const month = monthKey(expense.date);
      if (!month) return;
      if (!plData[month]) {
        const parts = month.split('-');
        plData[month] = {
          monthName: `${new Date(`${parts[0]}-${parts[1]}-15`).toLocaleString('default', { month: 'long' })} ${parts[0]}`,
          monthKey: month,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          expenses: 0,
          adSpend: 0,
          netProfit: 0
        };
      }
      plData[month].expenses += Number(expense.amount) || 0;
    });

    adSpend.forEach((entry) => {
      const month = monthKey(entry.date);
      if (!month) return;
      if (!plData[month]) {
        const parts = month.split('-');
        plData[month] = {
          monthName: `${new Date(`${parts[0]}-${parts[1]}-15`).toLocaleString('default', { month: 'long' })} ${parts[0]}`,
          monthKey: month,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
          expenses: 0,
          adSpend: 0,
          netProfit: 0
        };
      }
      plData[month].adSpend += Number(entry.amount) || 0;
    });

    const reports = Object.values(plData).map((m) => {
      const grossProfit = m.revenue - m.cogs;
      const netProfit = grossProfit - m.expenses - m.adSpend;
      return {
        ...m,
        grossProfit,
        netProfit
      };
    });

    reports.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    return res.json(reports);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  try {
    await ensureSeedData();
    app.listen(PORT, () => {
      console.log(`Motovia Backend Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize Firebase backend:', err);
    process.exit(1);
  }
}

startServer();
