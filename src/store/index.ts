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

// ====== 自动持久化到 localStorage（双重备份） ======
interface LocalPersistState {
  skuMappings: SkuMapping[];
  shopNames: ShopName[];
  savedConfigs: Record<Platform, SavedCalcConfig[]>;
  activeConfigId?: Record<Platform, string>;
}

function persistToLocal(state: LocalPersistState) {
  dbOps.saveAllToLocalStorage({
    skuMappings: state.skuMappings,
    shopNames: state.shopNames,
    savedConfigs: state.savedConfigs,
    rawOrders: { shopee: [], lazada: [], tiktok: [] }, // rawOrders 数据量大，不在每次变更时持久化
    activeConfigId: state.activeConfigId,
  });
}

let _persistTimer: number | null = null;
let _isIdleCallback = false;
function schedulePersist(state: LocalPersistState) {
  if (_persistTimer !== null) {
    if (_isIdleCallback) cancelIdleCallback(_persistTimer);
    else clearTimeout(_persistTimer);
  }
  const doPersist = () => { _persistTimer = null; _isIdleCallback = false; persistToLocal(state); };
  if (typeof requestIdleCallback !== 'undefined') {
    _isIdleCallback = true;
    _persistTimer = requestIdleCallback(doPersist, { timeout: 2000 });
  } else {
    _isIdleCallback = false;
    _persistTimer = setTimeout(doPersist, 500) as unknown as number;
  }
}

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
  dbConnected: boolean;

  // 数据加载
  loadAllData: () => Promise<void>;
  retryConnection: () => Promise<void>;

  // SKU 映射
  addSkuMapping: (mapping: Omit<SkuMapping, 'id'>) => Promise<void>;
  updateSkuMapping: (id: string, mapping: Partial<SkuMapping>) => Promise<void>;
  deleteSkuMapping: (id: string) => Promise<void>;
  deleteSkuMappingsBatch: (ids: string[]) => Promise<void>;
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
  dbConnected: false,

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

      let anySuccess = false;

      // 先测试 Supabase 连接
      anySuccess = await dbOps.testConnection();

      for (const p of platforms) {
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

        if (results.some(r => r.status === 'fulfilled' && (r.value as unknown[]).length >= 0)) {
          anySuccess = true;
        }

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

        if (savedConfigs[p].length === 0) {
          const defaultConfig = createDefaultConfig(p);
          savedConfigs[p] = [defaultConfig];
          activeConfigId[p] = defaultConfig.id;
          dbOps.upsertCalcConfig(defaultConfig, p, true).catch((e) =>
            console.warn(`保存 ${p} 默认配置失败:`, e)
          );
        } else {
          activeConfigId[p] = savedConfigs[p][0].id;
        }

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

      // 如果 Supabase 全部失败，从 localStorage 恢复
      if (!anySuccess) {
        console.warn('Supabase 全部失败，从 localStorage 恢复数据');
        const localData = dbOps.loadAllFromLocalStorage();
        if (localData) {
          const restoredActiveConfigId: Record<Platform, string> = { shopee: '', lazada: '', tiktok: '' };
          for (const p of platforms) {
            const configs = localData.savedConfigs[p];
            if (configs && configs.length > 0) {
              restoredActiveConfigId[p] = localData.activeConfigId?.[p] || configs[0].id;
            }
          }
          set({
            skuMappings: localData.skuMappings,
            shopNames: localData.shopNames,
            savedConfigs: localData.savedConfigs,
            activeConfigId: restoredActiveConfigId,
            rawOrders: localData.rawOrders,
            availableHeaders,
            dbConnected: false,
          });
          return;
        }
      }

      set({
        skuMappings: allSkuMappings,
        shopNames: allShopNames,
        savedConfigs,
        activeConfigId,
        rawOrders,
        availableHeaders,
        dbConnected: anySuccess,
      });
    } catch (error) {
      console.error('加载数据失败:', error);
      // 尝试从 localStorage 恢复
      const localData = dbOps.loadAllFromLocalStorage();
      if (localData) {
        set({
          skuMappings: localData.skuMappings,
          shopNames: localData.shopNames,
          savedConfigs: localData.savedConfigs,
          rawOrders: localData.rawOrders,
          dbConnected: false,
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  retryConnection: async () => {
    await get().loadAllData();
  },

  // ====== SKU 映射 ======
  addSkuMapping: async (mapping) => {
    const id = generateId();
    const newMapping = { ...mapping, id };
    const ok = await dbOps.upsertSkuMapping(newMapping);
    if (ok) {
      set((s) => ({ skuMappings: [...s.skuMappings, newMapping] }));
    } else {
      console.error('新增 SKU 失败，数据可能未同步');
    }
  },

  updateSkuMapping: async (id, mapping) => {
    const updated = { ...get().skuMappings.find((m) => m.id === id), ...mapping };
    if (updated.id) {
      const ok = await dbOps.upsertSkuMapping(updated as SkuMapping);
      if (ok) {
        set((s) => ({
          skuMappings: s.skuMappings.map((m) => (m.id === id ? { ...m, ...mapping } : m)),
        }));
      } else {
        console.error('更新 SKU 失败，数据可能未同步');
      }
    }
  },

  deleteSkuMapping: async (id) => {
    // 先删除 Supabase，成功后再更新本地状态，防止刷新后数据恢复
    const ok = await dbOps.deleteSkuMapping(id);
    if (ok) {
      set((s) => ({ skuMappings: s.skuMappings.filter((m) => m.id !== id) }));
    } else {
      console.error('删除 SKU 失败，数据可能未同步');
    }
  },

  deleteSkuMappingsBatch: async (ids: string[]) => {
    const ok = await dbOps.deleteSkuMappingsBatch(ids);
    if (ok) {
      const idSet = new Set(ids);
      set((s) => ({ skuMappings: s.skuMappings.filter((m) => !idSet.has(m.id)) }));
    } else {
      console.error('批量删除 SKU 失败，数据可能未同步');
    }
  },

  importSkuMappings: async (mappings) => {
    const newMappings = mappings.map((m) => ({ ...m, id: generateId() }));
    const ok = await dbOps.upsertSkuMappingsBatch(newMappings);
    if (ok) {
      set((s) => ({ skuMappings: [...s.skuMappings, ...newMappings] }));
    } else {
      console.error('导入 SKU 失败，数据可能未同步');
    }
  },

  clearSkuMappings: async () => {
    const ids = get().skuMappings.map((m) => m.id);
    const ok = await dbOps.deleteSkuMappingsBatch(ids);
    if (ok) {
      set({ skuMappings: [] });
    } else {
      console.error('清空 SKU 失败，数据可能未同步');
    }
  },

  // ====== 店铺名称 ======
  addShopName: async (name) => {
    const id = generateId();
    const newName = { ...name, id };
    const ok = await dbOps.insertShopName(newName);
    if (ok) {
      set((s) => ({ shopNames: [...s.shopNames, newName] }));
    } else {
      console.error('新增店铺失败，数据可能未同步');
    }
  },

  addShopNamesBatch: async (platform, names) => {
    const newNames: ShopName[] = names.map((name) => ({
      id: generateId(),
      name,
      platform,
      createdAt: Date.now(),
    }));
    const ok = await dbOps.upsertShopNamesBatch(newNames);
    if (ok) {
      set((s) => ({ shopNames: [...s.shopNames, ...newNames] }));
    } else {
      console.error('批量新增店铺失败，数据可能未同步');
    }
  },

  updateShopName: async (id, name) => {
    const current = get().shopNames.find((n) => n.id === id);
    if (current) {
      const updated = { ...current, name };
      const ok = await dbOps.insertShopName(updated);
      if (ok) {
        set((s) => ({
          shopNames: s.shopNames.map((n) => (n.id === id ? { ...n, name } : n)),
        }));
      } else {
        console.error('更新店铺失败，数据可能未同步');
      }
    }
  },

  deleteShopName: async (id) => {
    const ok = await dbOps.deleteShopName(id);
    if (ok) {
      set((s) => ({ shopNames: s.shopNames.filter((n) => n.id !== id) }));
    } else {
      console.error('删除店铺失败，数据可能未同步');
    }
  },

  clearShopNames: async (platform) => {
    const ids = get().shopNames.filter((n) => n.platform === platform).map((n) => n.id);
    const ok = await dbOps.deleteShopNamesBatch(ids);
    if (ok) {
      set((s) => ({ shopNames: s.shopNames.filter((n) => n.platform !== platform) }));
    } else {
      console.error('清空店铺失败，数据可能未同步');
    }
  },

  // ====== 计算配置 ======
  getActiveConfig: (platform) => {
    const state = get();
    const configs = state.savedConfigs[platform] || [];
    return configs.find((c) => c.id === state.activeConfigId[platform]);
  },

  setActiveConfig: async (platform, configId) => {
    // 先写数据库，再更新本地
    const configs = get().savedConfigs[platform] || [];
    const results = await Promise.all(
      configs.map((config) => {
        const isActive = config.id === configId;
        return dbOps.upsertCalcConfig(config, platform, isActive);
      })
    );
    if (results.some((r) => r)) {
      set((s) => ({ activeConfigId: { ...s.activeConfigId, [platform]: configId } }));
    } else {
      console.error('切换配置失败，数据可能未同步');
    }
  },

  updateFieldMapping: async (platform, field, value) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    // 先计算更新后的 config
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!config) return;
    const updatedConfig = { ...config, fieldMapping: { ...config.fieldMapping, [field]: value }, updatedAt: Date.now() };
    const ok = await dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]);
    if (ok) {
      set((s) => ({
        savedConfigs: {
          ...s.savedConfigs,
          [platform]: s.savedConfigs[platform].map((c) =>
            c.id === activeId ? updatedConfig : c
          ),
        },
      }));
    } else {
      console.error('更新字段映射失败，数据可能未同步');
    }
  },

  updateFieldAlias: async (platform, field, alias) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!config) return;
    const updatedConfig = { ...config, fieldAliases: { ...config.fieldAliases, [field]: alias }, updatedAt: Date.now() };
    const ok = await dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]);
    if (ok) {
      set((s) => ({
        savedConfigs: {
          ...s.savedConfigs,
          [platform]: s.savedConfigs[platform].map((c) =>
            c.id === activeId ? updatedConfig : c
          ),
        },
      }));
    } else {
      console.error('更新字段别名失败，数据可能未同步');
    }
  },

  updateFormula: async (platform, field, formula) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!config) return;
    const updatedConfig = { ...config, formulas: { ...config.formulas, [field]: formula }, updatedAt: Date.now() };
    const ok = await dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]);
    if (ok) {
      set((s) => ({
        savedConfigs: {
          ...s.savedConfigs,
          [platform]: s.savedConfigs[platform].map((c) =>
            c.id === activeId ? updatedConfig : c
          ),
        },
      }));
    } else {
      console.error('更新公式失败，数据可能未同步');
    }
  },

  updateFilterRules: async (platform, rules) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!config) return;
    const updatedConfig = { ...config, filterRules: { ...config.filterRules, ...rules }, updatedAt: Date.now() };
    const ok = await dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]);
    if (ok) {
      set((s) => ({
        savedConfigs: {
          ...s.savedConfigs,
          [platform]: s.savedConfigs[platform].map((c) =>
            c.id === activeId ? updatedConfig : c
          ),
        },
      }));
    } else {
      console.error('更新筛选规则失败，数据可能未同步');
    }
  },

  setCountQuantityAsRows: async (platform, value) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!config) return;
    const updatedConfig = { ...config, countQuantityAsRows: value, updatedAt: Date.now() };
    const ok = await dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]);
    if (ok) {
      set((s) => ({
        savedConfigs: {
          ...s.savedConfigs,
          [platform]: s.savedConfigs[platform].map((c) =>
            c.id === activeId ? updatedConfig : c
          ),
        },
      }));
    } else {
      console.error('更新只统计数量设置失败，数据可能未同步');
    }
  },

  setProfitRateRedThreshold: async (platform, value) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const config = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!config) return;
    const updatedConfig = { ...config, profitRateRedThreshold: value, updatedAt: Date.now() };
    const ok = await dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]);
    if (ok) {
      set((s) => ({
        savedConfigs: {
          ...s.savedConfigs,
          [platform]: s.savedConfigs[platform].map((c) =>
            c.id === activeId ? updatedConfig : c
          ),
        },
      }));
    } else {
      console.error('更新利润率红线失败，数据可能未同步');
    }
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
    const ok = await dbOps.upsertCalcConfig(newConfig, platform, true);
    if (ok) {
      set((s) => ({
        savedConfigs: {
          ...s.savedConfigs,
          [platform]: [...s.savedConfigs[platform], newConfig],
        },
        activeConfigId: { ...s.activeConfigId, [platform]: newConfig.id },
      }));
      // 旧方案取消激活
      const oldConfig = get().savedConfigs[platform].find((c) => c.id === activeConfig.id);
      if (oldConfig) dbOps.upsertCalcConfig(oldConfig, platform, false).catch(console.error);
    } else {
      console.error('保存新配置失败，数据可能未同步');
    }
  },

  renameConfig: async (platform, configId, name) => {
    const config = get().savedConfigs[platform].find((c) => c.id === configId);
    if (!config) return;
    const updatedConfig = { ...config, name, updatedAt: Date.now() };
    const ok = await dbOps.upsertCalcConfig(updatedConfig, platform, configId === get().activeConfigId[platform]);
    if (ok) {
      set((s) => ({
        savedConfigs: {
          ...s.savedConfigs,
          [platform]: s.savedConfigs[platform].map((c) =>
            c.id === configId ? updatedConfig : c
          ),
        },
      }));
    } else {
      console.error('重命名配置失败，数据可能未同步');
    }
  },

  deleteConfig: async (platform, configId) => {
    const configs = get().savedConfigs[platform];
    if (configs.length <= 1) return; // 至少保留一个
    const ok = await dbOps.deleteCalcConfig(configId);
    if (ok) {
      set((s) => ({
        savedConfigs: {
          ...s.savedConfigs,
          [platform]: s.savedConfigs[platform].filter((c) => c.id !== configId),
        },
        activeConfigId: s.activeConfigId[platform] === configId
          ? { ...s.activeConfigId, [platform]: configs[0].id === configId ? configs[1].id : configs[0].id }
          : s.activeConfigId,
      }));
    } else {
      console.error('删除配置失败，数据可能未同步');
    }
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
    const ok = await dbOps.upsertCalcConfig(newConfig, platform, true);
    if (ok) {
      set((s) => ({
        savedConfigs: {
          ...s.savedConfigs,
          [platform]: [...s.savedConfigs[platform], newConfig],
        },
        activeConfigId: { ...s.activeConfigId, [platform]: id },
      }));
    } else {
      console.error('保存配置失败，数据可能未同步');
    }
  },

  switchConfig: async (platform, configId) => {
    // 先写数据库，再更新本地
    const configs = get().savedConfigs[platform] || [];
    const results = await Promise.all(
      configs.map((config) => {
        const isActive = config.id === configId;
        return dbOps.upsertCalcConfig(config, platform, isActive);
      })
    );
    if (results.some((r) => r)) {
      set({ activeConfigId: { ...get().activeConfigId, [platform]: configId } });
    } else {
      console.error('切换配置失败，数据可能未同步');
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

    // 先写 Supabase，再更新本地
    const ok = await dbOps.insertOrderFile(
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
    if (ok) {
      set((s) => ({
        rawOrders: {
          ...s.rawOrders,
          [platform]: [...s.rawOrders[platform], orderFile],
        },
      }));
      // 合并 headers
      get().mergeHeaders(platform, data.headers);
    } else {
      console.error('导入订单失败，数据可能未同步');
    }
  },

  deleteOrderFile: async (platform, fileId) => {
    const ok = await dbOps.deleteOrderFile(fileId);
    if (ok) {
      set((s) => ({
        rawOrders: {
          ...s.rawOrders,
          [platform]: s.rawOrders[platform].filter((f) => f.id !== fileId),
        },
      }));
    } else {
      console.error('删除订单文件失败，数据可能未同步');
    }
  },

  clearOrders: async (platform) => {
    const ids = get().rawOrders[platform].map((f) => f.id);
    const ok = await dbOps.deleteOrderFilesBatch(ids);
    if (ok) {
      set((s) => ({
        rawOrders: { ...s.rawOrders, [platform]: [] },
        availableHeaders: { ...s.availableHeaders, [platform]: [] },
      }));
    } else {
      console.error('清空订单失败，数据可能未同步');
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
          platformDiscount: countOnlyQuantity && platform === 'tiktok' ? 0 : platformDiscount,
          platformFee: countOnlyQuantity && platform === 'tiktok' ? 0 : platformFee,
          shippingFee: countOnlyQuantity && platform === 'tiktok' ? 0 : shippingFee,
          commission: countOnlyQuantity && platform === 'tiktok' ? 0 : commission,
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

// ====== 自动持久化到 localStorage ======
useAppStore.subscribe((state) => {
  schedulePersist(state);
});
