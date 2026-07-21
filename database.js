const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'motovia.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Initializing database...');

  // 1. Users Table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  )`);

  // 2. Products Table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category TEXT,
    cost_price REAL NOT NULL,
    default_selling_price REAL NOT NULL,
    opening_stock INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 10
  )`);

  // 3. Orders Table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, -- e.g. ORD-1001
    date TEXT NOT NULL,  -- YYYY-MM-DD
    customer_name TEXT NOT NULL,
    address TEXT,
    phone_number TEXT,
    product_id INTEGER,
    qty INTEGER NOT NULL DEFAULT 1,
    cost_price REAL NOT NULL,
    selling_price REAL NOT NULL,
    platform TEXT,       -- Instagram, Facebook, TikTok, Other
    payment_method TEXT, -- COD, Esewa, Khalti, Bank Transfer, Cash
    delivery_status TEXT, -- Pending, Shipped, Delivered, Cancelled
    notes TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  // 4. Expenses Table
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL, -- Packaging, Logistics, Rent, Utilities, Salaries, Other
    description TEXT,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL
  )`);

  // 5. Ad Spend Table
  db.run(`CREATE TABLE IF NOT EXISTS ad_spend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    platform TEXT NOT NULL, -- Facebook, Instagram, TikTok, Google, Other
    campaign TEXT NOT NULL,
    amount REAL NOT NULL,
    notes_objective TEXT
  )`);

  // 6. Restock History Table
  db.run(`CREATE TABLE IF NOT EXISTS restock_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    qty INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  // 7. Customers Table (for manually added or synced contacts)
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, -- e.g. CUST-001
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    platform TEXT,
    notes TEXT
  )`);

  // Seeding Admin User
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('admin123', salt);
  db.run(`INSERT OR IGNORE INTO users (username, password_hash) VALUES ('admin', ?)`, [adminHash]);

  // Seeding Products
  const seedProducts = [
    { name: 'Combo Wash', sku: 'WASH-COMBO', category: 'Wash Services & Kits', cost_price: 871.00, default_selling_price: 1750.00, opening_stock: 100, reorder_level: 15 },
    { name: 'Foam X', sku: 'FOAM-X', category: 'Shampoo', cost_price: 645.00, default_selling_price: 1499.00, opening_stock: 80, reorder_level: 10 },
    { name: 'Talo', sku: 'TALO-WAX', category: 'Wax & Polish', cost_price: 300.00, default_selling_price: 600.00, opening_stock: 50, reorder_level: 8 },
    { name: 'Samphoo', sku: 'SHAMPOO-CAR', category: 'Shampoo', cost_price: 400.00, default_selling_price: 800.00, opening_stock: 60, reorder_level: 10 }
  ];

  const stmtProd = db.prepare(`INSERT OR IGNORE INTO products (name, sku, category, cost_price, default_selling_price, opening_stock, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  seedProducts.forEach(p => {
    stmtProd.run(p.name, p.sku, p.category, p.cost_price, p.default_selling_price, p.opening_stock, p.reorder_level);
  });
  stmtProd.finalize();

  // Seeding Customers
  db.run(`INSERT OR IGNORE INTO customers (id, name, phone, address, platform, notes) VALUES ('CUST-001', 'Sita Sharma', '98XXXXXXXX', 'Kathmandu', 'TikTok Shop', 'First customer seed')`);

  // Seed Historical Orders (ORD-1001 to ORD-1030)
  // Let's map Product names to their database IDs (Combo Wash = 1, Foam X = 2, Talo = 3, Samphoo = 4)
  const historicalOrders = [
    { id: 'ORD-1001', date: '2026-06-15', customer_name: 'Anish Rai', address: 'Dharan', phone_number: '9842551122', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1750.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1002', date: '2026-07-11', customer_name: 'Subodh Parajuli', address: 'Kathmandu', phone_number: '9851122334', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1750.00, platform: 'Other', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1003', date: '2026-07-12', customer_name: 'Ravi', address: 'Lalitpur', phone_number: '9801122334', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1750.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1004', date: '2026-07-13', customer_name: 'Utsav', address: 'Bhaktapur', phone_number: '9861122334', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1750.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1005', date: '2026-07-14', customer_name: 'Ajen', address: 'Pokhara', phone_number: '9846122334', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1750.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1006', date: '2026-07-15', customer_name: 'Sameer Thapa', address: 'Kathmandu', phone_number: '9851011223', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1750.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1007', date: '2026-07-16', customer_name: 'Deepak', address: 'Butwal', phone_number: '9807122334', product_id: 2, qty: 1, cost_price: 645.00, selling_price: 1499.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1008', date: '2026-07-17', customer_name: 'Prasanna Raj Kunwar', address: 'Kathmandu', phone_number: '9851234567', product_id: 1, qty: 1, cost_price: 1097.00, selling_price: 2000.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: 'Wash Combo + Extra' },
    { id: 'ORD-1009', date: '2026-07-18', customer_name: 'Aashish Malla', address: 'Lalitpur', phone_number: '9812345678', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1010', date: '2026-07-19', customer_name: 'Nilesh', address: 'Kathmandu', phone_number: '9841234567', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1750.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1011', date: '2026-07-20', customer_name: 'Aayush', address: 'Bhaktapur', phone_number: '9861234567', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1012', date: '2026-07-21', customer_name: 'Bishal', address: 'Kathmandu', phone_number: '9851112223', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1013', date: '2026-07-22', customer_name: 'Pratik Tewari', address: 'Biratnagar', phone_number: '9842112233', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1014', date: '2026-07-23', customer_name: 'Sujan KC', address: 'Hetauda', phone_number: '9855011223', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1015', date: '2026-07-24', customer_name: 'Anta Showroom', address: 'Kathmandu', phone_number: '9851000111', product_id: 2, qty: 1, cost_price: 645.00, selling_price: 1399.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: 'Foam X Spray Only' },
    { id: 'ORD-1016', date: '2026-07-25', customer_name: 'Ichhyangkush', address: 'Kathmandu', phone_number: '9851223344', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1017', date: '2026-07-26', customer_name: 'Saman Giri', address: 'Lalitpur', phone_number: '9801223344', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1018', date: '2026-07-27', customer_name: 'Riwaj Bagale', address: 'Chitwan', phone_number: '9856011223', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1019', date: '2026-07-28', customer_name: 'Shahnawz', address: 'Kathmandu', phone_number: '9841334455', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1020', date: '2026-07-29', customer_name: 'Ankit', address: 'Kathmandu', phone_number: '9851445566', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1021', date: '2026-07-30', customer_name: 'Ankit Magar', address: 'Dharan', phone_number: '9842445566', product_id: 2, qty: 1, cost_price: 645.00, selling_price: 1300.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: 'Foam X Bottle' },
    { id: 'ORD-1022', date: '2026-07-31', customer_name: 'Manisha Shrestha', address: 'Kathmandu', phone_number: '9851667788', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1759.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1023', date: '2026-08-01', customer_name: 'Tenzing', address: 'Lalitpur', phone_number: '9801667788', product_id: 2, qty: 1, cost_price: 645.00, selling_price: 1399.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: 'Foam X Spray' },
    { id: 'ORD-1024', date: '2026-08-02', customer_name: 'Pranab Maharjan', address: 'Kathmandu', phone_number: '9851778899', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1659.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1025', date: '2026-08-03', customer_name: 'Suneeta Bhandari', address: 'Bhaktapur', phone_number: '9861778899', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1659.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1026', date: '2026-08-04', customer_name: 'Riyaz Shrestha', address: 'Kathmandu', phone_number: '9851889900', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1659.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1027', date: '2026-08-05', customer_name: 'Shilachi Shrestha', address: 'Lalitpur', phone_number: '9801889900', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1659.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1028', date: '2026-08-06', customer_name: 'Sonam Sherpa', address: 'Kathmandu', phone_number: '9851990011', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1659.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1029', date: '2026-08-07', customer_name: 'Ankur Adhikari', address: 'Birgunj', phone_number: '9845990011', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1659.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' },
    { id: 'ORD-1030', date: '2026-08-08', customer_name: 'Binam Mathema', address: 'Kathmandu', phone_number: '9851556677', product_id: 1, qty: 1, cost_price: 871.00, selling_price: 1659.00, platform: 'Instagram', payment_method: 'COD', delivery_status: 'Delivered', notes: '' }
  ];

  const stmtOrder = db.prepare(`INSERT OR IGNORE INTO orders (id, date, customer_name, address, phone_number, product_id, qty, cost_price, selling_price, platform, payment_method, delivery_status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  historicalOrders.forEach(o => {
    stmtOrder.run(o.id, o.date, o.customer_name, o.address, o.phone_number, o.product_id, o.qty, o.cost_price, o.selling_price, o.platform, o.payment_method, o.delivery_status, o.notes);
  });
  stmtOrder.finalize();

  // Seed Historical Expenses
  // 2026-07-01, Packaging, Boxes & tape - 100 units, 1500.00, Cash
  db.run(`INSERT OR IGNORE INTO expenses (date, category, description, amount, payment_method) VALUES ('2026-07-01', 'Packaging', 'Boxes & tape - 100 units', 1500.00, 'Cash')`);

  // Seed Historical Ad Spend
  // 2026-07-01, Facebook, Eid Sale Promo, 2500.00, Boost sales - carousel ad
  db.run(`INSERT OR IGNORE INTO ad_spend (date, platform, campaign, amount, notes_objective) VALUES ('2026-07-01', 'Facebook', 'Eid Sale Promo', 2500.00, 'Boost sales - carousel ad')`);

  console.log('Database successfully initialized and seeded.');
});

db.close();
