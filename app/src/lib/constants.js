// Default dropdown lists — seeded into settings/config on first run / import.
// These mirror the hidden "Lists" sheet of the original tracker spreadsheet.
export const DEFAULT_SETTINGS = {
  platforms: ['Instagram', 'WhatsApp', 'TikTok', 'Facebook', 'Website', 'Shopify', 'Other'],
  payment_methods: ['COD', 'eSewa', 'Khalti', 'Bank Transfer', 'Cash'],
  statuses: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Returned', 'Cancelled'],
  expense_categories: [
    'Rent', 'Salaries', 'Packaging', 'Utilities', 'Transport/Delivery',
    'Software/Subscriptions', 'Bank/Platform Fees', 'Labeling', 'Bag', 'Other',
  ],
  ad_platforms: ['Facebook', 'TikTok', 'Google', 'Instagram', 'Other'],
}

// Statuses that mean the item is NOT sold — stock is returned to inventory.
export const NON_SELLING_STATUSES = ['Returned', 'Cancelled']

// The default catalog (components + bundles) matching the original business.
// Used by the "Seed defaults" button when starting fresh without an import.
export const DEFAULT_PRODUCTS = [
  {
    name: 'Car Shampoo', sku: 'SKU-CS01', category: 'Car Care', type: 'component',
    cost_price: 200, default_selling_price: 799, opening_stock: 150, reorder_level: 5,
  },
  {
    name: 'FoamX', sku: 'SKU-FX01', category: 'Car Care', type: 'component',
    cost_price: 600, default_selling_price: 1499, opening_stock: 150, reorder_level: 5,
  },
  {
    name: 'Towel', sku: 'SKU-TW01', category: 'Car Care', type: 'component',
    cost_price: 150, default_selling_price: 499, opening_stock: 0, reorder_level: 8,
  },
]

// Bundles reference components by SKU (resolved to ids after products are created).
export const DEFAULT_BUNDLES = [
  {
    name: 'Wash Combo', sku: 'SKU-WC01', category: 'Car Care', type: 'bundle',
    cost_price: 800, default_selling_price: 1759,
    componentSkus: [{ sku: 'SKU-CS01', qty: 1 }, { sku: 'SKU-FX01', qty: 1 }],
  },
  {
    name: 'Clean Wash Combo', sku: 'SKU-CWC01', category: 'Car Care', type: 'bundle',
    cost_price: 950, default_selling_price: 2199,
    componentSkus: [
      { sku: 'SKU-CS01', qty: 1 }, { sku: 'SKU-FX01', qty: 1 }, { sku: 'SKU-TW01', qty: 1 },
    ],
  },
]

export const STATUS_FLOW = ['Pending', 'Processing', 'Shipped', 'Delivered']
