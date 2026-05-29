'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Platform,
  SkuMapping,
  CalculationConfig,
  RawOrderData,
  CalculatedOrder,
  PlatformSummary,
  SkuSummary,
} from '@/types';
import { generateId } from '@/types';

// 默认字段映射配置
const DEFAULT_FIELD_MAPPINGS: Record<Platform, CalculationConfig['fieldMapping']> = {
  shopee: {
    orderNo: '订单编号',
    sku: '商品编码',
    productName: '商品名称',
    quantity: '商品数量',
    unitPrice: '商品单价',
    totalAmount: '订单金额',
    platformFee: '佣金',
    shippingFee: '运费',
  },
  lazada: {
    orderNo: '订单号',
    sku: '卖家SKU',
    productName: '商品名称',
    quantity: '数量',
    unitPrice: '单价',
    totalAmount: '订单总金额',
    platformFee: '平台佣金',
    shippingFee: '运费',
  },
  tiktok: {
    orderNo: '订单ID',
    sku: '卖家SKU',
    productName: '商品名称',
    quantity: '数量',
    unitPrice: '商品单价',
    totalAmount: '订单金额',
    platformFee: '平台服务费',
    shippingFee: '运费',
  },
};

const DEFAULT_FORMULAS: CalculationConfig['formulas'] = {
  netAmount: 'totalAmount - platformFee',
  profit: 'netAmount - purchasePrice * quantity - shippingFee',
};

interface AppState {
  // SKU 映射库
  skuMappings: SkuMapping[];
  addSkuMapping: (mapping: Omit<SkuMapping, 'id'>) => void;
  updateSkuMapping: (id: string, mapping: Partial<SkuMapping>) => void;
  deleteSkuMapping: (id: string) => void;
  importSkuMappings: (mappings: Omit<SkuMapping, 'id'>[]) => void;
  clearSkuMappings: () => void;

  // 计算配置（按平台存储）
  calculationConfigs: Record<Platform, CalculationConfig>;
  updateFieldMapping: (platform: Platform, field: string, value: string) => void;
  updateFormula: (platform: Platform, formulaKey: keyof CalculationConfig['formulas'], expression: string) => void;

  // 原始订单数据（按平台存储）
  rawOrders: Record<Platform, RawOrderData[]>;
  importOrders: (platform: Platform, data: Omit<RawOrderData, 'id' | 'importTime'>) => void;
  deleteOrderFile: (platform: Platform, orderId: string) => void;
  clearOrders: (platform: Platform) => void;

  // 计算方法
  calculateSummary: (platform: Platform) => PlatformSummary;
  calculateAllSummaries: () => Record<Platform, PlatformSummary>;
  calculateSkuSummaries: (platform: Platform) => SkuSummary[];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // SKU 映射库
      skuMappings: [],
      addSkuMapping: (mapping) =>
        set((state) => ({
          skuMappings: [...state.skuMappings, { ...mapping, id: generateId() }],
        })),
      updateSkuMapping: (id, mapping) =>
        set((state) => ({
          skuMappings: state.skuMappings.map((m) =>
            m.id === id ? { ...m, ...mapping } : m
          ),
        })),
      deleteSkuMapping: (id) =>
        set((state) => ({
          skuMappings: state.skuMappings.filter((m) => m.id !== id),
        })),
      importSkuMappings: (mappings) =>
        set((state) => ({
          skuMappings: [
            ...state.skuMappings,
            ...mappings.map((m) => ({ ...m, id: generateId() })),
          ],
        })),
      clearSkuMappings: () => set({ skuMappings: [] }),

      // 计算配置
      calculationConfigs: {
        shopee: {
          platform: 'shopee',
          fieldMapping: { ...DEFAULT_FIELD_MAPPINGS.shopee },
          formulas: { ...DEFAULT_FORMULAS },
        },
        lazada: {
          platform: 'lazada',
          fieldMapping: { ...DEFAULT_FIELD_MAPPINGS.lazada },
          formulas: { ...DEFAULT_FORMULAS },
        },
        tiktok: {
          platform: 'tiktok',
          fieldMapping: { ...DEFAULT_FIELD_MAPPINGS.tiktok },
          formulas: { ...DEFAULT_FORMULAS },
        },
      },
      updateFieldMapping: (platform, field, value) =>
        set((state) => ({
          calculationConfigs: {
            ...state.calculationConfigs,
            [platform]: {
              ...state.calculationConfigs[platform],
              fieldMapping: {
                ...state.calculationConfigs[platform].fieldMapping,
                [field]: value,
              },
            },
          },
        })),
      updateFormula: (platform, formulaKey, expression) =>
        set((state) => ({
          calculationConfigs: {
            ...state.calculationConfigs,
            [platform]: {
              ...state.calculationConfigs[platform],
              formulas: {
                ...state.calculationConfigs[platform].formulas,
                [formulaKey]: expression,
              },
            },
          },
        })),

      // 原始订单数据
      rawOrders: { shopee: [], lazada: [], tiktok: [] },
      importOrders: (platform, data) =>
        set((state) => ({
          rawOrders: {
            ...state.rawOrders,
            [platform]: [
              ...state.rawOrders[platform],
              { ...data, id: generateId(), importTime: Date.now() },
            ],
          },
        })),
      deleteOrderFile: (platform, orderId) =>
        set((state) => ({
          rawOrders: {
            ...state.rawOrders,
            [platform]: state.rawOrders[platform].filter(
              (o) => o.id !== orderId
            ),
          },
        })),
      clearOrders: (platform) =>
        set((state) => ({
          rawOrders: {
            ...state.rawOrders,
            [platform]: [],
          },
        })),

      // 计算方法
      calculateSummary: (platform) => {
        const state = get();
        const config = state.calculationConfigs[platform];
        const orders = state.rawOrders[platform];
        const skuMap = state.skuMappings;

        const calculatedOrders: CalculatedOrder[] = [];

        for (const orderFile of orders) {
          for (const row of orderFile.rows) {
            const mapping = config.fieldMapping;

            const getNumValue = (fieldName: string): number => {
              const val = row[fieldName];
              if (val === undefined || val === null || val === '') return 0;
              const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
              return isNaN(num) ? 0 : num;
            };

            const getStrValue = (fieldName: string): string => {
              const val = row[fieldName];
              return val !== undefined && val !== null ? String(val) : '';
            };

            const sku = getStrValue(mapping.sku);
            const skuInfo = skuMap.find((m) => m.sku === sku);
            const purchasePrice = skuInfo?.purchasePrice ?? 0;

            const totalAmount = getNumValue(mapping.totalAmount);
            const platformFee = getNumValue(mapping.platformFee);
            const shippingFee = getNumValue(mapping.shippingFee);
            const quantity = getNumValue(mapping.quantity);

            const netAmount = totalAmount - platformFee;
            const profit = netAmount - purchasePrice * quantity - shippingFee;

            calculatedOrders.push({
              id: generateId(),
              orderNo: getStrValue(mapping.orderNo),
              sku,
              productName: getStrValue(mapping.productName) || (skuInfo?.productName ?? ''),
              quantity,
              unitPrice: getNumValue(mapping.unitPrice),
              totalAmount,
              platformFee,
              shippingFee,
              netAmount,
              purchasePrice,
              profit,
              rawRow: row,
            });
          }
        }

        const totalSales = calculatedOrders.reduce((s, o) => s + o.totalAmount, 0);
        const totalOrders = new Set(calculatedOrders.map((o) => o.orderNo)).size;
        const totalQuantity = calculatedOrders.reduce((s, o) => s + o.quantity, 0);
        const totalPlatformFee = calculatedOrders.reduce((s, o) => s + o.platformFee, 0);
        const totalNetAmount = calculatedOrders.reduce((s, o) => s + o.netAmount, 0);
        const totalPurchaseCost = calculatedOrders.reduce((s, o) => s + o.purchasePrice * o.quantity, 0);
        const totalProfit = calculatedOrders.reduce((s, o) => s + o.profit, 0);

        return {
          platform,
          totalSales,
          totalOrders,
          totalQuantity,
          totalPlatformFee,
          totalNetAmount,
          totalPurchaseCost,
          totalProfit,
          orders: calculatedOrders,
        };
      },

      calculateAllSummaries: () => {
        const platforms: Platform[] = ['shopee', 'lazada', 'tiktok'];
        const state = get();
        const result: Record<Platform, PlatformSummary> = {
          shopee: { platform: 'shopee', totalSales: 0, totalOrders: 0, totalQuantity: 0, totalPlatformFee: 0, totalNetAmount: 0, totalPurchaseCost: 0, totalProfit: 0, orders: [] },
          lazada: { platform: 'lazada', totalSales: 0, totalOrders: 0, totalQuantity: 0, totalPlatformFee: 0, totalNetAmount: 0, totalPurchaseCost: 0, totalProfit: 0, orders: [] },
          tiktok: { platform: 'tiktok', totalSales: 0, totalOrders: 0, totalQuantity: 0, totalPlatformFee: 0, totalNetAmount: 0, totalPurchaseCost: 0, totalProfit: 0, orders: [] },
        };
        for (const p of platforms) {
          result[p] = state.calculateSummary(p);
        }
        return result;
      },

      calculateSkuSummaries: (platform) => {
        const summary = get().calculateSummary(platform);
        const skuMap = new Map<string, SkuSummary>();

        for (const order of summary.orders) {
          const key = order.sku;
          if (!skuMap.has(key)) {
            skuMap.set(key, {
              sku: order.sku,
              productName: order.productName,
              purchasePrice: order.purchasePrice,
              totalQuantity: 0,
              totalSales: 0,
              totalPlatformFee: 0,
              totalNetAmount: 0,
              totalPurchaseCost: 0,
              totalProfit: 0,
              orderCount: 0,
            });
          }
          const s = skuMap.get(key)!;
          s.totalQuantity += order.quantity;
          s.totalSales += order.totalAmount;
          s.totalPlatformFee += order.platformFee;
          s.totalNetAmount += order.netAmount;
          s.totalPurchaseCost += order.purchasePrice * order.quantity;
          s.totalProfit += order.profit;
          s.orderCount += 1;
        }

        return Array.from(skuMap.values());
      },
    }),
    {
      name: 'ecommerce-accounting-store',
    }
  )
);
