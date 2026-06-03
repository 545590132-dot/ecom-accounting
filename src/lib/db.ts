import { supabase } from './supabase';
import type { SkuMapping, ShopName, SavedCalcConfig, RawOrderData, Platform } from '@/types';

// ====== Supabase 连接状态 ======
let _isConnected = false;

export function isSupabaseConnected(): boolean {
  return _isConnected;
}

/** 检查 Supabase 连接状态 */
export async function checkConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('sku_mappings').select('id').limit(1);
    _isConnected = !error;
    return _isConnected;
  } catch {
    _isConnected = false;
    return false;
  }
}

// ====== localStorage 双重备份 ======
const STORAGE_KEY = 'ecommerce-accounting-data';

export function saveAllToLocalStorage(data: {
  skuMappings: SkuMapping[];
  shopNames: ShopName[];
  savedConfigs: Record<Platform, SavedCalcConfig[]>;
  rawOrders: Record<Platform, RawOrderData[]>;
  activeConfigId?: Record<Platform, string>;
}): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

export function loadAllFromLocalStorage(): {
  skuMappings: SkuMapping[];
  shopNames: ShopName[];
  savedConfigs: Record<Platform, SavedCalcConfig[]>;
  rawOrders: Record<Platform, RawOrderData[]>;
  activeConfigId?: Record<Platform, string>;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 清除 localStorage 备份 */
export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/** 测试 Supabase 连接是否正常 */
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('sku_mappings').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

// ====== 通用 Supabase 操作封装 ======
// 如果 Supabase 不可用，静默失败（数据仍保存在 localStorage）

async function safeOp<T>(op: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await op();
  } catch (e) {
    console.warn(`${label} 操作失败:`, e);
    return fallback;
  }
}

// ====== SKU 映射 ======

export async function getSkuMappings(platform: Platform): Promise<SkuMapping[]> {
  return safeOp(async () => {
    const { data, error } = await supabase
      .from('sku_mappings')
      .select('*')
      .eq('platform', platform);
    if (error) { console.error('getSkuMappings error:', error); return []; }
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      sku: row.sku as string,
      productName: row.product_name as string,
      purchasePrice: Number(row.purchase_price),
      platform: row.platform as Platform,
    }));
  }, [], 'getSkuMappings');
}

export async function upsertSkuMapping(mapping: SkuMapping): Promise<boolean> {
  return safeOp(async () => {
    const { error } = await supabase.from('sku_mappings').upsert({
      id: mapping.id,
      sku: mapping.sku,
      product_name: mapping.productName,
      purchase_price: mapping.purchasePrice,
      platform: mapping.platform,
    });
    if (error) { console.error('upsertSkuMapping error:', error); return false; }
    return true;
  }, false, 'upsertSkuMapping');
}

export async function deleteSkuMapping(id: string): Promise<boolean> {
  return safeOp(async () => {
    const { error } = await supabase.from('sku_mappings').delete().eq('id', id);
    if (error) { console.error('deleteSkuMapping error:', error); return false; }
    return true;
  }, false, 'deleteSkuMapping');
}

export async function deleteSkuMappingsBatch(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  return safeOp(async () => {
    const { error } = await supabase.from('sku_mappings').delete().in('id', ids);
    if (error) { console.error('deleteSkuMappingsBatch error:', error); return false; }
    return true;
  }, false, 'deleteSkuMappingsBatch');
}

export async function upsertSkuMappingsBatch(mappings: SkuMapping[]): Promise<boolean> {
  if (mappings.length === 0) return true;
  return safeOp(async () => {
    const rows = mappings.map((m) => ({
      id: m.id,
      sku: m.sku,
      product_name: m.productName,
      purchase_price: m.purchasePrice,
      platform: m.platform,
    }));
    const { error } = await supabase.from('sku_mappings').upsert(rows);
    if (error) { console.error('upsertSkuMappingsBatch error:', error); return false; }
    return true;
  }, false, 'upsertSkuMappingsBatch');
}

// ====== 店铺名称 ======

export async function getShopNames(platform: Platform): Promise<ShopName[]> {
  return safeOp(async () => {
    const { data, error } = await supabase
      .from('shop_names')
      .select('*')
      .eq('platform', platform);
    if (error) { console.error('getShopNames error:', error); return []; }
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      platform: row.platform as Platform,
      createdAt: Number(row.created_at) || Date.now(),
    }));
  }, [], 'getShopNames');
}

export async function insertShopName(shop: ShopName): Promise<boolean> {
  return safeOp(async () => {
    const { error } = await supabase.from('shop_names').upsert({
      id: shop.id,
      name: shop.name,
      platform: shop.platform,
      created_at: shop.createdAt || Date.now(),
    });
    if (error) { console.error('insertShopName error:', error); return false; }
    return true;
  }, false, 'insertShopName');
}

export async function deleteShopName(id: string): Promise<boolean> {
  return safeOp(async () => {
    const { error } = await supabase.from('shop_names').delete().eq('id', id);
    if (error) { console.error('deleteShopName error:', error); return false; }
    return true;
  }, false, 'deleteShopName');
}

export async function deleteShopNamesBatch(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  return safeOp(async () => {
    const { error } = await supabase.from('shop_names').delete().in('id', ids);
    if (error) { console.error('deleteShopNamesBatch error:', error); return false; }
    return true;
  }, false, 'deleteShopNamesBatch');
}

export async function upsertShopNamesBatch(shops: ShopName[]): Promise<boolean> {
  if (shops.length === 0) return true;
  return safeOp(async () => {
    const rows = shops.map((s) => ({
      id: s.id,
      name: s.name,
      platform: s.platform,
      created_at: s.createdAt || Date.now(),
    }));
    const { error } = await supabase.from('shop_names').upsert(rows);
    if (error) { console.error('upsertShopNamesBatch error:', error); return false; }
    return true;
  }, false, 'upsertShopNamesBatch');
}

// ====== 计算配置 ======

function mapRowToConfig(row: Record<string, unknown>): SavedCalcConfig {
  const fm = (row.field_mapping as Record<string, string>) || {};
  const fa = (row.field_aliases as Record<string, string>) || {};
  const f = (row.formulas as Record<string, string>) || {};
  const fr = (row.filter_rules as Record<string, unknown>) || {};

  return {
    id: row.id as string,
    name: row.name as string,
    platform: row.platform as Platform,
    fieldMapping: {
      orderNo: fm.orderNo || '',
      sku: fm.sku || '',
      quantity: fm.quantity || '',
      unitPrice: fm.unitPrice || '',
      platformDiscount: fm.platformDiscount || '',
      platformFee: fm.platformFee || '',
      shippingFee: fm.shippingFee || '',
      commission: fm.commission || '',
    },
    fieldAliases: fa,
    formulas: {
      totalAmount: f.totalAmount || '',
      netAmount: f.netAmount || '',
      profit: f.profit || '',
      profitRate: f.profitRate || '',
    },
    filterRules: {
      excludeStatusField: (fr.excludeStatusField as string) || '',
      excludeStatusValues: (fr.excludeStatusValues as string[]) || [],
      quantityOnlyStatusField: (fr.quantityOnlyStatusField as string) || '',
      quantityOnlyStatusValues: (fr.quantityOnlyStatusValues as string[]) || [],
      excludeZeroAmount: fr.excludeZeroAmount === true,
    },
    countQuantityAsRows: fr.countQuantityAsRows === true || row.count_quantity_as_rows === true,
    profitRateRedThreshold: (row.profit_rate_red_threshold as number | null) ?? null,
    createdAt: Number(row.created_at) || Date.now(),
    updatedAt: Number(row.updated_at) || Date.now(),
  };
}

function mapConfigToRow(config: SavedCalcConfig, isActive: boolean): Record<string, unknown> {
  return {
    id: config.id,
    name: config.name,
    platform: config.platform,
    field_mapping: config.fieldMapping,
    field_aliases: config.fieldAliases,
    formulas: config.formulas,
    filter_rules: config.filterRules,
    count_quantity_as_rows: config.countQuantityAsRows,
    profit_rate_red_threshold: config.profitRateRedThreshold,
    is_active: isActive,
    created_at: config.createdAt,
    updated_at: config.updatedAt,
  };
}

export async function getCalcConfigs(platform: Platform): Promise<SavedCalcConfig[]> {
  return safeOp(async () => {
    const { data, error } = await supabase
      .from('calc_configs')
      .select('*')
      .eq('platform', platform);
    if (error) { console.error('getCalcConfigs error:', error); return []; }
    return (data || []).map((row: Record<string, unknown>) => mapRowToConfig(row));
  }, [], 'getCalcConfigs');
}

export async function upsertCalcConfig(config: SavedCalcConfig, _platform: Platform, isActive: boolean): Promise<boolean> {
  return safeOp(async () => {
    const { error } = await supabase.from('calc_configs').upsert(mapConfigToRow(config, isActive));
    if (error) { console.error('upsertCalcConfig error:', error); return false; }
    return true;
  }, false, 'upsertCalcConfig');
}

export async function deleteCalcConfig(id: string): Promise<boolean> {
  return safeOp(async () => {
    const { error } = await supabase.from('calc_configs').delete().eq('id', id);
    if (error) { console.error('deleteCalcConfig error:', error); return false; }
    return true;
  }, false, 'deleteCalcConfig');
}

// ====== 原始订单文件 ======

export async function getOrderFiles(platform: Platform): Promise<RawOrderData[]> {
  return safeOp(async () => {
    const { data: files, error: fileError } = await supabase
      .from('raw_order_files')
      .select('*')
      .eq('platform', platform);
    if (fileError) { console.error('getOrderFiles error:', fileError); return []; }
    if (!files || files.length === 0) return [];

    const fileIds = files.map((f: Record<string, unknown>) => f.id as string);

    const { data: rows, error: rowsError } = await supabase
      .from('order_rows')
      .select('*')
      .in('file_id', fileIds);
    if (rowsError) { console.error('getOrderRows error:', rowsError); return []; }

    const rowsByFile: Record<string, Record<string, string | number>[]> = {};
    for (const row of (rows || [])) {
      const r = row as Record<string, unknown>;
      const fileId = r.file_id as string;
      const rowData = (r.row_data as Record<string, string | number>) || {};
      if (!rowsByFile[fileId]) rowsByFile[fileId] = [];
      rowsByFile[fileId].push(rowData);
    }

    return files.map((f: Record<string, unknown>) => ({
      id: f.id as string,
      platform: f.platform as Platform,
      fileName: (f.file_name as string) || '',
      importTime: Number(f.import_time) || Date.now(),
      headers: (f.headers as string[]) || [],
      rows: rowsByFile[f.id as string] || [],
      shopName: (f.shop_name as string) || undefined,
      yearMonth: (f.year_month as string) || undefined,
      configId: (f.config_id as string) || undefined,
    }));
  }, [], 'getOrderFiles');
}

export async function insertOrderFile(
  fileMeta: { id: string; platform: Platform; config_id: string | null; shop_name: string; year_month: string; import_time: number; headers?: string[]; file_name?: string },
  rows: Record<string, string | number>[]
): Promise<string | null> {
  return safeOp(async () => {
    const { error: fileError } = await supabase.from('raw_order_files').insert({
      id: fileMeta.id,
      platform: fileMeta.platform,
      file_name: fileMeta.file_name || '',
      import_time: fileMeta.import_time,
      headers: fileMeta.headers || [],
      shop_name: fileMeta.shop_name || null,
      year_month: fileMeta.year_month || null,
      config_id: fileMeta.config_id || null,
    });
    if (fileError) { console.error('insertOrderFile error:', fileError); return null; }

    const batchSize = 100;
    const allRows = rows.map((row, index) => ({
      file_id: fileMeta.id,
      row_index: index,
      row_data: row,
    }));

    for (let i = 0; i < allRows.length; i += batchSize) {
      const batch = allRows.slice(i, i + batchSize);
      const { error: rowError } = await supabase.from('order_rows').insert(batch);
      if (rowError) { console.error('insertOrderRows batch error:', rowError); }
    }

    return fileMeta.id;
  }, null, 'insertOrderFile');
}

export async function deleteOrderFile(id: string): Promise<boolean> {
  return safeOp(async () => {
    await supabase.from('order_rows').delete().eq('file_id', id);
    const { error } = await supabase.from('raw_order_files').delete().eq('id', id);
    if (error) { console.error('deleteOrderFile error:', error); return false; }
    return true;
  }, false, 'deleteOrderFile');
}

export async function deleteOrderFilesBatch(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  return safeOp(async () => {
    await supabase.from('order_rows').delete().in('file_id', ids);
    const { error } = await supabase.from('raw_order_files').delete().in('id', ids);
    if (error) { console.error('deleteOrderFilesBatch error:', error); return false; }
    return true;
  }, false, 'deleteOrderFilesBatch');
}

// ====== 数据同步：将 localStorage 数据推送到 Supabase ======

export async function syncToSupabase(data: {
  skuMappings: SkuMapping[];
  shopNames: ShopName[];
  savedConfigs: Record<Platform, SavedCalcConfig[]>;
  rawOrders: Record<Platform, RawOrderData[]>;
}): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  for (const m of data.skuMappings) {
    const ok = await upsertSkuMapping(m);
    ok ? synced++ : failed++;
  }

  for (const s of data.shopNames) {
    const ok = await insertShopName(s);
    ok ? synced++ : failed++;
  }

  for (const p of ['shopee', 'lazada', 'tiktok'] as Platform[]) {
    for (const c of data.savedConfigs[p] || []) {
      const ok = await upsertCalcConfig(c, p, true);
      ok ? synced++ : failed++;
    }
  }

  for (const p of ['shopee', 'lazada', 'tiktok'] as Platform[]) {
    for (const f of data.rawOrders[p] || []) {
      const ok = await insertOrderFile(
        {
          id: f.id,
          platform: f.platform,
          config_id: f.configId || null,
          shop_name: f.shopName || '',
          year_month: f.yearMonth || '',
          import_time: f.importTime,
          headers: f.headers,
          file_name: f.fileName || '',
        },
        f.rows
      );
      ok ? synced++ : failed++;
    }
  }

  return { synced, failed };
}
