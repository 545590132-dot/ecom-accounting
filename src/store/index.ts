'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Platform,
  SkuMapping,
  CalculationConfig,
  SavedCalcConfig,
  RawOrderData,
  CalculatedOrder,
  PlatformSummary,
  SkuSummary,
  ShopName,
} from '@/types';
import { generateId } from '@/types';

// 默认字段映射为空 — 由用户从导入表格的表头中选择
const EMPTY_FIELD_MAPPING: CalculationConfig['fieldMapping'] = {
  orderNo: '',
  sku: '',
  quantity: '',
  unitPrice: '',
  platformDiscount: '',
  platformFee: '',
  shippingFee: '',
};

// 字段默认别名（中文名称）
const DEFAULT_FIELD_ALIASES: Record<string, string> = {
  orderNo: '订单号',
  sku: 'SKU',
  quantity: '数量',
  unitPrice: '单价',
  platformDiscount: '平台折扣',
  platformFee: '平台手续费',
  shippingFee: '运费',
};

const DEFAULT_FORMULAS: CalculationConfig['formulas'] = {
  totalAmount: '(unitPrice + platformDiscount) * 1.7',
  netAmount: 'totalAmount - platformFee',
  profit: 'totalAmount - purchasePrice * quantity',
  profitRate: 'totalAmount > 0 ? profit / totalAmount * 100 : 0',
};

// 为每个平台创建默认配置
function createDefaultConfig(platform: Platform): SavedCalcConfig {
  return {
    id: generateId(),
    name: '默认方案',
    shopName: '',
    fieldMapping: { ...EMPTY_FIELD_MAPPING },
    fieldAliases: { ...DEFAULT_FIELD_ALIASES },
    formulas: { ...DEFAULT_FORMULAS },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

interface AppState {
  // SKU 映射库
  skuMappings: SkuMapping[];
  addSkuMapping: (mapping: Omit<SkuMapping, 'id'>) => void;
  updateSkuMapping: (id: string, mapping: Partial<SkuMapping>) => void;
  deleteSkuMapping: (id: string) => void;
  importSkuMappings: (mappings: Omit<SkuMapping, 'id'>[]) => void;
  clearSkuMappings: () => void;

  // 店铺名称管理
  shopNames: ShopName[];
  addShopName: (platform: Platform, name: string) => void;
  addShopNamesBatch: (platform: Platform, names: string[]) => void;
  deleteShopName: (id: string) => void;
  updateShopName: (id: string, name: string) => void;
  clearShopNames: (platform: Platform) => void;
  getShopNamesByPlatform: (platform: Platform) => ShopName[];

  // 各平台已导入表格的可用字段（从导入文件的表头自动提取）
  availableHeaders: Record<Platform, string[]>;

  // 已保存的计算配置（每个平台支持多个方案）
  savedConfigs: Record<Platform, SavedCalcConfig[]>;
  activeConfigId: Record<Platform, string>;
  // 获取当前激活的配置
  getActiveConfig: (platform: Platform) => SavedCalcConfig;
  // 保存当前配置（新建或更新）
  saveCurrentConfig: (platform: Platform, name: string) => void;
  // 切换到某个已保存的配置
  switchConfig: (platform: Platform, configId: string) => void;
  // 删除某个已保存的配置
  deleteConfig: (platform: Platform, configId: string) => void;
  // 重命名配置
  renameConfig: (platform: Platform, configId: string, name: string) => void;
  // 更新当前激活配置的店铺名称
  updateConfigShopName: (platform: Platform, shopName: string) => void;
  // 更新当前激活配置的字段映射
  updateFieldMapping: (platform: Platform, field: string, value: string) => void;
  // 更新当前激活配置的字段别名
  updateFieldAlias: (platform: Platform, field: string, alias: string) => void;
  // 更新当前激活配置的计算公式
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

// 合并所有已导入文件的表头（去重）
function mergeHeaders(existing: string[], newHeaders: string[]): string[] {
  const set = new Set(existing);
  for (const h of newHeaders) {
    if (h.trim()) set.add(h.trim());
  }
  return Array.from(set);
}

// 初始化每个平台的默认配置
function initDefaultConfigs(): { saved: Record<Platform, SavedCalcConfig[]>; activeIds: Record<Platform, string> } {
  const platforms: Platform[] = ['shopee', 'lazada', 'tiktok'];
  const saved: Record<Platform, SavedCalcConfig[]> = { shopee: [], lazada: [], tiktok: [] };
  const activeIds: Record<Platform, string> = { shopee: '', lazada: '', tiktok: '' };
  for (const p of platforms) {
    const defaultCfg = createDefaultConfig(p);
    saved[p] = [defaultCfg];
    activeIds[p] = defaultCfg.id;
  }
  return { saved, activeIds };
}

const { saved: initialSavedConfigs, activeIds: initialActiveIds } = initDefaultConfigs();

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

      // 店铺名称管理
      shopNames: [],
      addShopName: (platform, name) =>
        set((state) => ({
          shopNames: [...state.shopNames, { id: generateId(), name, platform, createdAt: Date.now() }],
        })),
      addShopNamesBatch: (platform, names) =>
        set((state) => ({
          shopNames: [
            ...state.shopNames,
            ...names.map((name) => ({ id: generateId(), name, platform, createdAt: Date.now() })),
          ],
        })),
      deleteShopName: (id) =>
        set((state) => ({
          shopNames: state.shopNames.filter((s) => s.id !== id),
        })),
      updateShopName: (id, name) =>
        set((state) => ({
          shopNames: state.shopNames.map((s) => (s.id === id ? { ...s, name } : s)),
        })),
      clearShopNames: (platform) =>
        set((state) => ({
          shopNames: state.shopNames.filter((s) => s.platform !== platform),
        })),
      getShopNamesByPlatform: (platform) => {
        return get().shopNames.filter((s) => s.platform === platform);
      },

      // 可用表头字段（从导入的表格自动收集）
      availableHeaders: { shopee: [], lazada: [], tiktok: [] },

      // 已保存的计算配置
      savedConfigs: initialSavedConfigs,
      activeConfigId: initialActiveIds,

      getActiveConfig: (platform) => {
        const state = get();
        const configs = state.savedConfigs[platform];
        const activeId = state.activeConfigId[platform];
        return configs.find((c) => c.id === activeId) ?? configs[0] ?? createDefaultConfig(platform);
      },

      saveCurrentConfig: (platform, name) =>
        set((state) => {
          const activeConfig = state.savedConfigs[platform].find(
            (c) => c.id === state.activeConfigId[platform]
          );
          const newConfig: SavedCalcConfig = {
            id: generateId(),
            name,
            shopName: activeConfig?.shopName ?? '',
            fieldMapping: activeConfig ? { ...activeConfig.fieldMapping } : { ...EMPTY_FIELD_MAPPING },
            fieldAliases: activeConfig ? { ...activeConfig.fieldAliases } : { ...DEFAULT_FIELD_ALIASES },
            formulas: activeConfig ? { ...activeConfig.formulas } : { ...DEFAULT_FORMULAS },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          return {
            savedConfigs: {
              ...state.savedConfigs,
              [platform]: [...state.savedConfigs[platform], newConfig],
            },
            activeConfigId: {
              ...state.activeConfigId,
              [platform]: newConfig.id,
            },
          };
        }),

      switchConfig: (platform, configId) =>
        set((state) => ({
          activeConfigId: {
            ...state.activeConfigId,
            [platform]: configId,
          },
        })),

      deleteConfig: (platform, configId) =>
        set((state) => {
          const configs = state.savedConfigs[platform];
          if (configs.length <= 1) return state; // 至少保留一个配置
          const newConfigs = configs.filter((c) => c.id !== configId);
          const isActive = state.activeConfigId[platform] === configId;
          return {
            savedConfigs: {
              ...state.savedConfigs,
              [platform]: newConfigs,
            },
            activeConfigId: isActive
              ? { ...state.activeConfigId, [platform]: newConfigs[0].id }
              : state.activeConfigId,
          };
        }),

      renameConfig: (platform, configId, name) =>
        set((state) => ({
          savedConfigs: {
            ...state.savedConfigs,
            [platform]: state.savedConfigs[platform].map((c) =>
              c.id === configId ? { ...c, name, updatedAt: Date.now() } : c
            ),
          },
        })),

      updateConfigShopName: (platform, shopName) =>
        set((state) => {
          const activeId = state.activeConfigId[platform];
          return {
            savedConfigs: {
              ...state.savedConfigs,
              [platform]: state.savedConfigs[platform].map((c) =>
                c.id === activeId ? { ...c, shopName, updatedAt: Date.now() } : c
              ),
            },
          };
        }),

      updateFieldMapping: (platform, field, value) =>
        set((state) => {
          const activeId = state.activeConfigId[platform];
          return {
            savedConfigs: {
              ...state.savedConfigs,
              [platform]: state.savedConfigs[platform].map((c) =>
                c.id === activeId
                  ? {
                      ...c,
                      fieldMapping: { ...c.fieldMapping, [field]: value },
                      updatedAt: Date.now(),
                    }
                  : c
              ),
            },
          };
        }),

      updateFieldAlias: (platform, field, alias) =>
        set((state) => {
          const activeId = state.activeConfigId[platform];
          return {
            savedConfigs: {
              ...state.savedConfigs,
              [platform]: state.savedConfigs[platform].map((c) =>
                c.id === activeId
                  ? {
                      ...c,
                      fieldAliases: { ...c.fieldAliases, [field]: alias },
                      updatedAt: Date.now(),
                    }
                  : c
              ),
            },
          };
        }),

      updateFormula: (platform, formulaKey, expression) =>
        set((state) => {
          const activeId = state.activeConfigId[platform];
          return {
            savedConfigs: {
              ...state.savedConfigs,
              [platform]: state.savedConfigs[platform].map((c) =>
                c.id === activeId
                  ? {
                      ...c,
                      formulas: { ...c.formulas, [formulaKey]: expression },
                      updatedAt: Date.now(),
                    }
                  : c
              ),
            },
          };
        }),

      // 原始订单数据
      rawOrders: { shopee: [], lazada: [], tiktok: [] },
      importOrders: (platform, data) =>
        set((state) => {
          const newHeaders = mergeHeaders(state.availableHeaders[platform], data.headers);
          return {
            rawOrders: {
              ...state.rawOrders,
              [platform]: [
                ...state.rawOrders[platform],
                { ...data, id: generateId(), importTime: Date.now() },
              ],
            },
            availableHeaders: {
              ...state.availableHeaders,
              [platform]: newHeaders,
            },
          };
        }),
      deleteOrderFile: (platform, orderId) =>
        set((state) => {
          // 重新计算剩余文件的表头
          const remainingOrders = state.rawOrders[platform].filter(
            (o) => o.id !== orderId
          );
          const rebuiltHeaders: string[] = [];
          for (const o of remainingOrders) {
            for (const h of o.headers) {
              if (h.trim() && !rebuiltHeaders.includes(h.trim())) {
                rebuiltHeaders.push(h.trim());
              }
            }
          }
          return {
            rawOrders: {
              ...state.rawOrders,
              [platform]: remainingOrders,
            },
            availableHeaders: {
              ...state.availableHeaders,
              [platform]: rebuiltHeaders,
            },
          };
        }),
      clearOrders: (platform) =>
        set((state) => ({
          rawOrders: {
            ...state.rawOrders,
            [platform]: [],
          },
          availableHeaders: {
            ...state.availableHeaders,
            [platform]: [],
          },
        })),

      // 计算方法
      calculateSummary: (platform) => {
        const state = get();
        const config = state.getActiveConfig(platform);
        const orders = state.rawOrders[platform];
        const skuMap = state.skuMappings;

        const calculatedOrders: CalculatedOrder[] = [];

        // 安全执行公式表达式
        const evalFormula = (expression: string, context: Record<string, number>): number => {
          if (!expression || !expression.trim()) return 0;
          try {
            const keys = Object.keys(context);
            const values = Object.values(context);
            const fn = new Function(...keys, `"use strict"; return (${expression});`);
            const result = fn(...values);
            return typeof result === 'number' && isFinite(result) ? result : 0;
          } catch {
            return 0;
          }
        };

        for (const orderFile of orders) {
          for (const row of orderFile.rows) {
            const mapping = config.fieldMapping;

            const getNumValue = (fieldName: string): number => {
              if (!fieldName) return 0;
              const val = row[fieldName];
              if (val === undefined || val === null || val === '') return 0;
              const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
              return isNaN(num) ? 0 : num;
            };

            const getStrValue = (fieldName: string): string => {
              if (!fieldName) return '';
              const val = row[fieldName];
              return val !== undefined && val !== null ? String(val) : '';
            };

            const sku = getStrValue(mapping.sku);
            const skuInfo = skuMap.find((m) => m.sku === sku);
            const purchasePrice = skuInfo?.purchasePrice ?? 0;
            // SKU 无法匹配出商品名称时，直接使用 SKU 作为商品名称
            const productName = skuInfo?.productName || sku;
            // 店铺名称：优先使用计算配置中选择的店铺名称，否则使用导入时指定的店铺名称
            const shopName = config.shopName || orderFile.shopName || '';
            // 年月：优先使用用户导入时自定义的年月
            const orderDate = orderFile.yearMonth || '';

            // 从字段映射中获取原始数值
            const platformFee = getNumValue(mapping.platformFee);
            const shippingFee = getNumValue(mapping.shippingFee);
            const quantity = getNumValue(mapping.quantity);
            const unitPrice = getNumValue(mapping.unitPrice);
            const platformDiscount = getNumValue(mapping.platformDiscount);

            // 构建公式上下文：字段映射值 + 采购单价
            const formulaContext: Record<string, number> = {
              quantity,
              unitPrice,
              platformDiscount,
              platformFee,
              shippingFee,
              purchasePrice,
            };

            // 按顺序计算公式：totalAmount → netAmount → profit → profitRate
            const computedTotalAmount = evalFormula(config.formulas.totalAmount, formulaContext);
            formulaContext.totalAmount = computedTotalAmount;

            const netAmount = evalFormula(config.formulas.netAmount, formulaContext);
            formulaContext.netAmount = netAmount;

            const profit = evalFormula(config.formulas.profit, formulaContext);
            formulaContext.profit = profit;

            const profitRate = evalFormula(config.formulas.profitRate, formulaContext);

            const purchaseCost = purchasePrice * quantity;

            calculatedOrders.push({
              id: generateId(),
              orderNo: getStrValue(mapping.orderNo),
              sku,
              productName,
              shopName,
              orderDate,
              quantity,
              unitPrice,
              platformDiscount,
              totalAmount: computedTotalAmount,
              platformFee,
              shippingFee,
              netAmount,
              purchasePrice,
              purchaseCost,
              profit,
              profitRate,
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
        const totalProfitRate = totalSales > 0 ? totalProfit / totalSales * 100 : 0;

        return {
          platform,
          totalSales,
          totalOrders,
          totalQuantity,
          totalPlatformFee,
          totalNetAmount,
          totalPurchaseCost,
          totalProfit,
          totalProfitRate,
          orders: calculatedOrders,
        };
      },

      calculateAllSummaries: () => {
        const platforms: Platform[] = ['shopee', 'lazada', 'tiktok'];
        const state = get();
        const result: Record<Platform, PlatformSummary> = {
          shopee: { platform: 'shopee', totalSales: 0, totalOrders: 0, totalQuantity: 0, totalPlatformFee: 0, totalNetAmount: 0, totalPurchaseCost: 0, totalProfit: 0, totalProfitRate: 0, orders: [] },
          lazada: { platform: 'lazada', totalSales: 0, totalOrders: 0, totalQuantity: 0, totalPlatformFee: 0, totalNetAmount: 0, totalPurchaseCost: 0, totalProfit: 0, totalProfitRate: 0, orders: [] },
          tiktok: { platform: 'tiktok', totalSales: 0, totalOrders: 0, totalQuantity: 0, totalPlatformFee: 0, totalNetAmount: 0, totalPurchaseCost: 0, totalProfit: 0, totalProfitRate: 0, orders: [] },
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
          // 仅按商品名称分类，不按 SKU 分类
          const displayName = order.productName || order.sku;
          const key = `${displayName}|${order.shopName || '__all__'}`;
          if (!skuMap.has(key)) {
            skuMap.set(key, {
              sku: order.sku,
              productName: displayName,
              shopName: order.shopName || '-',
              purchasePrice: order.purchasePrice,
              totalQuantity: 0,
              totalSales: 0,
              avgUnitPrice: 0,
              totalPlatformFee: 0,
              totalNetAmount: 0,
              totalPurchaseCost: 0,
              totalProfit: 0,
              profitRate: 0,
              orderCount: 0,
            });
          }
          const s = skuMap.get(key)!;
          s.totalQuantity += order.quantity;
          s.totalSales += order.totalAmount;
          s.totalPlatformFee += order.platformFee;
          s.totalNetAmount += order.netAmount;
          s.totalPurchaseCost += order.purchaseCost;
          s.totalProfit += order.profit;
          s.orderCount += 1;
        }

        // 计算平均单价和利润率
        for (const s of skuMap.values()) {
          s.avgUnitPrice = s.totalQuantity > 0 ? s.totalSales / s.totalQuantity : 0;
          s.profitRate = s.totalSales > 0 ? s.totalProfit / s.totalSales * 100 : 0;
        }

        return Array.from(skuMap.values());
      },
    }),
    {
      name: 'ecommerce-accounting-store',
      // 迁移旧数据：将旧的 calculationConfigs 格式转为新的 savedConfigs
      migrate: (persistedState: unknown, _version: number) => {
        const ps = persistedState as Record<string, unknown>;
        // 如果存在旧的 calculationConfigs 但没有 savedConfigs，执行迁移
        if (ps.calculationConfigs && !ps.savedConfigs) {
          const oldConfigs = ps.calculationConfigs as Record<string, { platform: string; fieldMapping: CalculationConfig['fieldMapping']; formulas: CalculationConfig['formulas'] }>;
          const saved: Record<string, SavedCalcConfig[]> = {};
          const activeIds: Record<string, string> = {};
          for (const [platform, cfg] of Object.entries(oldConfigs)) {
            const id = generateId();
            saved[platform] = [{
              id,
              name: '默认方案',
              shopName: '',
              fieldMapping: { ...cfg.fieldMapping },
              fieldAliases: { ...DEFAULT_FIELD_ALIASES },
              formulas: { ...cfg.formulas },
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }];
            activeIds[platform] = id;
          }
          ps.savedConfigs = saved;
          ps.activeConfigId = activeIds;
          delete ps.calculationConfigs;
        }
        // 为已存在的 savedConfigs 补充缺失字段
        if (ps.savedConfigs) {
          const saved = ps.savedConfigs as Record<string, SavedCalcConfig[]>;
          for (const configs of Object.values(saved)) {
            for (const cfg of configs) {
              if (cfg.shopName === undefined) {
                (cfg as unknown as Record<string, unknown>).shopName = '';
              }
              if (cfg.fieldAliases === undefined) {
                (cfg as unknown as Record<string, unknown>).fieldAliases = { ...DEFAULT_FIELD_ALIASES };
              }
              // 补充新公式字段：totalAmount 和 profitRate
              const formulas = (cfg as unknown as { formulas: Record<string, string> }).formulas;
              if (formulas && formulas.totalAmount === undefined) {
                formulas.totalAmount = 'totalAmount';
              }
              if (formulas && formulas.profitRate === undefined) {
                formulas.profitRate = 'totalAmount > 0 ? profit / totalAmount * 100 : 0';
              }
            }
          }
        }
        return ps;
      },
      version: 4,
    }
  )
);
