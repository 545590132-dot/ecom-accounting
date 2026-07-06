import { supabase } from './supabase';
import type { SkuMapping, ShopName, SavedCalcConfig, RawOrderData, Platform, InventoryFile, InventoryRecord, CalculatorSettings } from '@/types';

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

async function safeOp<T>(op: () => Promise<T>, fallback: T, label: string, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await op();
      return result;
    } catch (e) {
      const isLastAttempt = attempt === retries;
      if (isLastAttempt) {
        console.error(`${label} failed after ${retries} retries:`, e);
        return fallback;
      }
      console.warn(`${label} failed, retry ${attempt + 1}...`);
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return fallback;
}

// ====== 通用分页查询（突破 Supabase 1000 行默认限制） ======

async function fetchAll<T>(
  query: any,
  mapRow: (row: Record<string, unknown>) => T,
  pageSize = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) {
      console.error('fetchAll error:', error);
      throw new Error(`fetchAll failed at offset ${offset}: ${error.message}`);
    }
    const rows = (data || []) as Record<string, unknown>[];
    allRows.push(...rows.map(mapRow));
    hasMore = rows.length === pageSize;
    offset += pageSize;
  }
  return allRows;
}

// ====== SKU 映射 ======

export async function getSkuMappings(platform: Platform): Promise<SkuMapping[]> {
  const result = await safeOp(async () => {
    return fetchAll(
      supabase.from('sku_mappings').select('*').eq('platform', platform),
      (row: Record<string, unknown>) => ({
        id: row.id as string,
        sku: row.sku as string,
        productName: row.product_name as string,
        purchasePrice: Number(row.purchase_price),
        platform: row.platform as Platform,
        category: (row.category as string) || undefined,
        productOwner: (row.product_owner as string) || undefined,
      })
    );
  }, null as SkuMapping[] | null, 'getSkuMappings');
  // safeOp 返回 null 表示失败（重试后仍失败），向上抛异常让调用方区分"空数据"和"加载失败"
  if (result === null) throw new Error(`getSkuMappings(${platform}) failed after retries`);
  return result;
}

export async function upsertSkuMapping(mapping: SkuMapping): Promise<boolean> {
  return safeOp(async () => {
    const { error } = await supabase.from('sku_mappings').upsert({
      id: mapping.id,
      sku: mapping.sku,
      product_name: mapping.productName,
      purchase_price: mapping.purchasePrice,
      platform: mapping.platform,
      category: mapping.category || '',
      product_owner: mapping.productOwner || '',
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
    // 分批并行删除，每批 100（避免 URL 过长）
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) {
      batches.push(ids.slice(i, i + 100));
    }
    const results = await Promise.all(
      batches.map((batch) => supabase.from('sku_mappings').delete().in('id', batch))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) { console.error('deleteSkuMappingsBatch error:', failed.error); return false; }
    return true;
  }, false, 'deleteSkuMappingsBatch');
}

/** 按平台删除所有 SKU 映射 — 单条请求，无需传 ID 列表 */
export async function deleteSkuMappingsByPlatform(platform: Platform): Promise<boolean> {
  return safeOp(async () => {
    const { error } = await supabase.from('sku_mappings').delete().eq('platform', platform);
    if (error) { console.error('deleteSkuMappingsByPlatform error:', error); return false; }
    return true;
  }, false, 'deleteSkuMappingsByPlatform');
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
      category: m.category || '',
      product_owner: m.productOwner || '',
    }));
    // 分批并行 upsert，每批 500
    const batches: typeof rows[] = [];
    for (let i = 0; i < rows.length; i += 500) {
      batches.push(rows.slice(i, i + 500));
    }
    const results = await Promise.all(
      batches.map((batch) => supabase.from('sku_mappings').upsert(batch))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) { console.error('upsertSkuMappingsBatch error:', failed.error); return false; }
    return true;
  }, false, 'upsertSkuMappingsBatch');
}

// ====== 店铺名称 ======

export async function getShopNames(platform: Platform): Promise<ShopName[]> {
  const result = await safeOp(async () => {
    return fetchAll(
      supabase.from('shop_names').select('*').eq('platform', platform),
      (row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
        platform: row.platform as Platform,
        createdAt: Number(row.created_at) || Date.now(),
      })
    );
  }, null as ShopName[] | null, 'getShopNames');
  if (result === null) throw new Error(`getShopNames(${platform}) failed after retries`);
  return result;
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
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) {
      batches.push(ids.slice(i, i + 100));
    }
    const results = await Promise.all(
      batches.map((batch) => supabase.from('shop_names').delete().in('id', batch))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) { console.error('deleteShopNamesBatch error:', failed.error); return false; }
    return true;
  }, false, 'deleteShopNamesBatch');
}

/** 按平台删除所有店铺 — 单条请求 */
export async function deleteShopNamesByPlatform(platform: Platform): Promise<boolean> {
  return safeOp(async () => {
    const { error } = await supabase.from('shop_names').delete().eq('platform', platform);
    if (error) { console.error('deleteShopNamesByPlatform error:', error); return false; }
    return true;
  }, false, 'deleteShopNamesByPlatform');
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
    const batches: typeof rows[] = [];
    for (let i = 0; i < rows.length; i += 500) {
      batches.push(rows.slice(i, i + 500));
    }
    const results = await Promise.all(
      batches.map((batch) => supabase.from('shop_names').upsert(batch))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) { console.error('upsertShopNamesBatch error:', failed.error); return false; }
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
    isActive: row.is_active === true,
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
  const result = await safeOp(async () => {
    return fetchAll(
      supabase.from('calc_configs').select('*').eq('platform', platform),
      (row: Record<string, unknown>) => mapRowToConfig(row)
    );
  }, null as SavedCalcConfig[] | null, 'getCalcConfigs');
  if (result === null) throw new Error(`getCalcConfigs(${platform}) failed after retries`);
  return result;
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
  // 核心数据加载——失败时必须抛出异常，让 loadAllData 能区分"无数据"和"加载失败"
  const loadFiles = async (): Promise<RawOrderData[]> => {
    // 分页查询文件
    const files = await fetchAll(
      supabase.from('raw_order_files').select('*').eq('platform', platform),
      (row: Record<string, unknown>) => row
    );
    if (files.length === 0) return [];

    // 按文件逐个加载行数据（避免大查询超时导致整批数据丢失）
    const rowsByFile: Record<string, Record<string, string | number>[]> = {};
    let fileFailCount = 0;

    for (const f of files) {
      const fileId = f.id as string;
      try {
        const fileRows = await fetchAll(
          supabase.from('order_rows').select('row_data').eq('file_id', fileId),
          (row: Record<string, unknown>) => (row.row_data as Record<string, string | number>) || {}
        );
        rowsByFile[fileId] = fileRows;
      } catch (fileErr) {
        fileFailCount++;
        console.error(`getOrderFiles: 加载文件 ${fileId} 的行数据失败:`, fileErr);
        // 单个文件失败时重试一次
        try {
          const fileRows = await fetchAll(
            supabase.from('order_rows').select('row_data').eq('file_id', fileId),
            (row: Record<string, unknown>) => (row.row_data as Record<string, string | number>) || {}
          );
          rowsByFile[fileId] = fileRows;
          fileFailCount--;
        } catch {
          rowsByFile[fileId] = []; // 重试也失败，设为空但不影响其他文件
        }
      }
    }

    if (fileFailCount > 0) {
      console.warn(`getOrderFiles(${platform}): ${fileFailCount}/${files.length} 个文件加载失败`);
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
  };

  // 重试机制：最多重试 3 次
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await loadFiles();
    } catch (e) {
      if (attempt < 2) {
        console.warn(`getOrderFiles(${platform}) 第 ${attempt + 1} 次加载失败，${1 + attempt}秒后重试...`, e);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        console.error(`getOrderFiles(${platform}) 3次加载均失败:`, e);
        throw e; // 向上抛出，由 loadAllData 处理
      }
    }
  }
  throw new Error(`getOrderFiles(${platform}) unreachable`);
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
    // 上传前去重：移除完全相同的行
    const seenRows = new Set<string>();
    const uniqueRows = rows.filter((row) => {
      const key = JSON.stringify(row);
      if (seenRows.has(key)) return false;
      seenRows.add(key);
      return true;
    });
    if (uniqueRows.length < rows.length) {
      console.warn(`上传去重：移除 ${rows.length - uniqueRows.length} 条重复行`);
    }
    const allRows = uniqueRows.map((row, index) => ({
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
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) {
      batches.push(ids.slice(i, i + 100));
    }
    // 并行删除 order_rows 和 raw_order_files
    const results = await Promise.all(
      batches.map(async (batch) => {
        await supabase.from('order_rows').delete().in('file_id', batch);
        const { error } = await supabase.from('raw_order_files').delete().in('id', batch);
        return { error };
      })
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) { console.error('deleteOrderFilesBatch error:', failed.error); return false; }
    return true;
  }, false, 'deleteOrderFilesBatch');
}

/** 按平台删除所有订单文件及行数据 — 2 条请求 */
export async function deleteOrderFilesByPlatform(platform: Platform): Promise<boolean> {
  return safeOp(async () => {
    // 先获取该平台所有文件 ID
    const { data: files } = await supabase.from('raw_order_files').select('id').eq('platform', platform);
    const fileIds = (files || []).map((f: Record<string, unknown>) => f.id as string);
    // 删除 order_rows (按 file_id 批量)
    if (fileIds.length > 0) {
      const batches: string[][] = [];
      for (let i = 0; i < fileIds.length; i += 100) {
        batches.push(fileIds.slice(i, i + 100));
      }
      await Promise.all(batches.map((batch) => supabase.from('order_rows').delete().in('file_id', batch)));
    }
    // 删除 raw_order_files (按平台)
    const { error } = await supabase.from('raw_order_files').delete().eq('platform', platform);
    if (error) { console.error('deleteOrderFilesByPlatform error:', error); return false; }
    return true;
  }, false, 'deleteOrderFilesByPlatform');
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

// ====== 库存查询相关操作 ======

/** 获取所有库存文件 */
export async function getInventoryFiles(): Promise<InventoryFile[]> {
  const { data, error } = await supabase
    .from('inventory_files')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`获取库存文件失败: ${error.message}`);
  return (data || []).map(mapRowToInventoryFile);
}

/** 获取所有库存记录 */
export async function getInventoryRecords(): Promise<InventoryRecord[]> {
  const all: InventoryRecord[] = [];
  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('inventory_records')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (error) throw new Error(`获取库存记录失败: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data.map(mapRowToInventoryRecord));
    if (data.length < batchSize) break;
    offset += batchSize;
  }
  return all;
}

/** 插入库存文件及其记录 */
export async function insertInventoryFile(
  fileMeta: { id: string; file_name: string; year_month: string },
  records: { sku: string; stock_qty: number; sales_status?: string; adjustment_plan?: string }[]
): Promise<boolean> {
  // 1. Upsert 文件元数据（防止重复插入报错）
  const { error: fileError } = await supabase
    .from('inventory_files')
    .upsert(fileMeta, { onConflict: 'id' });
  if (fileError) {
    console.error('[DB] insertInventoryFile - file upsert error:', fileError);
    return false;
  }

  // 2. 先删除该文件已有的记录（处理重新上传场景）
  const { error: delError } = await supabase
    .from('inventory_records')
    .delete()
    .eq('file_id', fileMeta.id);
  if (delError) {
    console.error('[DB] insertInventoryFile - delete old records error:', delError);
    return false;
  }

  // 3. 分批插入新记录（使用普通 insert，避免 upsert 约束冲突）
  const rows = records.map(r => ({
    id: crypto.randomUUID(),
    file_id: fileMeta.id,
    sku: r.sku,
    stock_qty: r.stock_qty,
    year_month: fileMeta.year_month,
    sales_status: r.sales_status || '',
    adjustment_plan: r.adjustment_plan || '',
  }));

  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase.from('inventory_records').insert(batch);
    if (error) {
      console.error('[DB] insertInventoryFile - batch insert error:', JSON.stringify(error));
      return false;
    }
  }
  return true;
}

/** 删除库存文件及其关联记录 */
export async function deleteInventoryFile(fileId: string): Promise<boolean> {
  const { error } = await supabase.from('inventory_files').delete().eq('id', fileId);
  if (error) {
    console.error('deleteInventoryFile error:', error);
    return false;
  }
  return true;
}

/** 更新库存记录的销售情况 */
export async function updateInventorySalesStatus(
  recordId: string,
  salesStatus: string
): Promise<boolean> {
  const { error } = await supabase
    .from('inventory_records')
    .update({ sales_status: salesStatus || null })
    .eq('id', recordId);
  if (error) {
    console.error('updateInventorySalesStatus error:', error);
    return false;
  }
  return true;
}

/** 批量更新库存记录的调整计划 */
export async function updateInventoryAdjustmentPlan(
  recordIds: string[],
  adjustmentPlan: string
): Promise<boolean> {
  for (const id of recordIds) {
    const { error } = await supabase
      .from('inventory_records')
      .update({ adjustment_plan: adjustmentPlan || '' })
      .eq('id', id);
    if (error) {
      console.error('updateInventoryAdjustmentPlan error:', error);
      return false;
    }
  }
  return true;
}

/** 映射数据库行到 InventoryFile */
function mapRowToInventoryFile(row: Record<string, unknown>): InventoryFile {
  return {
    id: row.id as string,
    fileName: row.file_name as string,
    yearMonth: row.year_month as string,
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

/** 映射数据库行到 InventoryRecord */
function mapRowToInventoryRecord(row: Record<string, unknown>): InventoryRecord {
  return {
    id: row.id as string,
    fileId: row.file_id as string,
    sku: (row.sku as string) || '',
    stockQty: Number(row.stock_qty) || 0,
    yearMonth: row.year_month as string,
    salesStatus: (row.sales_status as InventoryRecord['salesStatus']) || '',
    adjustmentPlan: (row.adjustment_plan as string) || '',
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

// ====== 计算器配置 ======

/** 获取所有计算器配置 */
export async function getCalculatorSettings(): Promise<CalculatorSettings[]> {
  const { data, error } = await supabase
    .from('calculator_settings')
    .select('*')
    .order('platform', { ascending: true });
  if (error) throw new Error(`Failed to fetch calculator settings: ${error.message}`);
  if (!data) return [];
  return data.map(mapRowToCalculatorSettings);
}

/** 保存计算器配置（upsert） */
export async function upsertCalculatorSetting(setting: CalculatorSettings): Promise<boolean> {
  const { error } = await supabase
    .from('calculator_settings')
    .upsert({
      id: setting.platform,
      platform: setting.platform,
      settings: setting.settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  if (error) {
    console.error('upsertCalculatorSetting error:', error);
    return false;
  }
  return true;
}

/** 映射数据库行到 CalculatorSettings */
function mapRowToCalculatorSettings(row: Record<string, unknown>): CalculatorSettings {
  return {
    id: row.id as string,
    platform: row.platform as Platform,
    settings: row.settings as CalculatorSettings['settings'],
    createdAt: new Date(row.created_at as string).getTime(),
  };
}
