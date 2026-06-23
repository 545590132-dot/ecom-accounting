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
  platform: Platform; // 所属平台
  category?: string; // 商品分类（可选）
  productOwner?: string; // 产品负责人（可选）
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
    commission: string; // 佣金字段名
    [key: string]: string; // 允许自定义扩展字段
  };
  // 计算公式（JavaScript 表达式，变量来自字段映射值 + purchasePrice）
  // 可用变量：quantity, unitPrice, platformDiscount, platformFee, shippingFee, commission（字段映射值）
  //           purchasePrice（来自 SKU 映射的采购单价）
  //           以及已计算的其他公式结果（按定义顺序：totalAmount → netAmount → profit → profitRate）
  formulas: {
    totalAmount: string; // 总金额 = (单价 + 平台折扣) * 1.7
    netAmount: string; // 扣除手续费后金额 = totalAmount - platformFee
    profit: string; // 利润 = 总价 - 采购成本
    profitRate: string; // 利润率(%) = 利润 / 总价 * 100
  };
}

// 订单过滤规则
export interface OrderFilterRules {
  // 排除规则：指定字段下哪些值不计入统计（如取消订单）
  excludeStatusField: string; // 字段名（表格列头）
  excludeStatusValues: string[]; // 不计入统计的值列表
  // 仅计数量规则：指定字段下哪些值只统计数量不统计金额（如退货订单）
  quantityOnlyStatusField: string; // 字段名（表格列头）
  quantityOnlyStatusValues: string[]; // 只统计数量的值列表
  // 是否排除金额为0的订单（寄样订单）
  excludeZeroAmount: boolean;
}

// 已保存的计算配置（支持每个平台存储多个方案）
export interface SavedCalcConfig {
  id: string;
  name: string; // 配置名称，如"默认方案"、"含运费利润"
  platform: Platform; // 所属平台
  fieldMapping: CalculationConfig['fieldMapping'];
  fieldAliases: Record<string, string>; // 字段别名，用户自定义的字段名称，如 { orderNo: '订单编号', sku: '商品编码' }
  formulas: CalculationConfig['formulas'];
  filterRules: OrderFilterRules; // 订单过滤规则
  countQuantityAsRows: boolean; // 数量按计数（每行=1）而非求和，适用于Lazada等平台
  profitRateRedThreshold: number | null; // 利润率低于此值标红，null 表示不标红
  isActive: boolean; // 是否为当前平台活跃配置
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
  configId?: string; // 导入时关联的计算方案ID
}

// 计算后的统计结果 - 单条订单
export interface CalculatedOrder {
  id: string;
  orderNo: string;
  sku: string;
  productName: string;
  productOwner: string; // 产品负责人（来自 SKU 映射）
  shopName: string; // 店铺名称
  orderDate: string; // 订单日期（年-月格式，如 2025-01）
  quantity: number;
  unitPrice: number;
  platformDiscount: number; // 平台折扣
  commission: number; // 佣金
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
  excludedCount: number; // 被过滤规则排除的订单数
  orders: CalculatedOrder[];
}

// 商品粒度汇总（按商品名称分组）
export interface SkuSummary {
  sku: string;
  productName: string;
  productOwner: string; // 产品负责人（来自 SKU 映射）
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

// 库存文件
export interface InventoryFile {
  id: string;
  fileName: string;
  yearMonth: string; // 格式：2026-01
  createdAt: number;
}

// 库存记录
export interface InventoryRecord {
  id: string;
  fileId: string;
  sku: string; // SKU 编码（Excel 中的"商品名称"列）
  stockQty: number; // 库存量（Excel 中的"可用量"列）
  yearMonth: string; // 格式：2026-01
  salesStatus: '清货' | '系统判定' | ''; // 用户选择：清货 or 系统判定
  adjustmentPlan: string; // 调整计划（用户自定义）
  createdAt: number;
}

// 库存展示行（计算后）
export interface InventoryDisplayRow {
  sku: string; // SKU 编码
  productName: string; // 实际商品名称（通过 SKU 映射）
  productOwner: string; // 产品负责人
  stock: number; // 当前库存
  monthlySales: number; // 月销量 = 当前库存 - 上月库存
  salesStatus: '清货' | '系统判定' | ''; // 用户选择
  displaySalesStatus: '热销' | '正常' | '平销' | '清货' | ''; // 实际显示的销售情况
  estimatedMonths: number | null; // 预估销售时长（月）= 库存 / 月销量
  goodsValue: number; // 货值 = 库存 * 采购成本
  purchasePrice: number; // 采购单价
  adjustmentPlan: string; // 调整计划
}

// 利润计算器配置
export interface CalculatorSettings {
  id: string;
  platform: Platform;
  settings: PlatformCalcSettings;
  createdAt: number;
}

// 各平台计算器固定值配置
export interface PlatformCalcSettings {
  exchangeRate: number; // 汇率 1马币=?人民币
  overseasFee: number; // 海外仓操作费（人民币）
  // Shopee 专属
  commissionRate: number; // 佣金比例（%）
  savingsFee: number; // 节省计划费用（马币）
  fixedServiceFee: number; // 固定服务费（马币）
  campaignRateNormal: number; // 活动服务费平日比例（%）
  campaignRatePromo: number; // 活动服务费大促比例（%）
  transactionRate: number; // 交易手续费比例（%）
  // Lazada 专属
  lazadaCommissionRate: number; // Lazada 佣金比例（%）
  coinDiscountRate: number; // Lazada 金币折扣服务费比例（%）
  paymentFeeRate: number; // Lazada 支付手续费比例（%）
  allianceCommissionRate: number; // TikTok 联盟佣金比例（%，用户自定义）
  platformSupportFee: number; // TikTok 平台支持费（马币，固定金额）
  tiktokCampaignRate: number; // TikTok 活动服务费比例（%）
  tiktokTransactionRate: number; // TikTok 交易手续费比例（%）
  tiktokCommissionRate: number; // TikTok 佣金比例（%）
}

// 默认配置
export const DEFAULT_SHOPEE_SETTINGS: PlatformCalcSettings = {
  exchangeRate: 1.7,
  overseasFee: 2.5,
  commissionRate: 9.72,
  savingsFee: 0.28,
  fixedServiceFee: 0.54,
  campaignRateNormal: 5.94,
  campaignRatePromo: 8.1,
  transactionRate: 3.8,
  lazadaCommissionRate: 0,
  coinDiscountRate: 0,
  paymentFeeRate: 0,
  allianceCommissionRate: 0,
  platformSupportFee: 0,
  tiktokCampaignRate: 0,
  tiktokTransactionRate: 0,
  tiktokCommissionRate: 0,
};

export const DEFAULT_LAZADA_SETTINGS: PlatformCalcSettings = {
  exchangeRate: 1.7,
  overseasFee: 2.5,
  commissionRate: 0,
  savingsFee: 0,
  fixedServiceFee: 0,
  campaignRateNormal: 0,
  campaignRatePromo: 0,
  transactionRate: 0,
  lazadaCommissionRate: 17,
  coinDiscountRate: 10,
  paymentFeeRate: 4.7,
  allianceCommissionRate: 0,
  platformSupportFee: 0,
  tiktokCampaignRate: 0,
  tiktokTransactionRate: 0,
  tiktokCommissionRate: 0,
};

export const DEFAULT_TIKTOK_SETTINGS: PlatformCalcSettings = {
  exchangeRate: 1.7,
  overseasFee: 2.5,
  commissionRate: 0,
  savingsFee: 0,
  fixedServiceFee: 0,
  campaignRateNormal: 0,
  campaignRatePromo: 0,
  transactionRate: 0,
  lazadaCommissionRate: 0,
  coinDiscountRate: 0,
  paymentFeeRate: 0,
  allianceCommissionRate: 0,
  platformSupportFee: 0.54,
  tiktokCampaignRate: 4.86,
  tiktokTransactionRate: 3.78,
  tiktokCommissionRate: 10.26,
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
