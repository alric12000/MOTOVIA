const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'motovia_secret_key_12345'; // Simple key for local development

const dbPath = path.join(__dirname, 'motovia.db');
const db = new sqlite3.Database(dbPath);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Auth Middleware
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

// --- AUTHENTICATION ENDPOINTS ---

// Admin Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 });
    res.json({ message: 'Login successful', username: user.username });
  });
});

// Admin Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
});

// Check Current Session
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ username: req.user.username });
});

// --- DASHBOARD ENDPOINTS ---

// Get Overview Stats and Charts
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const stats = {
    totalRevenue: 0,
    totalCOGS: 0,
    totalExpenses: 0,
    totalAdSpend: 0,
    netProfit: 0,
    totalOrders: 0,
    totalCustomers: 0,
    lowStockItemsCount: 0,
    monthlyPerformance: {},
    topProducts: [],
    adSpendByPlatform: {}
  };

  // Run multiple queries in sequence using promises or nested callbacks.
  // SQLite is fast, simple nesting is sufficient here.

  // 1. Order Stats (Revenue, COGS, Order count)
  db.all(`
    SELECT 
      SUM(qty * selling_price) as revenue,
      SUM(qty * cost_price) as cogs,
      COUNT(id) as order_count
    FROM orders
    WHERE delivery_status != 'Cancelled'
  `, [], (err, orderRows) => {
    if (err) return res.status(500).json({ error: err.message });
    const orderData = orderRows[0] || {};
    stats.totalRevenue = orderData.revenue || 0;
    stats.totalCOGS = orderData.cogs || 0;
    stats.totalOrders = orderData.order_count || 0;

    // 2. Total Expenses
    db.all(`SELECT SUM(amount) as expenses FROM expenses`, [], (err, expRows) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.totalExpenses = expRows[0].expenses || 0;

      // 3. Total Ad Spend
      db.all(`SELECT SUM(amount) as adspend FROM ad_spend`, [], (err, adRows) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.totalAdSpend = adRows[0].adspend || 0;

        // Calculate Net Profit
        stats.netProfit = stats.totalRevenue - stats.totalCOGS - stats.totalExpenses - stats.totalAdSpend;

        // 4. Distinct Customers from orders & database
        db.all(`
          SELECT COUNT(DISTINCT customer_name) as distinct_order_cust
          FROM orders
        `, [], (err, distinctRows) => {
          if (err) return res.status(500).json({ error: err.message });
          
          db.all(`
            SELECT COUNT(*) as manual_cust 
            FROM customers 
            WHERE name NOT IN (SELECT DISTINCT customer_name FROM orders)
          `, [], (err, manualRows) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.totalCustomers = (distinctRows[0].distinct_order_cust || 0) + (manualRows[0].manual_cust || 0);

            // 5. Low Stock Count
            db.all(`
              SELECT p.id, p.name, p.opening_stock, p.reorder_level,
                     (SELECT IFNULL(SUM(qty), 0) FROM orders WHERE product_id = p.id AND delivery_status != 'Cancelled') as sold_qty,
                     (SELECT IFNULL(SUM(qty), 0) FROM restock_history WHERE product_id = p.id) as restocked_qty
              FROM products p
            `, [], (err, prodRows) => {
              if (err) return res.status(500).json({ error: err.message });
              
              let lowStockCount = 0;
              prodRows.forEach(p => {
                const remaining = p.opening_stock + p.restocked_qty - p.sold_qty;
                if (remaining <= p.reorder_level) {
                  lowStockCount++;
                }
              });
              stats.lowStockItemsCount = lowStockCount;

              // 6. Monthly Aggregations for Charts (Line Chart)
              // Fetch orders monthly
              db.all(`
                SELECT 
                  strftime('%Y-%m', date) as month,
                  SUM(qty * selling_price) as revenue,
                  SUM(qty * cost_price) as cogs
                FROM orders
                WHERE delivery_status != 'Cancelled'
                GROUP BY month
              `, [], (err, monthlyOrders) => {
                if (err) return res.status(500).json({ error: err.message });

                // Fetch expenses monthly
                db.all(`
                  SELECT strftime('%Y-%m', date) as month, SUM(amount) as expenses
                  FROM expenses
                  GROUP BY month
                `, [], (err, monthlyExpenses) => {
                  if (err) return res.status(500).json({ error: err.message });

                  // Fetch ad spend monthly
                  db.all(`
                    SELECT strftime('%Y-%m', date) as month, SUM(amount) as adspend
                    FROM ad_spend
                    GROUP BY month
                  `, [], (err, monthlyAdSpend) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Combine monthly stats
                    const performance = {};
                    const allMonths = new Set([
                      ...monthlyOrders.map(m => m.month),
                      ...monthlyExpenses.map(m => m.month),
                      ...monthlyAdSpend.map(m => m.month)
                    ]);

                    allMonths.forEach(m => {
                      if (!m) return;
                      const orderM = monthlyOrders.find(o => o.month === m) || {};
                      const expM = monthlyExpenses.find(e => e.month === m) || {};
                      const adM = monthlyAdSpend.find(a => a.month === m) || {};

                      const rev = orderM.revenue || 0;
                      const cog = orderM.cogs || 0;
                      const exp = expM.expenses || 0;
                      const ad = adM.adspend || 0;

                      performance[m] = {
                        revenue: rev,
                        cogs: cog,
                        expenses: exp,
                        adspend: ad,
                        netProfit: rev - cog - exp - ad
                      };
                    });

                    stats.monthlyPerformance = performance;

                    // 7. Top Selling Products (Doughnut Chart)
                    db.all(`
                      SELECT p.name, SUM(o.qty) as total_qty
                      FROM orders o
                      JOIN products p ON o.product_id = p.id
                      WHERE o.delivery_status != 'Cancelled'
                      GROUP BY p.name
                      ORDER BY total_qty DESC
                    `, [], (err, topProds) => {
                      if (err) return res.status(500).json({ error: err.message });
                      stats.topProducts = topProds;

                      // 8. Ad Spend by Platform (Bar Chart)
                      db.all(`
                        SELECT platform, SUM(amount) as total_amount
                        FROM ad_spend
                        GROUP BY platform
                      `, [], (err, adPlatforms) => {
                        if (err) return res.status(500).json({ error: err.message });
                        
                        adPlatforms.forEach(row => {
                          stats.adSpendByPlatform[row.platform] = row.total_amount;
                        });

                        res.json(stats);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// --- ORDERS ENDPOINTS ---

// Get all orders with details
app.get('/api/orders', authenticateToken, (req, res) => {
  const { search, status, platform } = req.query;
  let query = `
    SELECT o.*, p.name as product_name, (o.qty * o.selling_price) as revenue, (o.qty * o.cost_price) as cost,
           ((o.qty * o.selling_price) - (o.qty * o.cost_price)) as profit
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
  `;
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push(`(o.id LIKE ? OR o.customer_name LIKE ? OR o.phone_number LIKE ? OR o.notes LIKE ?)`);
    const searchVal = `%${search}%`;
    params.push(searchVal, searchVal, searchVal, searchVal);
  }

  if (status) {
    conditions.push(`o.delivery_status = ?`);
    params.push(status);
  }

  if (platform) {
    conditions.push(`o.platform = ?`);
    params.push(platform);
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }

  query += ` ORDER BY o.id DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get next Order ID (e.g. ORD-1031)
app.get('/api/orders/next-id', authenticateToken, (req, res) => {
  db.get(`SELECT id FROM orders ORDER BY id DESC LIMIT 1`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    let nextId = 'ORD-1001';
    if (row && row.id) {
      const match = row.id.match(/ORD-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        nextId = `ORD-${num + 1}`;
      }
    }
    res.json({ nextId });
  });
});

// Place new order
app.post('/api/orders', authenticateToken, (req, res) => {
  const { date, customer_name, address, phone_number, product_id, qty, selling_price, platform, payment_method, delivery_status, notes } = req.body;

  if (!customer_name || !product_id || !qty || selling_price === undefined) {
    return res.status(400).json({ error: 'Customer Name, Product, Qty, and Selling Price are required' });
  }

  // Find cost price from product database
  db.get(`SELECT cost_price FROM products WHERE id = ?`, [product_id], (err, product) => {
    if (err || !product) {
      return res.status(400).json({ error: 'Invalid Product selected' });
    }

    // Auto generate next Order ID
    db.get(`SELECT id FROM orders ORDER BY id DESC LIMIT 1`, [], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      
      let nextId = 'ORD-1001';
      if (row && row.id) {
        const match = row.id.match(/ORD-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          nextId = `ORD-${num + 1}`;
        }
      }

      // Default date to today if empty
      const orderDate = date || new Date().toISOString().split('T')[0];
      const defaultPlatform = platform || 'Instagram';
      const defaultPayment = payment_method || 'COD';
      const defaultStatus = delivery_status || 'Delivered';

      db.run(`
        INSERT INTO orders (id, date, customer_name, address, phone_number, product_id, qty, cost_price, selling_price, platform, payment_method, delivery_status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        nextId, orderDate, customer_name, address, phone_number, product_id, qty, product.cost_price, parseFloat(selling_price), defaultPlatform, defaultPayment, defaultStatus, notes
      ], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Order placed successfully', orderId: nextId });
      });
    });
  });
});

// Update order status or details
app.put('/api/orders/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { date, customer_name, address, phone_number, product_id, qty, selling_price, platform, payment_method, delivery_status, notes } = req.body;

  db.get(`SELECT * FROM orders WHERE id = ?`, [id], (err, order) => {
    if (err || !order) return res.status(404).json({ error: 'Order not found' });

    // Look up cost price of selected product in case it changed
    db.get(`SELECT cost_price FROM products WHERE id = ?`, [product_id || order.product_id], (err, product) => {
      if (err || !product) return res.status(400).json({ error: 'Invalid product selected' });

      db.run(`
        UPDATE orders
        SET date = ?, customer_name = ?, address = ?, phone_number = ?, product_id = ?, qty = ?, cost_price = ?,
            selling_price = ?, platform = ?, payment_method = ?, delivery_status = ?, notes = ?
        WHERE id = ?
      `, [
        date || order.date,
        customer_name || order.customer_name,
        address !== undefined ? address : order.address,
        phone_number !== undefined ? phone_number : order.phone_number,
        product_id || order.product_id,
        qty || order.qty,
        product.cost_price,
        selling_price !== undefined ? parseFloat(selling_price) : order.selling_price,
        platform || order.platform,
        payment_method || order.payment_method,
        delivery_status || order.delivery_status,
        notes !== undefined ? notes : order.notes,
        id
      ], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Order updated successfully' });
      });
    });
  });
});

// Delete Order
app.delete('/api/orders/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM orders WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Order deleted successfully' });
  });
});

// --- EXPENSES ENDPOINTS ---

// Get expenses
app.get('/api/expenses', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM expenses ORDER BY date DESC, id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add expense
app.post('/api/expenses', authenticateToken, (req, res) => {
  const { date, category, description, amount, payment_method } = req.body;
  if (!date || !category || !amount || !payment_method) {
    return res.status(400).json({ error: 'Date, Category, Amount, and Payment Method are required' });
  }

  db.run(`
    INSERT INTO expenses (date, category, description, amount, payment_method)
    VALUES (?, ?, ?, ?, ?)
  `, [date, category, description, parseFloat(amount), payment_method], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Expense logged successfully', id: this.lastID });
  });
});

// Delete expense
app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM expenses WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Expense deleted successfully' });
  });
});

// --- AD SPEND ENDPOINTS ---

// Get ad spend entries
app.get('/api/adspend', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM ad_spend ORDER BY date DESC, id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add ad spend
app.post('/api/adspend', authenticateToken, (req, res) => {
  const { date, platform, campaign, amount, notes_objective } = req.body;
  if (!date || !platform || !campaign || !amount) {
    return res.status(400).json({ error: 'Date, Platform, Campaign, and Amount are required' });
  }

  db.run(`
    INSERT INTO ad_spend (date, platform, campaign, amount, notes_objective)
    VALUES (?, ?, ?, ?, ?)
  `, [date, platform, campaign, parseFloat(amount), notes_objective], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Ad spend entry recorded successfully', id: this.lastID });
  });
});

// Delete ad spend
app.delete('/api/adspend/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM ad_spend WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Ad spend entry deleted successfully' });
  });
});

// --- PRODUCTS & INVENTORY ---

// Get all products with stock information
app.get('/api/products', authenticateToken, (req, res) => {
  db.all(`
    SELECT p.*,
           (SELECT IFNULL(SUM(qty), 0) FROM orders WHERE product_id = p.id AND delivery_status != 'Cancelled') as sold_qty,
           (SELECT IFNULL(SUM(qty), 0) FROM restock_history WHERE product_id = p.id) as restocked_qty
    FROM products p
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Calculate final remaining stock and status
    const products = rows.map(p => {
      const remaining_stock = p.opening_stock + p.restocked_qty - p.sold_qty;
      const stock_status = remaining_stock <= p.reorder_level ? 'LOW STOCK' : 'OK';
      return {
        ...p,
        remaining_stock,
        stock_status
      };
    });
    res.json(products);
  });
});

// Add dynamic restock
app.post('/api/inventory/restock', authenticateToken, (req, res) => {
  const { product_id, qty, date, notes } = req.body;
  if (!product_id || !qty || !date) {
    return res.status(400).json({ error: 'Product, Qty, and Date are required' });
  }

  db.run(`
    INSERT INTO restock_history (product_id, date, qty, notes)
    VALUES (?, ?, ?, ?)
  `, [parseInt(product_id), date, parseInt(qty), notes], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Restocking recorded successfully', id: this.lastID });
  });
});

// Add new product
app.post('/api/products', authenticateToken, (req, res) => {
  const { name, sku, category, cost_price, default_selling_price, opening_stock, reorder_level } = req.body;
  if (!name || !sku || cost_price === undefined || default_selling_price === undefined) {
    return res.status(400).json({ error: 'Name, SKU, Cost Price, and Default Selling Price are required' });
  }

  db.run(`
    INSERT INTO products (name, sku, category, cost_price, default_selling_price, opening_stock, reorder_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    name, sku, category, parseFloat(cost_price), parseFloat(default_selling_price),
    parseInt(opening_stock || 0), parseInt(reorder_level || 10)
  ], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: 'A product with this SKU already exists.' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Product created successfully', id: this.lastID });
  });
});

// --- CUSTOMERS ENDPOINT ---

// Retrieve the aggregated customer records (from orders and explicit custom records)
app.get('/api/customers', authenticateToken, (req, res) => {
  // Query 1: Aggregated customer info from orders
  const ordersQuery = `
    SELECT 
      customer_name as name,
      phone_number as phone,
      address,
      platform,
      COUNT(id) as total_orders,
      SUM(qty * selling_price) as total_spent,
      MAX(date) as last_order_date
    FROM orders
    GROUP BY customer_name, phone_number
  `;

  db.all(ordersQuery, [], (err, orderCusts) => {
    if (err) return res.status(500).json({ error: err.message });

    // Query 2: Explicit customer database table
    db.all(`SELECT * FROM customers`, [], (err, manualCusts) => {
      if (err) return res.status(500).json({ error: err.message });

      // Merge results
      const customerMap = {};

      // Seed with manual customers (starting with CUST-001, CUST-002, etc.)
      manualCusts.forEach(c => {
        const key = `${c.name.toLowerCase().trim()}_${(c.phone || '').trim()}`;
        customerMap[key] = {
          id: c.id,
          name: c.name,
          phone: c.phone || '-',
          address: c.address || '-',
          platform: c.platform || '-',
          total_orders: 0,
          total_spent: 0,
          last_order_date: '-',
          notes: c.notes || ''
        };
      });

      // Overlay details from orders
      let customCustCounter = manualCusts.length + 1;

      orderCusts.forEach(c => {
        const key = `${c.name.toLowerCase().trim()}_${(c.phone || '').trim()}`;
        
        if (customerMap[key]) {
          // Exists in database, update calculated stats
          customerMap[key].total_orders = c.total_orders;
          customerMap[key].total_spent = c.total_spent;
          customerMap[key].last_order_date = c.last_order_date;
          // Carry over address/platform if they order newer
          if (c.address && c.address !== '-') customerMap[key].address = c.address;
          if (c.platform && c.platform !== '-') customerMap[key].platform = c.platform;
        } else {
          // New dynamic customer from orders
          const paddedId = String(customCustCounter++).padStart(3, '0');
          customerMap[key] = {
            id: `CUST-${paddedId}`,
            name: c.name,
            phone: c.phone || '-',
            address: c.address || '-',
            platform: c.platform || '-',
            total_orders: c.total_orders,
            total_spent: c.total_spent,
            last_order_date: c.last_order_date,
            notes: 'Dynamically created from sales'
          };
        }
      });

      res.json(Object.values(customerMap));
    });
  });
});

// Add customer manually
app.post('/api/customers', authenticateToken, (req, res) => {
  const { name, phone, address, platform, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Customer name is required' });

  // Generate CUST-XXX ID
  db.get(`SELECT id FROM customers ORDER BY id DESC LIMIT 1`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    let nextId = 'CUST-001';
    if (row && row.id) {
      const match = row.id.match(/CUST-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        nextId = `CUST-${String(num + 1).padStart(3, '0')}`;
      }
    }

    db.run(`
      INSERT INTO customers (id, name, phone, address, platform, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [nextId, name, phone, address, platform, notes], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Customer added successfully', id: nextId });
    });
  });
});

// --- P&L STATEMENT ENDPOINT ---
app.get('/api/pl', authenticateToken, (req, res) => {
  // Aggregate sales, expenses and ad spends by month for the P&L table
  const plData = {};

  // Initialize all 12 months for 2026 (or current year)
  const currentYear = new Date().getFullYear();
  const months = [
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'
  ];

  months.forEach(m => {
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

  // Query 1: Sales (Revenue & COGS)
  db.all(`
    SELECT strftime('%Y-%m', date) as month, SUM(qty * selling_price) as revenue, SUM(qty * cost_price) as cogs
    FROM orders
    WHERE delivery_status != 'Cancelled'
    GROUP BY month
  `, [], (err, sales) => {
    if (err) return res.status(500).json({ error: err.message });

    sales.forEach(s => {
      if (plData[s.month]) {
        plData[s.month].revenue = s.revenue || 0;
        plData[s.month].cogs = s.cogs || 0;
      } else if (s.month) {
        // Month outside of current year (e.g. historical data)
        const parts = s.month.split('-');
        const monthName = new Date(`${parts[0]}-${parts[1]}-15`).toLocaleString('default', { month: 'long' }) + ` ${parts[0]}`;
        plData[s.month] = {
          monthName,
          monthKey: s.month,
          revenue: s.revenue || 0,
          cogs: s.cogs || 0,
          grossProfit: 0,
          expenses: 0,
          adSpend: 0,
          netProfit: 0
        };
      }
    });

    // Query 2: Expenses
    db.all(`
      SELECT strftime('%Y-%m', date) as month, SUM(amount) as expenses
      FROM expenses
      GROUP BY month
    `, [], (err, exps) => {
      if (err) return res.status(500).json({ error: err.message });

      exps.forEach(e => {
        if (plData[e.month]) {
          plData[e.month].expenses = e.expenses || 0;
        } else if (e.month) {
          const parts = e.month.split('-');
          const monthName = new Date(`${parts[0]}-${parts[1]}-15`).toLocaleString('default', { month: 'long' }) + ` ${parts[0]}`;
          plData[e.month] = {
            monthName,
            monthKey: e.month,
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            expenses: e.expenses || 0,
            adSpend: 0,
            netProfit: 0
          };
        }
      });

      // Query 3: Ad Spend
      db.all(`
        SELECT strftime('%Y-%m', date) as month, SUM(amount) as adspend
        FROM ad_spend
        GROUP BY month
      `, [], (err, ads) => {
        if (err) return res.status(500).json({ error: err.message });

        ads.forEach(a => {
          if (plData[a.month]) {
            plData[a.month].adSpend = a.adspend || 0;
          } else if (a.month) {
            const parts = a.month.split('-');
            const monthName = new Date(`${parts[0]}-${parts[1]}-15`).toLocaleString('default', { month: 'long' }) + ` ${parts[0]}`;
            plData[a.month] = {
              monthName,
              monthKey: a.month,
              revenue: 0,
              cogs: 0,
              grossProfit: 0,
              expenses: 0,
              adSpend: a.adspend || 0,
              netProfit: 0
            };
          }
        });

        // Compute derived figures (Gross Profit, Net Profit)
        const reports = Object.values(plData).map(m => {
          m.grossProfit = m.revenue - m.cogs;
          m.netProfit = m.grossProfit - m.expenses - m.adSpend;
          return m;
        });

        // Sort by month key ascending
        reports.sort((a, b) => a.monthKey.localeCompare(b.monthKey));

        res.json(reports);
      });
    });
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Motovia Backend Server running at http://localhost:${PORT}`);
});
