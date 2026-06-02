import { create } from 'zustand';
import {
  Platform,
  SkuMapping,
  ShopName,
  RawOrderData,
  CalculatedOrder,
  SkuSummary,
  PlatformSummary,
  SavedCalcConfig,
  OrderFilterRules,
} from '@/types';
import * as dbOps from '@/lib/db';

// ====== 工具函数 ======
const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

const DEFAULT_FIELD_ALIASES: Record<string, string> = {
  orderNo: '订单号',
  sku: 'SKU',
  quantity: '数量',
  unitPrice: '单价',
  platformDiscount: '平台折扣',
  platformFee: '平台手续费',
  shippingFee: '运费',
  commission: '佣金',
  totalAmount: '总价',
  netAmount: '净额',
  profit: '利润',
  profitRate: '利润率',
};

const DEFAULT_FILTER_RULES: OrderFilterRules = {
  excludeStatusField: '',
  excludeStatusValues: [],
  excludeZeroAmount: true,
  quantityOnlyStatusField: '',
  quantityOnlyStatusValues: [],
};

function createDefaultConfig(platform: string): SavedCalcConfig {
  return {
    id: generateId(),
    name: '默认方案',
    platform: platform as Platform,
    fieldMapping: {
      orderNo: '',
      sku: '',
      quantity: '',
      unitPrice: '',
      platformDiscount: '',
      platformFee: '',
      shippingFee: '',
      commission: '',
    },
    fieldAliases: { ...DEFAULT_FIELD_ALIASES },
    formulas: {
      totalAmount: '(unitPrice + platformDiscount) * 1.7',
      netAmount: 'totalAmount - platformFee - shippingFee - commission',
      profit: 'totalAmount - purchasePrice * quantity',
      profitRate: 'totalAmount > 0 ? (totalAmount - purchasePrice * quantity) / totalAmount * 100 : 0',
    },
    filterRules: { ...DEFAULT_FILTER_RULES },
    countQuantityAsRows: platform === 'lazada',
    profitRateRedThreshold: platform === 'tiktok' ? 25 : null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// 公式求值
function evalFormula(formula: string, context: Record<string, number>): number {
  if (!formula || !formula.trim()) return 0;
  try {
    const normalized = formula
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/，/g, ',')
      .replace(/：/g, ':');
    const keys = Object.keys(context);
    const values = Object.values(context);
    const fn = new Function(...keys, `"use strict"; return (${normalized});`);
    const result = fn(...values);
    return typeof result === 'number' && isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

// ====== State 类型 ======
interface AppState {
  // 数据
  skuMappings: SkuMapping[];
  shopNames: ShopName[];
  savedConfigs: Record<Platform, SavedCalcConfig[]>;
  activeConfigId: Record<Platform, string>;
  rawOrders: Record<Platform, RawOrderData[]>;
  availableHeaders: Record<Platform, string[]>;

  // 加载状态
  isLoading: boolean;
  isSaving: boolean;

  // 数据加载
  loadAllData: () => Promise<void>;

  // SKU 映射
  addSkuMapping: (mapping: Omit<SkuMapping, 'id'>) => Promise<void>;
  updateSkuMapping: (id: string, mapping: Partial<SkuMapping>) => Promise<void>;
  deleteSkuMapping: (id: string) => Promise<void>;
  importSkuMappings: (mappings: Omit<SkuMapping, 'id'>[]) => Promise<void>;
  clearSkuMappings: () => Promise<void>;

  // 店铺名称
  addShopName: (name: Omit<ShopName, 'id'>) => Promise<void>;
  addShopNamesBatch: (platform: Platform, names: string[]) => Promise<void>;
  updateShopName: (id: string, name: string) => Promise<void>;
  deleteShopName: (id: string) => Promise<void>;
  clearShopNames: (platform: Platform) => Promise<void>;

  // 计算配置
  getActiveConfig: (platform: Platform) => SavedCalcConfig | undefined;
  setActiveConfig: (platform: Platform, configId: string) => Promise<void>;
  switchConfig: (platform: Platform, configId: string) => Promise<void>;
  saveCurrentConfig: (platform: Platform, name: string) => Promise<void>;
  updateFieldMapping: (platform: Platform, field: string, value: string) => Promise<void>;
  updateFieldAlias: (platform: Platform, field: string, alias: string) => Promise<void>;
  updateFormula: (platform: Platform, field: string, formula: string) => Promise<void>;
  updateFilterRules: (platform: Platform, rules: Partial<OrderFilterRules>) => Promise<void>;
  setCountQuantityAsRows: (platform: Platform, value: boolean) => Promise<void>;
  setProfitRateRedThreshold: (platform: Platform, value: number | null) => Promise<void>;
  saveAsNewConfig: (platform: Platform, name: string) => Promise<void>;
  renameConfig: (platform: Platform, configId: string, name: string) => Promise<void>;
  deleteConfig: (platform: Platform, configId: string) => Promise<void>;

  // 导入数据
  importOrders: (platform: Platform, data: { headers: string[]; rows: Record<string, string | number>[]; shopName: string; yearMonth: string; configId: string; fileName?: string }) => Promise<void>;
  deleteOrderFile: (platform: Platform, fileId: string) => Promise<void>;
  clearOrders: (platform: Platform) => Promise<void>;
  mergeHeaders: (platform: Platform, headers: string[]) => void;

  // 计算方法（纯前端，不涉及数据库）
  calculateSummary: (platform: Platform) => PlatformSummary;
  calculateAllSummaries: () => Record<Platform, PlatformSummary>;
  calculateSkuSummaries: (platform: Platform) => SkuSummary[];
}

export const useAppStore = create<AppState>()((set, get) => ({
  // ====== 初始数据 ======
  skuMappings: [],
  shopNames: [],
  savedConfigs: { shopee: [], lazada: [], tiktok: [] },
  activeConfigId: { shopee: '', lazada: '', tiktok: '' },
  rawOrders: { shopee: [], lazada: [], tiktok: [] },
  availableHeaders: { shopee: [], lazada: [], tiktok: [] },
  isLoading: false,
  isSaving: false,

  // ====== 数据加载 ======
  loadAllData: async () => {
    set({ isLoading: true });
    try {
      const platforms: Platform[] = ['shopee', 'lazada', 'tiktok'];
      const allSkuMappings: SkuMapping[] = [];
      const allShopNames: ShopName[] = [];
      const savedConfigs: Record<Platform, SavedCalcConfig[]> = { shopee: [], lazada: [], tiktok: [] };
      const activeConfigId: Record<Platform, string> = { shopee: '', lazada: '', tiktok: '' };
      const rawOrders: Record<Platform, RawOrderData[]> = { shopee: [], lazada: [], tiktok: [] };
      const availableHeaders: Record<Platform, string[]> = { shopee: [], lazada: [], tiktok: [] };

      for (const p of platforms) {
        // 使用 allSettled 防止单个请求失败阻塞整个加载
        const results = await Promise.allSettled([
          dbOps.getSkuMappings(p),
          dbOps.getShopNames(p),
          dbOps.getCalcConfigs(p),
          dbOps.getOrderFiles(p),
        ]);

        const skus = results[0].status === 'fulfilled' ? results[0].value : [];
        const shops = results[1].status === 'fulfilled' ? results[1].value : [];
        const configs = results[2].status === 'fulfilled' ? results[2].value : [];
        const files = results[3].status === 'fulfilled' ? results[3].value : [];

        // 记录失败信息
        for (const r of results) {
          if (r.status === 'rejected') {
            console.warn(`加载 ${p} 数据失败:`, r.reason);
          }
        }

        allSkuMappings.push(...skus);
        allShopNames.push(...shops);

        for (const config of configs) {
          if (!savedConfigs[p]) savedConfigs[p] = [];
          savedConfigs[p].push(config);
        }

        // 如果某平台无配置，创建默认
        if (savedConfigs[p].length === 0) {
          const defaultConfig = createDefaultConfig(p);
          savedConfigs[p] = [defaultConfig];
          activeConfigId[p] = defaultConfig.id;
          // 异步保存默认配置，不阻塞加载
          dbOps.upsertCalcConfig(defaultConfig, p, true).catch((e) =>
            console.warn(`保存 ${p} 默认配置失败:`, e)
          );
        } else {
          // 使用第一个配置作为活跃配置
          activeConfigId[p] = savedConfigs[p][0].id;
        }

        // 组织订单文件
        rawOrders[p] = files;
        const headersSet = new Set<string>();
        for (const file of files) {
          for (const h of file.headers) {
            headersSet.add(h.trim());
          }
          for (const row of file.rows) {
            for (const k of Object.keys(row)) {
              headersSet.add(k.trim());
            }
          }
        }
        availableHeaders[p] = Array.from(headersSet).filter(Boolean);
      }

      set({ skuMappings: allSkuMappings, shopNames: allShopNames, savedConfigs, activeConfigId, rawOrders, availableHeaders });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // ====== SKU 映射 ======
  addSkuMapping: async (mapping) => {
    const id = generateId();
    const newMapping = { ...mapping, id };
    set((s) => ({ skuMappings: [...s.skuMappings, newMapping] }));
    await dbOps.upsertSkuMapping(newMapping);
  },

  updateSkuMapping: async (id, mapping) => {
    set((s) => ({
      skuMappings: s.skuMappings.map((m) => (m.id === id ? { ...m, ...mapping } : m)),
    }));
    const existing = get().skuMappings.find((m) => m.id === id);
    if (existing) await dbOps.upsertSkuMapping(existing);
  },

  deleteSkuMapping: async (id) => {
    set((s) => ({ skuMappings: s.skuMappings.filter((m) => m.id !== id) }));
    await dbOps.deleteSkuMapping(id);
  },

  importSkuMappings: async (mappings) => {
    const newMappings = mappings.map((m) => ({ ...m, id: generateId() }));
    set((s) => ({ skuMappings: [...s.skuMappings, ...newMappings] }));
    for (const m of newMappings) {
      await dbOps.upsertSkuMapping(m);
    }
  },

  clearSkuMappings: async () => {
    const ids = get().skuMappings.map((m) => m.id);
    set({ skuMappings: [] });
    for (const id of ids) {
      await dbOps.deleteSkuMapping(id);
    }
  },

  // ====== 店铺名称 ======
  addShopName: async (name) => {
    const id = generateId();
    const newName = { ...name, id };
    set((s) => ({ shopNames: [...s.shopNames, newName] }));
    await dbOps.upsertShopName(newName);
  },

  addShopNamesBatch: async (platform, names) => {
    const newNames: ShopName[] = names.map((name) => ({
      id: generateId(),
      name,
      platform,
      createdAt: Date.now(),
    }));
    set((s) => ({ shopNames: [...s.shopNames, ...newNames] }));
    for (const name of newNames) {
      await dbOps.upsertShopName(name);
    }
  },

  updateShopName: async (id, name) => {
    set((s) => ({
      shopNames: s.shopNames.map((n) => (n.id === id ? { ...n, name } : n)),
    }));
    const current = get().shopNames.find((n) => n.id === id);
    if (current) await dbOps.upsertShopName(current);
  },

  deleteShopName: async (id) => {
    set((s) => ({ shopNames: s.shopNames.filter((n) => n.id !== id) }));
    await dbOps.deleteShopName(id);
  },

  clearShopNames: async (platform) => {
    const ids = get().shopNames.filter((n) => n.platform === platform).map((n) => n.id);
    set((s) => ({ shopNames: s.shopNames.filter((n) => n.platform !== platform) }));
    for (const id of ids) {
      await dbOps.deleteShopName(id);
    }
  },

  // ====== 计算配置 ======
  getActiveConfig: (platform) => {
    const state = get();
    const configs = state.savedConfigs[platform] || [];
    return configs.find((c) => c.id === state.activeConfigId[platform]);
  },

  setActiveConfig: async (platform, configId) => {
    set((s) => ({ activeConfigId: { ...s.activeConfigId, [platform]: configId } }));
    // 更新数据库中的 is_active 状态
    const configs = get().savedConfigs[platform] || [];
    for (const config of configs) {
      const isActive = config.id === configId;
      await dbOps.upsertCalcConfig(config, platform, isActive);
    }
  },

  updateFieldMapping: async (platform, field, value) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) =>
          c.id === activeId
            ? { ...c, fieldMapping: { ...c.fieldMapping, [field]: value }, updatedAt: Date.now() }
            : c
        ),
      },
    }));
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (config) await dbOps.upsertCalcConfig(config, platform, activeId === get().activeConfigId[platform]);
  },

  updateFieldAlias: async (platform, field, alias) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) =>
          c.id === activeId
            ? { ...c, fieldAliases: { ...c.fieldAliases, [field]: alias }, updatedAt: Date.now() }
            : c
        ),
      },
    }));
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (config) await dbOps.upsertCalcConfig(config, platform, activeId === get().activeConfigId[platform]);
  },

  updateFormula: async (platform, field, formula) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) =>
          c.id === activeId
            ? { ...c, formulas: { ...c.formulas, [field]: formula }, updatedAt: Date.now() }
            : c
        ),
      },
    }));
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (config) await dbOps.upsertCalcConfig(config, platform, activeId === get().activeConfigId[platform]);
  },

  updateFilterRules: async (platform, rules) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) =>
          c.id === activeId
            ? { ...c, filterRules: { ...c.filterRules, ...rules }, updatedAt: Date.now() }
            : c
        ),
      },
    }));
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (config) await dbOps.upsertCalcConfig(config, platform, activeId === get().activeConfigId[platform]);
  },

  setCountQuantityAsRows: async (platform, value) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) =>
          c.id === activeId ? { ...c, countQuantityAsRows: value, updatedAt: Date.now() } : c
        ),
      },
    }));
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (config) await dbOps.upsertCalcConfig(config, platform, activeId === get().activeConfigId[platform]);
  },

  setProfitRateRedThreshold: async (platform, value) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) =>
          c.id === activeId ? { ...c, profitRateRedThreshold: value, updatedAt: Date.now() } : c
        ),
      },
    }));
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (config) await dbOps.upsertCalcConfig(config, platform, activeId === get().activeConfigId[platform]);
  },

  saveAsNewConfig: async (platform, name) => {
    const activeConfig = get().getActiveConfig(platform);
    if (!activeConfig) return;
    const newConfig: SavedCalcConfig = {
      ...activeConfig,
      id: generateId(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: [...s.savedConfigs[platform], newConfig],
      },
      activeConfigId: { ...s.activeConfigId, [platform]: newConfig.id },
    }));
    // 更新数据库：新方案激活，旧方案取消激活
    await dbOps.upsertCalcConfig(newConfig, platform, true);
    const oldConfig = get().savedConfigs[platform].find((c) => c.id === activeConfig.id);
    if (oldConfig) await dbOps.upsertCalcConfig(oldConfig, platform, false);
  },

  renameConfig: async (platform, configId, name) => {
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) =>
          c.id === configId ? { ...c, name, updatedAt: Date.now() } : c
        ),
      },
    }));
    const config = get().savedConfigs[platform].find((c) => c.id === configId);
    if (config) await dbOps.upsertCalcConfig(config, platform, configId === get().activeConfigId[platform]);
  },

  deleteConfig: async (platform, configId) => {
    const configs = get().savedConfigs[platform];
    if (configs.length <= 1) return; // 至少保留一个
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].filter((c) => c.id !== configId),
      },
      activeConfigId: s.activeConfigId[platform] === configId
        ? { ...s.activeConfigId, [platform]: configs[0].id === configId ? configs[1].id : configs[0].id }
        : s.activeConfigId,
    }));
    await dbOps.deleteCalcConfig(configId);
  },

  saveCurrentConfig: async (platform, name) => {
    const activeConfig = get().getActiveConfig(platform);
    if (!activeConfig) return;
    const id = generateId();
    const newConfig: SavedCalcConfig = {
      ...activeConfig,
      id,
      name,
      fieldMapping: { ...activeConfig.fieldMapping },
      fieldAliases: { ...activeConfig.fieldAliases },
      formulas: { ...activeConfig.formulas },
      filterRules: { ...activeConfig.filterRules },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: [...s.savedConfigs[platform], newConfig],
      },
      activeConfigId: { ...s.activeConfigId, [platform]: id },
    }));
    await dbOps.upsertCalcConfig(newConfig, platform, true);
  },

  switchConfig: async (platform, configId) => {
    set({ activeConfigId: { ...get().activeConfigId, [platform]: configId } });
    // 更新数据库中的 is_active 状态
    const configs = get().savedConfigs[platform] || [];
    for (const config of configs) {
      const isActive = config.id === configId;
      await dbOps.upsertCalcConfig(config, platform, isActive);
    }
  },

  // ====== 导入数据 ======
  importOrders: async (platform, data) => {
    const id = generateId();
    const importTime = Date.now();
    const orderFile: RawOrderData = {
      id,
      platform,
      fileName: data.fileName || '',
      importTime,
      headers: data.headers,
      rows: data.rows,
      shopName: data.shopName,
      yearMonth: data.yearMonth,
      configId: data.configId,
    };

    set((s) => ({
      rawOrders: {
        ...s.rawOrders,
        [platform]: [...s.rawOrders[platform], orderFile],
      },
    }));

    // 合并 headers
    get().mergeHeaders(platform, data.headers);

    // 写入 Supabase
    await dbOps.insertOrderFile(
      {
        id,
        platform,
        config_id: data.configId || null,
        shop_name: data.shopName,
        year_month: data.yearMonth,
        import_time: importTime,
        headers: data.headers,
        file_name: data.fileName || '',
      },
      data.rows
    );
  },

  deleteOrderFile: async (platform, fileId) => {
    set((s) => ({
      rawOrders: {
        ...s.rawOrders,
        [platform]: s.rawOrders[platform].filter((f) => f.id !== fileId),
      },
    }));
    await dbOps.deleteOrderFile(fileId);
  },

  clearOrders: async (platform) => {
    const ids = get().rawOrders[platform].map((f) => f.id);
    set((s) => ({
      rawOrders: { ...s.rawOrders, [platform]: [] },
      availableHeaders: { ...s.availableHeaders, [platform]: [] },
    }));
    for (const id of ids) {
      await dbOps.deleteOrderFile(id);
    }
  },

  mergeHeaders: (platform, headers) => {
    set((s) => {
      const existing = s.availableHeaders[platform] || [];
      const merged = [...new Set([...existing, ...headers])].map((h) => h.trim()).filter(Boolean);
      return { availableHeaders: { ...s.availableHeaders, [platform]: merged } };
    });
  },

  // ====== 计算方法（纯前端，不涉及数据库）======
  calculateSummary: (platform) => {
    const state = get();
    const orders = state.rawOrders[platform] || [];
    const activeConfig = state.getActiveConfig(platform);
    const calculatedOrders: CalculatedOrder[] = [];
    let excludedCount = 0;

    for (const orderFile of orders) {
      const config = orderFile.configId
        ? (state.savedConfigs[platform] || []).find((c) => c.id === orderFile.configId) || activeConfig
        : activeConfig;

      if (!config) continue;

      const mapping = config.fieldMapping;
      const aliases = config.fieldAliases;

      for (const row of orderFile.rows) {
        // 尝试多种方式获取值：先精确匹配 key，再尝试 trim 后匹配
        const getNumValue = (fieldName: string): number => {
          if (!fieldName) return 0;
          const alias = aliases[fieldName] || fieldName;
          let val = row[fieldName] ?? row[alias];
          if (val === undefined || val === null) {
            for (const key of Object.keys(row)) {
              if (key.trim() === fieldName || key.trim() === alias) {
                val = row[key];
                break;
              }
            }
          }
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        };

        const getStrValue = (fieldName: string): string => {
          if (!fieldName) return '';
          const alias = aliases[fieldName] || fieldName;
          let val = row[fieldName] ?? row[alias];
          if (val === undefined || val === null) {
            for (const key of Object.keys(row)) {
              if (key.trim() === fieldName || key.trim() === alias) {
                val = row[key];
                break;
              }
            }
          }
          return String(val ?? '');
        };

        const platformFee = getNumValue(mapping.platformFee);
        const shippingFee = getNumValue(mapping.shippingFee);
        const commission = getNumValue(mapping.commission);
        const rawQuantity = getNumValue(mapping.quantity);
        const quantity = config.countQuantityAsRows ? 1 : rawQuantity;
        const unitPrice = getNumValue(mapping.unitPrice);
        const platformDiscount = getNumValue(mapping.platformDiscount);

        // 过滤逻辑
        const filterRules = config.filterRules;

        if (filterRules.excludeStatusField && filterRules.excludeStatusValues.length > 0) {
          const rawValue = getStrValue(filterRules.excludeStatusField).trim();
          const shouldExclude = filterRules.excludeStatusValues.some(
            (v) => v.trim().toLowerCase() === rawValue.toLowerCase()
          );
          if (shouldExclude) {
            excludedCount++;
            continue;
          }
        }

        if (filterRules.excludeZeroAmount) {
          const checkTotal = (unitPrice + platformDiscount) * 1.7;
          if (checkTotal === 0) {
            excludedCount++;
            continue;
          }
        }

        let countOnlyQuantity = false;
        if (filterRules.quantityOnlyStatusField && filterRules.quantityOnlyStatusValues.length > 0) {
          const rawValue = getStrValue(filterRules.quantityOnlyStatusField).trim();
          const shouldCountOnly = filterRules.quantityOnlyStatusValues.some(
            (v) => v.trim().toLowerCase() === rawValue.toLowerCase()
          );
          if (shouldCountOnly) {
            countOnlyQuantity = true;
          }
        }

        const sku = getStrValue(mapping.sku);
        const skuInfo = state.skuMappings.find((m) => m.sku === sku);
        const productName = skuInfo?.productName || sku;
        const purchasePrice = skuInfo?.purchasePrice || 0;
        const orderShopName = orderFile.shopName || '';
        const orderDate = orderFile.yearMonth || '';

        const formulaContext: Record<string, number> = {
          quantity,
          unitPrice: countOnlyQuantity ? 0 : unitPrice,
          platformDiscount,
          platformFee,
          shippingFee,
          commission,
          purchasePrice: countOnlyQuantity ? 0 : purchasePrice,
        };

        const computedTotalAmount = evalFormula(config.formulas.totalAmount, formulaContext);
        formulaContext.totalAmount = computedTotalAmount;

        const netAmount = evalFormula(config.formulas.netAmount, formulaContext);
        formulaContext.netAmount = netAmount;

        const profit = evalFormula(config.formulas.profit, formulaContext);
        formulaContext.profit = profit;

        const profitRate = evalFormula(config.formulas.profitRate, formulaContext);

        const purchaseCost = countOnlyQuantity ? 0 : purchasePrice * quantity;

        calculatedOrders.push({
          id: generateId(),
          orderNo: getStrValue(mapping.orderNo),
          sku,
          productName,
          shopName: orderShopName,
          orderDate,
          quantity,
          unitPrice,
          platformDiscount,
          totalAmount: computedTotalAmount,
          platformFee,
          shippingFee,
          commission,
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
    const totalProfit = totalSales - totalPurchaseCost;
    const totalProfitRate = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

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
      excludedCount,
      orders: calculatedOrders,
    };
  },

  calculateAllSummaries: () => {
    const platforms: Platform[] = ['shopee', 'lazada', 'tiktok'];
    const state = get();
    const result: Record<Platform, PlatformSummary> = {
      shopee: { platform: 'shopee', totalSales: 0, totalOrders: 0, totalQuantity: 0, totalPlatformFee: 0, totalNetAmount: 0, totalPurchaseCost: 0, totalProfit: 0, totalProfitRate: 0, excludedCount: 0, orders: [] },
      lazada: { platform: 'lazada', totalSales: 0, totalOrders: 0, totalQuantity: 0, totalPlatformFee: 0, totalNetAmount: 0, totalPurchaseCost: 0, totalProfit: 0, totalProfitRate: 0, excludedCount: 0, orders: [] },
      tiktok: { platform: 'tiktok', totalSales: 0, totalOrders: 0, totalQuantity: 0, totalPlatformFee: 0, totalNetAmount: 0, totalPurchaseCost: 0, totalProfit: 0, totalProfitRate: 0, excludedCount: 0, orders: [] },
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
      s.orderCount += 1;
    }

    for (const s of skuMap.values()) {
      s.avgUnitPrice = s.totalQuantity > 0 ? s.totalSales / s.totalQuantity : 0;
      s.totalProfit = s.totalSales - s.totalPurchaseCost;
      s.profitRate = s.totalSales > 0 ? (s.totalProfit / s.totalSales) * 100 : 0;
    }

    return Array.from(skuMap.values());
  },
}));
