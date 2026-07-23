export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number; // For simplicity, we can keep stock as remaining stock
  openingStock?: number;
  restockedQty?: number;
  soldQty?: number;
  reorderLevel: number;
}

export interface Sale {
  id: string;
  date: string;
  orderId: string;
  customerName: string;
  productId: string;
  productName: string; // added to store snapshot
  platform: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  revenue: number;
  cost: number;
  profit: number;
  paymentMethod: string;
  deliveryStatus: string;
  notes: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
}

export interface AdSpend {
  id: string;
  date: string;
  platform: string;
  campaign: string;
  amount: number;
  notes: string;
}

export interface Customer {
  id: string;
  customerId: string;
  name: string;
  phone: string;
  address: string;
  platform: string;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
