// 电商平台类型
export type Platform = 'shopee' | 'lazada' | 'tiktok';

// 店铺名称
export interface ShopName {
  id: string;
  name: string; // 店铺名称
  platform: Platform; // 所属平台
  createdAt: number;
}

// SKU 映射条目
export interface SkuMapping {
  id: string;
  sku: string; // 原始 SKU 编号
  productName: string; // 商品名称
  purchasePrice: number; // 采购单价
  category?: string; // 商品分类（可选）
}

// 计算公式字段映射
export interface CalculationConfig {
  platform: Platform;
  // 各统计指标对应的表格字段映射
  fieldMapping: {
    orderNo: string; // 订单号字段名
    sku: string; // SKU 字段名
    quantity: string; // 数量字段名
    unitPrice: string; // 单价字段名
    platformDiscount: string; // 平台折扣字段名
    platformFee: string; // 平台手续费字段名
    shippingFee: string; // 运费字段名
    [key: string]: string; // 允许自定义扩展字段
  };
  // 计算公式（JavaScript 表达式，变量来自字段映射值 + purchasePrice）
  // 可用变量：quantity, unitPrice, platformDiscount, platformFee, shippingFee（字段映射值）
  //           purchasePrice（来自 SKU 映射的采购单价）
  //           以及已计算的其他公式结果（按定义顺序：totalAmount → netAmount → profit → profitRate）
  formulas: {
    totalAmount: string; // 总金额 = (单价 + 平台折扣) * 1.7
    netAmount: string; // 扣除手续费后金额 = totalAmount - platformFee
    profit: string; // 利润 = 总价 - 采购成本
    profitRate: string; // 利润率(%) = 利润 / 总价 * 100
  };
}

// 已保存的计算配置（支持每个平台存储多个方案）
export interface SavedCalcConfig {
  id: string;
  name: string; // 配置名称，如"默认方案"、"含运费利润"
  shopName: string; // 关联的店铺名称，从店铺名称明细中选择
  fieldMapping: CalculationConfig['fieldMapping'];
  fieldAliases: Record<string, string>; // 字段别名，用户自定义的字段名称，如 { orderNo: '订单编号', sku: '商品编码' }
  formulas: CalculationConfig['formulas'];
  createdAt: number;
  updatedAt: number;
}

// 导入的原始订单数据
export interface RawOrderData {
  id: string;
  platform: Platform;
  fileName: string;
  importTime: number;
  headers: string[]; // 表头字段
  rows: Record<string, string | number>[]; // 原始行数据
  shopName?: string; // 导入时指定的店铺名称
  yearMonth?: string; // 用户自定义的年月（格式：2025-01）
}

// 计算后的统计结果 - 单条订单
export interface CalculatedOrder {
  id: string;
  orderNo: string;
  sku: string;
  productName: string;
  shopName: string; // 店铺名称
  orderDate: string; // 订单日期（年-月格式，如 2025-01）
  quantity: number;
  unitPrice: number;
  platformDiscount: number; // 平台折扣
  totalAmount: number;
  platformFee: number;
  shippingFee: number;
  netAmount: number; // 扣除手续费后金额
  purchasePrice: number;
  purchaseCost: number; // 采购成本 = 采购单价 * 数量
  profit: number; // 利润
  profitRate: number; // 利润率(%)
  rawRow: Record<string, string | number>;
}

// 平台汇总统计
export interface PlatformSummary {
  platform: Platform;
  totalSales: number; // 总销售额
  totalOrders: number; // 总单量
  totalQuantity: number; // 总商品数量
  totalPlatformFee: number; // 总平台手续费
  totalNetAmount: number; // 总扣除手续费后金额
  totalPurchaseCost: number; // 总采购成本
  totalProfit: number; // 总利润
  totalProfitRate: number; // 总利润率(%)
  orders: CalculatedOrder[];
}

// 商品粒度汇总（按商品名称分组）
export interface SkuSummary {
  sku: string;
  productName: string;
  shopName: string; // 店铺名称（用于分组）
  purchasePrice: number; // 采购单价（来自 SKU 映射）
  totalQuantity: number; // 销量
  totalSales: number; // 总价（总销售额）
  avgUnitPrice: number; // 平均单价 = 总价 / 销量
  totalPlatformFee: number; // 总手续费
  totalNetAmount: number; // 总扣费后金额
  totalPurchaseCost: number; // 总采购成本 = 采购单价 * 销量
  totalProfit: number; // 总利润
  profitRate: number; // 利润率(%) = 总利润 / 总价 * 100
  orderCount: number;
}

// 平台品牌配色
export const PLATFORM_CONFIG: Record<Platform, { name: string; color: string; bgColor: string; icon: string }> = {
  shopee: {
    name: 'Shopee',
    color: '#ee4d2d',
    bgColor: '#fff5f3',
    icon: 'S',
  },
  lazada: {
    name: 'Lazada',
    color: '#0f146d',
    bgColor: '#f0f0ff',
    icon: 'L',
  },
  tiktok: {
    name: 'TikTok',
    color: '#fe2c55',
    bgColor: '#fff0f3',
    icon: 'T',
  },
};

// 格式化金额
export function formatCurrency(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + '元';
}

// 生成唯一 ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
