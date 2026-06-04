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

// ====== 后台 Supabase 同步（fire-and-forget） ======
// UI 只管本地状态（即时响应），Supabase 写入在后台异步执行
// 失败时自动重试，最多 3 次，仍失败则放弃（下次 loadAllData 会重新同步）
const _pendingWrites: Array<{ label: string; execute: () => Promise<boolean>; retries: number }> = [];
let _writing = false;

async function _processWriteQueue() {
  console.log(`[sync] _processWriteQueue called, queue=${_pendingWrites.length}, writing=${_writing}`);
  if (_writing) return;
  _writing = true;
  while (_pendingWrites.length > 0) {
    const task = _pendingWrites.shift()!;
    const t0 = Date.now();
    try {
      const ok = await task.execute();
      const elapsed = Date.now() - t0;
      console.log(`[syncToRemote] ${task.label} ${ok ? 'OK' : 'FAILED'} in ${elapsed}ms${task.retries > 0 ? ` (retry ${task.retries})` : ''}`);
      if (!ok && task.retries < 3) {
        task.retries++;
        _pendingWrites.push(task);
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      const elapsed = Date.now() - t0;
      console.log(`[syncToRemote] ${task.label} ERROR in ${elapsed}ms:`, e);
      if (task.retries < 3) {
        task.retries++;
        _pendingWrites.push(task);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  _writing = false;
}

// 设为 true 暂时跳过 Supabase 写入（调试用）
const SKIP_REMOTE_WRITE = false;

function syncToRemote(label: string, execute: () => Promise<boolean>) {
  console.log(`[sync] queued: ${label}`);
  if (SKIP_REMOTE_WRITE) {
    console.log(`[sync] SKIPPED (debug mode): ${label}`);
    return;
  }
  _pendingWrites.push({ label, execute, retries: 0 });
  _processWriteQueue(); // 不 await，fire-and-forget
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
  addSkuMapping: (mapping: Omit<SkuMapping, 'id'>) => void;
  updateSkuMapping: (id: string, mapping: Partial<SkuMapping>) => void;
  deleteSkuMapping: (id: string) => void;
  deleteSkuMappingsBatch: (ids: string[]) => void;
  clearSkuMappingsByPlatform: (platform: Platform) => void;
  importSkuMappings: (mappings: Omit<SkuMapping, 'id'>[]) => void;
  clearSkuMappings: () => void;

  // 店铺名称
  addShopName: (name: Omit<ShopName, 'id'>) => void;
  addShopNamesBatch: (platform: Platform, names: string[]) => void;
  updateShopName: (id: string, name: string) => void;
  deleteShopName: (id: string) => void;
  clearShopNames: (platform: Platform) => void;

  // 计算配置
  getActiveConfig: (platform: Platform) => SavedCalcConfig | undefined;
  setActiveConfig: (platform: Platform, configId: string) => void;
  switchConfig: (platform: Platform, configId: string) => void;
  saveCurrentConfig: (platform: Platform, name: string) => void;
  updateFieldMapping: (platform: Platform, field: string, value: string) => void;
  updateFieldAlias: (platform: Platform, field: string, alias: string) => void;
  updateFormula: (platform: Platform, field: string, formula: string) => void;
  updateFilterRules: (platform: Platform, rules: Partial<OrderFilterRules>) => void;
  setCountQuantityAsRows: (platform: Platform, value: boolean) => void;
  setProfitRateRedThreshold: (platform: Platform, value: number | null) => void;
  saveAsNewConfig: (platform: Platform, name: string) => void;
  renameConfig: (platform: Platform, configId: string, name: string) => void;
  deleteConfig: (platform: Platform, configId: string) => void;

  // 导入数据
  importOrders: (platform: Platform, data: { headers: string[]; rows: Record<string, string | number>[]; shopName: string; yearMonth: string; configId: string; fileName?: string }) => void;
  deleteOrderFile: (platform: Platform, fileId: string) => void;
  clearOrders: (platform: Platform) => void;
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

      // 并行测试连接 + 加载所有平台数据（提升首屏速度）
      const connectionPromise = dbOps.testConnection();

      const platformResults = await Promise.allSettled(
        platforms.map(async (p) => {
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

          for (const r of results) {
            if (r.status === 'rejected') {
              console.warn(`加载 ${p} 数据失败:`, r.reason);
            }
          }

          return { platform: p, skus, shops, configs, files };
        })
      );

      for (const pr of platformResults) {
        if (pr.status !== 'fulfilled') continue;
        const { platform: p, skus, shops, configs, files } = pr.value;
        anySuccess = true;

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

      // 等待连接测试结果（仅更新 dbConnected 状态，不影响 anySuccess 判断）
      const connectionOk = await connectionPromise;
      const finalAnySuccess = anySuccess || connectionOk;

      // 如果 Supabase 全部失败，从 localStorage 恢复
      if (!finalAnySuccess) {
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
        dbConnected: finalAnySuccess,
      });
      // 加载成功后保存一份快照到 localStorage
      if (finalAnySuccess) {
        try { persistSnapshot(); } catch { /* ignore */ }
      }
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

  // ====== SKU 映射（全部同步返回，Supabase 写入后台队列执行） ======
  addSkuMapping: (mapping) => {
    const id = generateId();
    const newMapping = { ...mapping, id };
    set((s) => ({ skuMappings: [...s.skuMappings, newMapping] }));
    syncToRemote('addSkuMapping', () => dbOps.upsertSkuMapping(newMapping));
  },

  updateSkuMapping: (id, mapping) => {
    const t0 = performance.now();
    const prev = get().skuMappings.find((m) => m.id === id);
    set((s) => ({ skuMappings: s.skuMappings.map((m) => (m.id === id ? { ...m, ...mapping } : m)) }));
    console.log(`[PERF] updateSkuMapping: set() took=${(performance.now()-t0).toFixed(1)}ms`);
    const updated = get().skuMappings.find((m) => m.id === id);
    if (updated) {
      syncToRemote('updateSkuMapping', () => dbOps.upsertSkuMapping(updated as SkuMapping));
    }
  },

  deleteSkuMapping: (id) => {
    const t0 = performance.now();
    const prev = get().skuMappings.find((m) => m.id === id);
    set((s) => ({ skuMappings: s.skuMappings.filter((m) => m.id !== id) }));
    console.log(`[PERF] deleteSkuMapping: set() took=${(performance.now()-t0).toFixed(1)}ms`);
    if (prev) {
      syncToRemote('deleteSkuMapping', () => dbOps.deleteSkuMapping(id));
    } else {
      dbOps.deleteSkuMapping(id).catch(console.error);
    }
  },

  deleteSkuMappingsBatch: (ids: string[]) => {
    const idSet = new Set(ids);
    const prev = get().skuMappings.filter((m) => idSet.has(m.id));
    set((s) => ({ skuMappings: s.skuMappings.filter((m) => !idSet.has(m.id)) }));
    syncToRemote('deleteSkuMappingsBatch', () => dbOps.deleteSkuMappingsBatch(ids));
  },

  /** 按平台清空 SKU 映射 — 单条 SQL 请求，极快 */
  clearSkuMappingsByPlatform: (platform: Platform) => {
    const t0 = performance.now();
    const prev = get().skuMappings.filter((m) => m.platform === platform);
    console.log(`[PERF] clearSkuMappingsByPlatform: filter prev=${prev.length}, took=${(performance.now()-t0).toFixed(1)}ms`);
    const t1 = performance.now();
    set((s) => ({ skuMappings: s.skuMappings.filter((m) => m.platform !== platform) }));
    console.log(`[PERF] clearSkuMappingsByPlatform: set() took=${(performance.now()-t1).toFixed(1)}ms, total=${(performance.now()-t0).toFixed(1)}ms`);
    syncToRemote('clearSkuMappingsByPlatform', () => dbOps.deleteSkuMappingsByPlatform(platform));
  },

  importSkuMappings: (mappings) => {
    const newMappings = mappings.map((m) => ({ ...m, id: generateId() }));
    const newIds = new Set(newMappings.map((m) => m.id));
    set((s) => ({ skuMappings: [...s.skuMappings, ...newMappings] }));
    syncToRemote('importSkuMappings', () => dbOps.upsertSkuMappingsBatch(newMappings));
  },

  clearSkuMappings: () => {
    const prev = get().skuMappings;
    set({ skuMappings: [] });
    // 按平台分别删除（每个平台一条请求）
    const platforms: Platform[] = ['shopee', 'lazada', 'tiktok'];
    syncToRemote('clearSkuMappings', async () => {
      const results = await Promise.all(platforms.map((p) => dbOps.deleteSkuMappingsByPlatform(p)));
      return results.every(Boolean);
    });
  },

  // ====== 店铺名称（全部同步返回，Supabase 写入后台队列执行） ======
  addShopName: (name) => {
    const id = generateId();
    const newName = { ...name, id };
    set((s) => ({ shopNames: [...s.shopNames, newName] }));
    syncToRemote('addShopName', () => dbOps.insertShopName(newName));
  },

  addShopNamesBatch: (platform, names) => {
    const newNames: ShopName[] = names.map((name) => ({
      id: generateId(),
      name,
      platform,
      createdAt: Date.now(),
    }));
    const newIds = new Set(newNames.map((n) => n.id));
    set((s) => ({ shopNames: [...s.shopNames, ...newNames] }));
    syncToRemote('addShopNamesBatch', () => dbOps.upsertShopNamesBatch(newNames));
  },

  updateShopName: (id, name) => {
    const prev = get().shopNames.find((n) => n.id === id);
    set((s) => ({ shopNames: s.shopNames.map((n) => (n.id === id ? { ...n, name } : n)) }));
    const current = get().shopNames.find((n) => n.id === id);
    if (current) {
      const capturedPrev = prev;
      syncToRemote('updateShopName', () => dbOps.insertShopName(current));
    }
  },

  deleteShopName: (id) => {
    const prev = get().shopNames.find((n) => n.id === id);
    set((s) => ({ shopNames: s.shopNames.filter((n) => n.id !== id) }));
    if (prev) {
      syncToRemote('deleteShopName', () => dbOps.deleteShopName(id));
    } else {
      dbOps.deleteShopName(id).catch(console.error);
    }
  },

  clearShopNames: (platform) => {
    const prev = get().shopNames.filter((n) => n.platform === platform);
    set((s) => ({ shopNames: s.shopNames.filter((n) => n.platform !== platform) }));
    syncToRemote('clearShopNames', () => dbOps.deleteShopNamesByPlatform(platform));
  },

  // ====== 计算配置 ======
  getActiveConfig: (platform) => {
    const state = get();
    const configs = state.savedConfigs[platform] || [];
    return configs.find((c) => c.id === state.activeConfigId[platform]);
  },

  setActiveConfig: (platform, configId) => {
    const prevActiveId = get().activeConfigId[platform];
    set((s) => ({ activeConfigId: { ...s.activeConfigId, [platform]: configId } }));
    const configs = get().savedConfigs[platform] || [];
    syncToRemote('setActiveConfig', async () => {
      const results = await Promise.all(
        configs.map((config) => {
          const isActive = config.id === configId;
          return dbOps.upsertCalcConfig(config, platform, isActive);
        })
      );
      return results.some((r) => r);
    });
  },

  updateFieldMapping: (platform, field, value) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const prev = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!prev) return;
    const updatedConfig = { ...prev, fieldMapping: { ...prev.fieldMapping, [field]: value }, updatedAt: Date.now() };
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) => c.id === activeId ? updatedConfig : c),
      },
    }));
    syncToRemote('updateFieldMapping', () => dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]));
  },

  updateFieldAlias: (platform, field, alias) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const prev = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!prev) return;
    const updatedConfig = { ...prev, fieldAliases: { ...prev.fieldAliases, [field]: alias }, updatedAt: Date.now() };
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) => c.id === activeId ? updatedConfig : c),
      },
    }));
    syncToRemote('updateFieldAlias', () => dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]));
  },

  updateFormula: (platform, field, formula) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const prev = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!prev) return;
    const updatedConfig = { ...prev, formulas: { ...prev.formulas, [field]: formula }, updatedAt: Date.now() };
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) => c.id === activeId ? updatedConfig : c),
      },
    }));
    syncToRemote('updateFormula', () => dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]));
  },

  updateFilterRules: (platform, rules) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const prev = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!prev) return;
    const updatedConfig = { ...prev, filterRules: { ...prev.filterRules, ...rules }, updatedAt: Date.now() };
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) => c.id === activeId ? updatedConfig : c),
      },
    }));
    syncToRemote('updateFilterRules', () => dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]));
  },

  setCountQuantityAsRows: (platform, value) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const prev = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!prev) return;
    const updatedConfig = { ...prev, countQuantityAsRows: value, updatedAt: Date.now() };
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) => c.id === activeId ? updatedConfig : c),
      },
    }));
    syncToRemote('setCountQuantityAsRows', () => dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]));
  },

  setProfitRateRedThreshold: (platform, value) => {
    const activeId = get().activeConfigId[platform];
    if (!activeId) return;
    const prev = get().savedConfigs[platform].find((c) => c.id === activeId);
    if (!prev) return;
    const updatedConfig = { ...prev, profitRateRedThreshold: value, updatedAt: Date.now() };
    set((s) => ({
      savedConfigs: {
        ...s.savedConfigs,
        [platform]: s.savedConfigs[platform].map((c) => c.id === activeId ? updatedConfig : c),
      },
    }));
    syncToRemote('setProfitRateRedThreshold', () => dbOps.upsertCalcConfig(updatedConfig, platform, activeId === get().activeConfigId[platform]));
  },

  saveAsNewConfig: (platform, name) => {
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
      savedConfigs: { ...s.savedConfigs, [platform]: [...s.savedConfigs[platform], newConfig] },
      activeConfigId: { ...s.activeConfigId, [platform]: newConfig.id },
    }));
    syncToRemote('saveAsNewConfig', async () => {
      const ok = await dbOps.upsertCalcConfig(newConfig, platform, true);
      if (ok) {
        const oldConfig = get().savedConfigs[platform].find((c) => c.id === activeConfig.id);
        if (oldConfig) await dbOps.upsertCalcConfig(oldConfig, platform, false);
      }
      return ok;
    });
  },

  renameConfig: (platform, configId, name) => {
    const prev = get().savedConfigs[platform].find((c) => c.id === configId);
    if (!prev) return;
    const updatedConfig = { ...prev, name, updatedAt: Date.now() };
    set((s) => ({
      savedConfigs: { ...s.savedConfigs, [platform]: s.savedConfigs[platform].map((c) => c.id === configId ? updatedConfig : c) },
    }));
    syncToRemote('renameConfig', () => dbOps.upsertCalcConfig(updatedConfig, platform, configId === get().activeConfigId[platform]));
  },

  deleteConfig: (platform, configId) => {
    const configs = get().savedConfigs[platform];
    if (configs.length <= 1) return;
    const prev = configs.find((c) => c.id === configId);
    const prevActiveId = get().activeConfigId[platform];
    set((s) => ({
      savedConfigs: { ...s.savedConfigs, [platform]: s.savedConfigs[platform].filter((c) => c.id !== configId) },
      activeConfigId: s.activeConfigId[platform] === configId
        ? { ...s.activeConfigId, [platform]: configs[0].id === configId ? configs[1].id : configs[0].id }
        : s.activeConfigId,
    }));
    if (prev) {
      syncToRemote('deleteConfig', () => dbOps.deleteCalcConfig(configId));
    }
  },

  saveCurrentConfig: (platform, name) => {
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
      savedConfigs: { ...s.savedConfigs, [platform]: [...s.savedConfigs[platform], newConfig] },
      activeConfigId: { ...s.activeConfigId, [platform]: id },
    }));
    syncToRemote('saveCurrentConfig', () => dbOps.upsertCalcConfig(newConfig, platform, true));
  },

  switchConfig: (platform, configId) => {
    const prevActiveId = get().activeConfigId[platform];
    set((s) => ({ activeConfigId: { ...s.activeConfigId, [platform]: configId } }));
    const configs = get().savedConfigs[platform] || [];
    syncToRemote('switchConfig', async () => {
      const results = await Promise.all(
        configs.map((config) => dbOps.upsertCalcConfig(config, platform, config.id === configId))
      );
      return results.some((r) => r);
    });
  },

  // ====== 导入数据 ======
  importOrders: (platform, data) => {
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
      rawOrders: { ...s.rawOrders, [platform]: [...s.rawOrders[platform], orderFile] },
    }));
    get().mergeHeaders(platform, data.headers);
    syncToRemote('importOrders', async () => { const r = await dbOps.insertOrderFile(
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
    ); return r !== null; });
  },

  deleteOrderFile: (platform, fileId) => {
    const prev = get().rawOrders[platform].find((f) => f.id === fileId);
    set((s) => ({
      rawOrders: { ...s.rawOrders, [platform]: s.rawOrders[platform].filter((f) => f.id !== fileId) },
    }));
    if (prev) {
      syncToRemote('deleteOrderFile', () => dbOps.deleteOrderFile(fileId));
    } else {
      dbOps.deleteOrderFile(fileId).catch(console.error);
    }
  },

  clearOrders: (platform) => {
    const prev = get().rawOrders[platform];
    const prevHeaders = get().availableHeaders[platform];
    set((s) => ({
      rawOrders: { ...s.rawOrders, [platform]: [] },
      availableHeaders: { ...s.availableHeaders, [platform]: [] },
    }));
    syncToRemote('clearOrders', () => dbOps.deleteOrderFilesByPlatform(platform));
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

    // 预构建 SKU 查找 Map，避免每行 O(N) find
    const skuMap = new Map(state.skuMappings.map((m) => [m.sku, m]));

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

        // countOnlyQuantity（只统计数量不统计金额的订单）:
        // Shopee: 归零商品金额(unitPrice)，保留各项服务费(commission/platformFee/shippingFee/platformDiscount)
        // TikTok/Lazada: 所有金额归零
        // 所有平台: 数量和采购成本正常计入
        let isCountOnlyQuantity = false;
        if (filterRules.quantityOnlyStatusField && filterRules.quantityOnlyStatusValues.length > 0) {
          const rawValue = getStrValue(filterRules.quantityOnlyStatusField).trim();
          const shouldCountOnly = filterRules.quantityOnlyStatusValues.some(
            (v) => v.trim().toLowerCase() === rawValue.toLowerCase()
          );
          if (shouldCountOnly) {
            isCountOnlyQuantity = true;
          }
        }

        // 获取 SKU 和采购价（在过滤判断之前，purchasePrice 用于公式计算）
        const sku = getStrValue(mapping.sku);
        const skuInfo = skuMap.get(sku);
        const productName = skuInfo?.productName || sku;
        const purchasePrice = skuInfo?.purchasePrice || 0;

        // excludeZeroAmount：排除零金额行
        // 注意：countOnlyQuantity 行的金额会被归零，但这些行应该被保留（计入数量）
        // 所以 excludeZeroAmount 只对非 countOnlyQuantity 行生效
        if (filterRules.excludeZeroAmount && !isCountOnlyQuantity) {
          const checkTotal = evalFormula(config.formulas.totalAmount, {
            quantity, unitPrice, platformDiscount,
            platformFee, shippingFee, commission, purchasePrice,
          });
          if (checkTotal === 0) {
            excludedCount++;
            continue;
          }
        }

        const orderShopName = orderFile.shopName || '';
        const orderDate = orderFile.yearMonth || '';

        const effectiveUnitPrice = isCountOnlyQuantity ? 0 : unitPrice;
        const effectiveCommission = isCountOnlyQuantity && platform !== 'shopee' ? 0 : commission;
        const effectivePlatformFee = isCountOnlyQuantity && platform !== 'shopee' ? 0 : platformFee;
        const effectiveShippingFee = isCountOnlyQuantity && platform !== 'shopee' ? 0 : shippingFee;
        const effectivePlatformDiscount = isCountOnlyQuantity && platform !== 'shopee' ? 0 : platformDiscount;

        const formulaContext: Record<string, number> = {
          quantity,
          unitPrice: effectiveUnitPrice,
          platformDiscount: effectivePlatformDiscount,
          platformFee: effectivePlatformFee,
          shippingFee: effectiveShippingFee,
          commission: effectiveCommission,
          purchasePrice,
        };

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
          shopName: orderShopName,
          orderDate,
          quantity,
          unitPrice: effectiveUnitPrice,
          platformDiscount: effectivePlatformDiscount,
          totalAmount: computedTotalAmount,
          platformFee: effectivePlatformFee,
          shippingFee: effectiveShippingFee,
          commission: effectiveCommission,
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
    const totalPurchaseCost = calculatedOrders.reduce((s, o) => s + o.purchaseCost, 0);
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

// ====== 持久化策略：不在每次 set() 时写入 localStorage（避免阻塞 UI） ======
// 只在以下时机持久化：
// 1. loadAllData 成功后（快照备份）
// 2. beforeunload（页面关闭/刷新时）
// 3. 每 30 秒定时备份
function persistSnapshot() {
  const s = useAppStore.getState();
  persistToLocal({
    skuMappings: s.skuMappings,
    shopNames: s.shopNames,
    savedConfigs: s.savedConfigs,
    activeConfigId: s.activeConfigId,
  });
}

// 页面关闭/刷新时紧急保存
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    try { persistSnapshot(); } catch { /* ignore */ }
  });
  // 每 30 秒定时备份（低频，不阻塞操作）
  setInterval(() => {
    try { persistSnapshot(); } catch { /* ignore */ }
  }, 30000);
}
