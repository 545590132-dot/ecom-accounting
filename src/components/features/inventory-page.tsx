'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useAppStore } from '@/store';
import type { InventoryRecord } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  Download,
  Trash2,
  ChevronUp,
  ChevronDown,
  Filter,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface DisplayRow {
  sku: string;
  productName: string;
  productOwner: string;
  stock: number;
  monthlySales: number;
  salesStatus: InventoryRecord['salesStatus'];
  displaySalesStatus: '热销' | '正常' | '平销' | '清货' | '';
  estimatedMonths: number | null;
  goodsValue: number;
  recordIds: string[];
  yearMonth: string;
}

function formatNumber(n: number, decimals = 0): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 10000) {
    return n.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return n.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCurrency(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InventoryPage() {
  const {
    skuMappings,
    inventoryFiles,
    inventoryRecords,
    importInventory,
    deleteInventoryFile,
    batchUpdateInventorySalesStatus,
    calculateSummary,
  } = useAppStore();

  // ====== 导入弹窗 ======
  const [importOpen, setImportOpen] = useState(false);
  const [importYear, setImportYear] = useState('');
  const [importMonth, setImportMonth] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importData, setImportData] = useState<{ sku: string; stockQty: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ====== 筛选 ======
  const [yearMonthFilter, setYearMonthFilter] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [ymPopoverOpen, setYmPopoverOpen] = useState(false);
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [hideZeroStock, setHideZeroStock] = useState(false);

  // ====== 排序 ======
  type SortKey = 'stock' | 'monthlySales' | 'estimatedMonths' | 'goodsValue';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronUp className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-slate-800" />
    ) : (
      <ChevronDown className="w-3 h-3 text-slate-800" />
    );
  };

  // ====== 可用筛选选项 ======
  const availableYearMonths = useMemo(() => {
    const set = new Set<string>();
    for (const f of inventoryFiles) set.add(f.yearMonth);
    return Array.from(set).sort().reverse();
  }, [inventoryFiles]);

  const availableOwners = useMemo(() => {
    const skuOwnerMap = new Map<string, string>();
    for (const m of skuMappings) {
      const key = m.sku.toLowerCase().replace(/\s/g, '');
      if (m.productOwner) skuOwnerMap.set(key, m.productOwner);
    }
    const owners = new Set<string>();
    for (const r of inventoryRecords) {
      const key = r.sku.toLowerCase().replace(/\s/g, '');
      const owner = skuOwnerMap.get(key);
      if (owner) owners.add(owner);
    }
    return Array.from(owners).sort();
  }, [skuMappings, inventoryRecords]);

  const availableStatuses: string[] = ['清货', '热销', '平销', '正常']; // 筛选包含所有可能的最终状态

  // ====== 月销量查找：从三平台订单数据中汇总 ======
  const salesQtyMap = useMemo(() => {
    const map = new Map<string, number>(); // key: `${yearMonth}__${normalizedSku}` -> totalQuantity
    const platforms: ('shopee' | 'lazada' | 'tiktok')[] = ['shopee', 'lazada', 'tiktok'];
    for (const p of platforms) {
      const summary = calculateSummary(p);
      for (const order of summary.orders) {
        const key = `${order.orderDate}__${order.sku.toLowerCase().replace(/\s/g, '')}`;
        map.set(key, (map.get(key) || 0) + order.quantity);
      }
    }
    return map;
  }, [calculateSummary]);

  // ====== 构建展示数据 ======
  const displayRows = useMemo(() => {
    const skuMap = new Map<string, { productName: string; productOwner: string; purchasePrice: number }>();
    for (const m of skuMappings) {
      const key = m.sku.toLowerCase().replace(/\s/g, '');
      skuMap.set(key, {
        productName: m.productName,
        productOwner: m.productOwner || '',
        purchasePrice: m.purchasePrice,
      });
    }

    // 按 yearMonth + sku 分组，取最新文件的库存
    const grouped = new Map<string, { sku: string; stockQty: number; yearMonth: string; salesStatus: InventoryRecord['salesStatus']; recordIds: string[] }>();
    for (const r of inventoryRecords) {
      const groupKey = `${r.yearMonth}__${r.sku}`;
      const existing = grouped.get(groupKey);
      if (!existing) {
        grouped.set(groupKey, {
          sku: r.sku,
          stockQty: r.stockQty,
          yearMonth: r.yearMonth,
          salesStatus: r.salesStatus,
          recordIds: [r.id],
        });
      }
    }

    const rows: DisplayRow[] = [];
    for (const [, v] of grouped) {
      const skuKey = v.sku.toLowerCase().replace(/\s/g, '');
      const mapping = skuMap.get(skuKey);
      const productName = mapping?.productName || v.sku;
      const productOwner = mapping?.productOwner || '';

      // 月销量 = 三平台订单中该月份该SKU的销量求和
      const salesKey = `${v.yearMonth}__${skuKey}`;
      const monthlySales = salesQtyMap.get(salesKey) || 0;

      // 预估销售时长 = 库存 / 月销量（月销量>0时）
      const estimatedMonths = monthlySales > 0 ? v.stockQty / monthlySales : null;

      // 计算 displaySalesStatus
      const displaySalesStatus: '清货' | '热销' | '正常' | '平销' = (v.salesStatus === '清货' ? '清货' : (monthlySales >= 500 ? '热销' : (estimatedMonths !== null && estimatedMonths > 0 && estimatedMonths <= 6 ? '正常' : '平销'))) as '清货' | '热销' | '正常' | '平销';

      // 筛选
      if (yearMonthFilter.length > 0 && !yearMonthFilter.includes(v.yearMonth)) continue;
      if (statusFilter.length > 0 && !statusFilter.includes(displaySalesStatus)) continue;
      if (ownerFilter.length > 0 && !ownerFilter.includes(productOwner)) continue;
      if (hideZeroStock && v.stockQty === 0) continue;

      // 货值 = 库存 * 采购成本
      const goodsValue = v.stockQty * (mapping?.purchasePrice || 0);

      rows.push({
        sku: v.sku,
        productName,
        productOwner,
        stock: v.stockQty,
        monthlySales,
        salesStatus: v.salesStatus,
        displaySalesStatus,
        estimatedMonths,
        goodsValue,
        recordIds: v.recordIds,
        yearMonth: v.yearMonth,
      });
    }

    // 合并相同商品名称的行
    const mergedMap = new Map<string, {
      productName: string;
      productOwner: string;
      stock: number;
      monthlySales: number;
      salesStatus: InventoryRecord['salesStatus'];
      goodsValue: number;
      yearMonth: string;
      recordIds: string[];
    }>();

    for (const row of rows) {
      const mergeKey = row.productName;
      const existing = mergedMap.get(mergeKey);
      if (existing) {
        existing.stock += row.stock;
        existing.monthlySales += row.monthlySales;
        existing.goodsValue += row.goodsValue;
        // 保留最后一个销售状态
        if (row.salesStatus) existing.salesStatus = row.salesStatus;
        existing.recordIds.push(...row.recordIds);
      } else {
        mergedMap.set(mergeKey, {
          productName: row.productName,
          productOwner: row.productOwner,
          stock: row.stock,
          monthlySales: row.monthlySales,
          salesStatus: row.salesStatus,
          goodsValue: row.goodsValue,
          yearMonth: row.yearMonth,
          recordIds: row.recordIds,
        });
      }
    }

    // 转换为最终展示行，计算系统判定
    const mergedRows: DisplayRow[] = [];
    for (const [, v] of mergedMap) {
      const estimatedMonths = v.monthlySales > 0 ? v.stock / v.monthlySales : null;

      // 计算实际显示的销售情况
      let displaySalesStatus: '热销' | '正常' | '平销' | '清货' | '' = '';
      if (v.salesStatus === '清货') {
        displaySalesStatus = '清货';
      } else if (v.salesStatus === '系统判定') {
        if (v.monthlySales >= 500) {
          displaySalesStatus = '热销';
        } else if (estimatedMonths !== null && estimatedMonths <= 6) {
          displaySalesStatus = '正常';
        } else {
          displaySalesStatus = '平销';
        }
      }

      mergedRows.push({
        sku: '',
        productName: v.productName,
        productOwner: v.productOwner,
        stock: v.stock,
        monthlySales: v.monthlySales,
        salesStatus: v.salesStatus,
        displaySalesStatus,
        estimatedMonths,
        goodsValue: v.goodsValue,
        recordIds: v.recordIds,
        yearMonth: v.yearMonth,
      });
    }

    // 隐藏库存为0的商品
    const filtered = hideZeroStock ? mergedRows.filter(r => r.stock > 0) : mergedRows;

    // 排序
    if (sortKey) {
      filtered.sort((a, b) => {
        const av = a[sortKey] ?? -Infinity;
        const bv = b[sortKey] ?? -Infinity;
        return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
      });
    }

    return filtered;
  }, [skuMappings, inventoryRecords, yearMonthFilter, ownerFilter, statusFilter, sortKey, sortDir, hideZeroStock]);

  // ====== 总计行 ======
  const totalRow = useMemo(() => {
    const totalStock = displayRows.reduce((s, r) => s + r.stock, 0);
    const totalMonthlySales = displayRows.reduce((s, r) => s + r.monthlySales, 0);
    const totalGoodsValue = displayRows.reduce((s, r) => s + r.goodsValue, 0);
    const totalEstimatedMonths = totalMonthlySales > 0 ? totalStock / totalMonthlySales : null;
    return { totalStock, totalMonthlySales, totalGoodsValue, totalEstimatedMonths };
  }, [displayRows]);

  // ====== 导入处理 ======
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      const records: { sku: string; stockQty: number }[] = [];
      for (const row of json) {
        // 查找"商品名称"或"SKU编码"列
        const skuKey = Object.keys(row).find(
          (k) => k.trim() === '商品名称' || k.trim() === 'SKU编码' || k.trim() === 'SKU' || k.trim().toLowerCase() === 'sku'
        );
        // 查找"可用量"或"库存"列
        const stockKey = Object.keys(row).find(
          (k) => k.trim() === '可用量' || k.trim() === '库存量' || k.trim() === '库存' || k.trim() === '可用库存'
        );
        if (skuKey && stockKey) {
          const sku = String(row[skuKey] ?? '').trim();
          const stockQty = Number(row[stockKey]) || 0;
          if (sku) records.push({ sku, stockQty });
        }
      }
      setImportData(records);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleImportConfirm = useCallback(async () => {
    if (!importYear || !importMonth || importData.length === 0) return;
    const yearMonth = `${importYear}-${importMonth.padStart(2, '0')}`;
    await importInventory({ fileName: importFileName, yearMonth }, importData);
    setImportOpen(false);
    setImportData([]);
    setImportFileName('');
    setImportYear('');
    setImportMonth('');
  }, [importYear, importMonth, importData, importFileName, importInventory]);

  // ====== 导出 ======
  const handleExport = useCallback(() => {
    const exportData = displayRows.map((r, i) => ({
      '序号': i + 1,
      '商品名称': r.productName,
      '产品负责人': r.productOwner,
      '月底库存': r.stock,
      '月销量': r.monthlySales,
      '销售情况': r.displaySalesStatus || '',
      '预估销售时长(月)': r.estimatedMonths !== null ? Number(r.estimatedMonths.toFixed(1)) : '',
      '货值': Number(r.goodsValue.toFixed(2)),
    }));
    // 总计行
    exportData.push({
      '序号': '' as unknown as number,
      '商品名称': '总计',
      '产品负责人': '所有',
      '月底库存': totalRow.totalStock,
      '月销量': totalRow.totalMonthlySales,
      '销售情况': '',
      '预估销售时长(月)': totalRow.totalEstimatedMonths !== null ? Number(totalRow.totalEstimatedMonths.toFixed(1)) : '',
      '货值': Number(totalRow.totalGoodsValue.toFixed(2)),
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '库存查询');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), '库存查询.xlsx');
  }, [displayRows, totalRow]);

  // ====== 模板下载 ======
  const handleDownloadTemplate = useCallback(() => {
    const template = [{ '商品名称': 'SKU001', '可用量': 100 }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '库存导入模板');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), '库存导入模板.xlsx');
  }, []);

  // ====== 筛选重置 ======
  const resetFilters = () => {
    setYearMonthFilter([]);
    setOwnerFilter([]);
    setStatusFilter([]);
    setHideZeroStock(false);
  };

  const hasActiveFilter = yearMonthFilter.length > 0 || ownerFilter.length > 0 || statusFilter.length > 0 || hideZeroStock;

  // ====== 年份列表 ======
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-1" /> 导入库存
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={displayRows.length === 0}>
            <Download className="w-4 h-4 mr-1" /> 导出
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            下载模板
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          已导入 {inventoryFiles.length} 个库存文件
        </div>
      </div>

      {/* 已导入文件列表 */}
      {inventoryFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {inventoryFiles.map((f) => (
            <div key={f.id} className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-md border text-sm">
              <span className="text-slate-700">{f.fileName}</span>
              <Badge variant="outline" className="text-xs">{f.yearMonth}</Badge>
              <button
                className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                onClick={() => deleteInventoryFile(f.id)}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 筛选栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 年月筛选 */}
        <Popover open={ymPopoverOpen} onOpenChange={setYmPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="w-3 h-3 mr-1" />
              {yearMonthFilter.length === 0 ? '月销月份' : `月份(${yearMonthFilter.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {availableYearMonths.length === 0 && (
                <div className="text-sm text-slate-400 px-2 py-1">暂无数据</div>
              )}
              {availableYearMonths.map((ym) => (
                <label key={ym} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                  <Checkbox
                    checked={yearMonthFilter.includes(ym)}
                    onCheckedChange={(checked) => {
                      setYearMonthFilter((prev) =>
                        checked ? [...prev, ym] : prev.filter((v) => v !== ym)
                      );
                    }}
                  />
                  {ym}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* 产品负责人筛选 */}
        {availableOwners.length > 0 && (
          <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="w-3 h-3 mr-1" />
                {ownerFilter.length === 0 ? '全部负责人' : `负责人(${ownerFilter.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {availableOwners.map((owner) => (
                  <label key={owner} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                    <Checkbox
                      checked={ownerFilter.includes(owner)}
                      onCheckedChange={(checked) => {
                        setOwnerFilter((prev) =>
                          checked ? [...prev, owner] : prev.filter((v) => v !== owner)
                        );
                      }}
                    />
                    {owner}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* 销售情况筛选 */}
        <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="w-3 h-3 mr-1" />
              {statusFilter.length === 0 ? '全部销售情况' : `销售情况(${statusFilter.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1">
              {availableStatuses.map((status) => (
                <label key={status} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-sm">
                  <Checkbox
                    checked={statusFilter.includes(status)}
                    onCheckedChange={(checked) => {
                      setStatusFilter((prev) =>
                        checked ? [...prev, status] : prev.filter((v) => v !== status)
                      );
                    }}
                  />
                  {status}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
          <Checkbox
            checked={hideZeroStock}
            onCheckedChange={(checked) => setHideZeroStock(checked === true)}
          />
          隐藏零库存
        </label>

        {hasActiveFilter && (
          <Button variant="ghost" size="sm" className="h-8 text-slate-500" onClick={resetFilters}>
            <X className="w-3 h-3 mr-1" /> 清除筛选
          </Button>
        )}
      </div>

      {/* 数据表格 */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[50px] text-center">序号</TableHead>
              <TableHead>商品名称</TableHead>
              <TableHead>产品负责人</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('stock')}
              >
                <span className="inline-flex items-center gap-1">
                  月底库存 <SortIcon column="stock" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('monthlySales')}
              >
                <span className="inline-flex items-center gap-1">
                  月销量 <SortIcon column="monthlySales" />
                </span>
              </TableHead>
              <TableHead className="text-center">销售情况</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('estimatedMonths')}
              >
                <span className="inline-flex items-center gap-1">
                  预估销售时长(月) <SortIcon column="estimatedMonths" />
                </span>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('goodsValue')}
              >
                <span className="inline-flex items-center gap-1">
                  货值 <SortIcon column="goodsValue" />
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-slate-400">
                  暂无库存数据，请先导入库存表格
                </TableCell>
              </TableRow>
            ) : (
              <>
                {displayRows.map((row, idx) => (
                  <TableRow key={row.recordIds.join(',')}>
                    <TableCell className="text-center text-slate-400 text-sm">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{row.productName}</TableCell>
                    <TableCell className="text-slate-600">{row.productOwner}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(row.stock)}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={row.monthlySales < 0 ? 'text-red-500' : ''}>
                        {formatNumber(row.monthlySales)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={row.salesStatus || ''}
                        onValueChange={(val) => {
                          const status = val as InventoryRecord['salesStatus'];
                          batchUpdateInventorySalesStatus(row.recordIds, status);
                        }}
                      >
                        <SelectTrigger className="h-7 w-24 mx-auto text-xs">
                          <SelectValue placeholder="选择">
                            {row.salesStatus === '系统判定' && row.displaySalesStatus
                              ? row.displaySalesStatus
                              : row.salesStatus || '选择'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="清货">清货</SelectItem>
                          <SelectItem value="系统判定">系统判定</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.estimatedMonths !== null ? row.estimatedMonths.toFixed(1) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(row.goodsValue)}</TableCell>
                  </TableRow>
                ))}
                {/* 总计行 */}
                <TableRow className="bg-slate-100 font-bold">
                  <TableCell className="text-center text-slate-500">-</TableCell>
                  <TableCell>总计</TableCell>
                  <TableCell>所有</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(totalRow.totalStock)}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(totalRow.totalMonthlySales)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono">
                    {totalRow.totalEstimatedMonths !== null ? totalRow.totalEstimatedMonths.toFixed(1) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totalRow.totalGoodsValue)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 导入弹窗 */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>导入库存数据</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>选择文件</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                onChange={handleFileSelect}
              />
              <p className="text-xs text-slate-400 mt-1">
                支持 .xlsx/.xls/.csv 格式，需包含「商品名称」和「可用量」列
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>年份</Label>
                <Select value={importYear} onValueChange={setImportYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择年份" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}年</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>月份</Label>
                <Select value={importMonth} onValueChange={setImportMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择月份" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{parseInt(m)}月</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {importData.length > 0 && (
              <div className="p-3 bg-green-50 rounded-md text-sm text-green-700">
                已解析 {importData.length} 条库存记录
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleImportConfirm}
              disabled={!importYear || !importMonth || importData.length === 0}
            >
              确认导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
