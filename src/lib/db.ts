import { supabase } from './supabase';
import type { SkuMapping, ShopName, SavedCalcConfig, RawOrderData, Platform } from '@/types';

// ====== SKU 映射 ======

export async function getSkuMappings(platform: Platform): Promise<SkuMapping[]> {
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
}

export async function upsertSkuMapping(mapping: SkuMapping): Promise<boolean> {
  const { error } = await supabase.from('sku_mappings').upsert({
    id: mapping.id,
    sku: mapping.sku,
    product_name: mapping.productName,
    purchase_price: mapping.purchasePrice,
    platform: mapping.platform,
  });
  if (error) { console.error('upsertSkuMapping error:', error); return false; }
  return true;
}

export async function deleteSkuMapping(id: string): Promise<boolean> {
  const { error } = await supabase.from('sku_mappings').delete().eq('id', id);
  if (error) { console.error('deleteSkuMapping error:', error); return false; }
  return true;
}

// ====== 店铺名称 ======

export async function getShopNames(platform: Platform): Promise<ShopName[]> {
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
}

export async function upsertShopName(shop: ShopName): Promise<boolean> {
  const { error } = await supabase.from('shop_names').upsert({
    id: shop.id,
    name: shop.name,
    platform: shop.platform,
    created_at: shop.createdAt || Date.now(),
  });
  if (error) { console.error('upsertShopName error:', error); return false; }
  return true;
}

export async function deleteShopName(id: string): Promise<boolean> {
  const { error } = await supabase.from('shop_names').delete().eq('id', id);
  if (error) { console.error('deleteShopName error:', error); return false; }
  return true;
}

// ====== 计算配置 ======

export async function getCalcConfigs(platform: Platform): Promise<SavedCalcConfig[]> {
  const { data, error } = await supabase
    .from('calc_configs')
    .select('*')
    .eq('platform', platform);

  if (error) { console.error('getCalcConfigs error:', error); return []; }
  return (data || []).map((row: Record<string, unknown>) => mapRowToConfig(row));
}

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

export async function upsertCalcConfig(config: SavedCalcConfig, _platform: Platform, isActive: boolean): Promise<boolean> {
  const { error } = await supabase.from('calc_configs').upsert(mapConfigToRow(config, isActive));
  if (error) { console.error('upsertCalcConfig error:', error); return false; }
  return true;
}

export async function deleteCalcConfig(id: string): Promise<boolean> {
  const { error } = await supabase.from('calc_configs').delete().eq('id', id);
  if (error) { console.error('deleteCalcConfig error:', error); return false; }
  return true;
}

// ====== 原始订单文件 ======

export async function getOrderFiles(platform: Platform): Promise<RawOrderData[]> {
  const { data: files, error: fileError } = await supabase
    .from('raw_order_files')
    .select('*')
    .eq('platform', platform);

  if (fileError) { console.error('getOrderFiles error:', fileError); return []; }
  if (!files || files.length === 0) return [];

  const fileIds = files.map((f: Record<string, unknown>) => f.id as string);

  // Fetch all rows for this platform's files
  const { data: rows, error: rowsError } = await supabase
    .from('order_rows')
    .select('*')
    .in('file_id', fileIds);

  if (rowsError) { console.error('getOrderRows error:', rowsError); return []; }

  // Group rows by file_id
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
}

export async function insertOrderFile(
  fileMeta: { id: string; platform: Platform; config_id: string | null; shop_name: string; year_month: string; import_time: number; headers?: string[]; file_name?: string },
  rows: Record<string, string | number>[]
): Promise<string | null> {
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

  // Insert rows in batches
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
}

export async function deleteOrderFile(id: string): Promise<boolean> {
  // Delete rows first (cascade should handle this, but be safe)
  await supabase.from('order_rows').delete().eq('file_id', id);
  const { error } = await supabase.from('raw_order_files').delete().eq('id', id);
  if (error) { console.error('deleteOrderFile error:', error); return false; }
  return true;
}
