'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/store';
import { parseExcelFile, downloadPlatformTemplate, exportToExcel } from '@/lib/excel';
import { formatCurrency, PLATFORM_CONFIG } from '@/types';
import type { Platform, RawOrderData, SkuSummary, PlatformSummary, CalculatedOrder, SavedCalcConfig, ShopName } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Upload, Download, Trash2, FileSpreadsheet, Settings2,
  BarChart3, Package, TrendingUp, TrendingDown,
  ShoppingCart, Info, AlertCircle, Save, Plus, Pencil, Check, X, Store, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Hash,
} from 'lucide-react';

// 平台数据导入组件
function PlatformDataImport({ platform }: { platform: Platform }) {
  const { rawOrders, importOrders, deleteOrderFile, clearOrders } = useAppStore();
  const platformOrders = rawOrders[platform];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [yearMonth, setYearMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedShopName, setSelectedShopName] = useState<string>('');
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const config = PLATFORM_CONFIG[platform];
  const { shopNames, savedConfigs } = useAppStore();
  const platformShopNames = shopNames.filter((s: ShopName) => s.platform === platform);
  const platformConfigs = savedConfigs[platform] || [];

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    // 重置文件输入，以便同一文件可再次选择
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingFile) return;
    setImporting(true);
    try {
      const { headers, rows } = await parseExcelFile(pendingFile);
      if (rows.length === 0) return;
      importOrders(platform, {
        platform,
        fileName: pendingFile.name,
        headers,
        rows,
        yearMonth,
        shopName: selectedShopName,
        configId: selectedConfigId,
      });
    } catch (err) {
      console.error('导入失败:', err);
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  }, [platform, importOrders, pendingFile, yearMonth, selectedShopName, selectedConfigId]);

  const handleCancelImport = useCallback(() => {
    setPendingFile(null);
  }, []);

  const totalRows = platformOrders.reduce((sum: number, o: RawOrderData) => sum + o.rows.length, 0);

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            size="sm"
            style={{ backgroundColor: config.color, color: '#fff' }}
            className="hover:opacity-90"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {importing ? '导入中...' : '导入订单表格'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadPlatformTemplate(platform)}>
            <Download className="h-4 w-4 mr-1.5" />
            下载导入模板
          </Button>
        </div>
        {platformOrders.length > 0 && (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => clearOrders(platform)}>
            清空全部数据
          </Button>
        )}
      </div>

      {/* 提示 */}
      <Card className="border-dashed">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">使用说明：</span>
              请直接上传从 {config.name} 平台导出的订单表格。导入后，系统会自动读取表格的列头字段，
              你可以在「计算配置」标签页中选择各字段对应的列名及关联的店铺名称。也可点击「下载导入模板」获取参考格式。
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 已导入文件列表 */}
      {platformOrders.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>暂无导入的订单数据</p>
          <p className="text-xs mt-1">点击「导入订单表格」上传 {config.name} 平台的订单文件</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            共 <span className="font-medium text-foreground">{platformOrders.length}</span> 个文件，
            <span className="font-medium text-foreground"> {totalRows}</span> 条数据
          </div>
          {platformOrders.map((order: RawOrderData) => (
            <Card key={order.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{order.fileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.rows.length} 条记录 · {order.headers.length} 个字段 · {order.yearMonth ? `${order.yearMonth}` : '未设年月'} · {new Date(order.importTime).toLocaleString('zh-CN')}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {order.headers.slice(0, 8).map((h) => (
                          <Badge key={h} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                            {h}
                          </Badge>
                        ))}
                        {order.headers.length > 8 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            +{order.headers.length - 8}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    onClick={() => deleteOrderFile(platform, order.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 导入设置弹窗 */}
      <Dialog open={!!pendingFile} onOpenChange={(open) => { if (!open) handleCancelImport(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>设置数据关联信息</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="text-sm text-muted-foreground">
              请设置该表格数据的关联信息，用于统计结果中按时间和店铺筛选。
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">年份月份</label>
              <Input
                type="month"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">关联店铺</label>
              {shopNames.filter((s) => s.platform === platform).length > 0 ? (
                <Select value={selectedShopName} onValueChange={setSelectedShopName}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择店铺" />
                  </SelectTrigger>
                  <SelectContent>
                    {shopNames.filter((s) => s.platform === platform).map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  未配置店铺名称，请先到「店铺名称明细」页面添加
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">关联计算方案</label>
              {savedConfigs[platform].length > 0 ? (
                <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择计算方案" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedConfigs[platform].map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground">
                  请先在「计算配置」中创建方案
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              当前文件：<span className="font-medium text-foreground">{pendingFile?.name}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelImport}>取消</Button>
            <Button onClick={handleConfirmImport} disabled={!yearMonth || !selectedShopName || !selectedConfigId || importing}>
              <Upload className="h-4 w-4 mr-1" />
              {importing ? '导入中...' : '确认导入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 平台计算配置组件 — 支持多配置方案存储
function PlatformCalcConfig({ platform }: { platform: Platform }) {
  const {
    savedConfigs, activeConfigId, getActiveConfig,
    updateFieldMapping, updateFieldAlias, updateFormula, updateFilterRules, setCountQuantityAsRows, availableHeaders, rawOrders, skuMappings, shopNames,
    saveCurrentConfig, switchConfig, deleteConfig, renameConfig,
  } = useAppStore();
  const config = getActiveConfig(platform);
  const headers = availableHeaders[platform];
  const hasImportedData = rawOrders[platform].length > 0;
  const configs = savedConfigs[platform];
  const currentId = activeConfigId[platform];
  const platformShopNames = shopNames.filter((s) => s.platform === platform);
  const [editingFormula, setEditingFormula] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // 双击编辑字段别名的状态
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [aliasValue, setAliasValue] = useState('');
  // 当前正在编辑的公式 key
  const [activeFormulaKey, setActiveFormulaKey] = useState<string | null>(null);

  // 字段 key 列表（用于字段映射区域渲染和公式变量参考）
  const fieldKeys = ['orderNo', 'sku', 'quantity', 'unitPrice', 'platformDiscount', 'platformFee', 'shippingFee'];

  // 获取字段别名（自定义名称），优先使用 fieldAliases，否则 fallback 到默认中文名
  const getFieldAlias = (key: string): string => {
    return config.fieldAliases?.[key] || key;
  };

  const formulaLabels: Record<string, string> = {
    totalAmount: '总金额（总价）',
    netAmount: '扣除手续费后金额',
    profit: '利润',
    profitRate: '利润率(%)',
  };

  // 获取指定字段在已导入数据中的所有唯一值（用于过滤规则的状态选择）
  const getUniqueValuesForField = useCallback((fieldName: string): string[] => {
    if (!fieldName) return [];
    const values = new Set<string>();
    for (const orderFile of rawOrders[platform]) {
      for (const row of orderFile.rows) {
        const val = row[fieldName];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          values.add(String(val).trim());
        }
      }
    }
    return Array.from(values).sort();
  }, [rawOrders, platform]);

  // 双击编辑字段别名的处理
  const handleStartAliasEdit = (key: string) => {
    setEditingAlias(key);
    setAliasValue(getFieldAlias(key));
  };

  const handleConfirmAlias = () => {
    if (editingAlias && aliasValue.trim()) {
      updateFieldAlias(platform, editingAlias, aliasValue.trim());
    }
    setEditingAlias(null);
    setAliasValue('');
  };

  const handleCancelAlias = () => {
    setEditingAlias(null);
    setAliasValue('');
  };

  // 公式中可使用的变量列表（来源于字段映射中已映射的字段 + 系统计算字段）
  const formulaVariables = useMemo(() => {
    const vars: { key: string; label: string; mapped: boolean }[] = [];
    // 来自字段映射的字段（使用自定义别名）
    for (const key of fieldKeys) {
      if (config.fieldMapping[key]) {
        vars.push({
          key,
          label: getFieldAlias(key),
          mapped: true,
        });
      }
    }
    // 系统计算字段（来自 SKU 映射和公式链式计算结果）
    vars.push({ key: 'purchasePrice', label: '采购单价（来自SKU映射）', mapped: true });
    vars.push({ key: 'totalAmount', label: formulaLabels.totalAmount + '（公式计算结果）', mapped: true });
    vars.push({ key: 'netAmount', label: formulaLabels.netAmount + '（公式计算结果）', mapped: true });
    vars.push({ key: 'profit', label: formulaLabels.profit + '（公式计算结果）', mapped: true });
    return vars;
  }, [config.fieldMapping, config.fieldAliases]);

  const handleSaveAs = () => {
    const name = newConfigName.trim();
    if (!name) return;
    saveCurrentConfig(platform, name);
    setNewConfigName('');
    setShowSaveDialog(false);
  };

  const handleStartRename = (c: SavedCalcConfig) => {
    setRenamingId(c.id);
    setRenameValue(c.name);
  };

  const handleConfirmRename = () => {
    if (renamingId && renameValue.trim()) {
      renameConfig(platform, renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  return (
    <div className="space-y-6">
      {/* 未导入数据提示 */}
      {!hasImportedData && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800">
                <span className="font-medium">请先导入订单表格</span>
                <span className="text-amber-700">—— 系统需要从导入的表格中读取列头字段，才能在此配置映射关系。请前往「数据导入」标签页上传表格。</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 配置方案管理 */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            计算方案
          </CardTitle>
          <CardDescription>
            每个平台支持保存多个计算方案，可随时切换。当前方案的修改会实时保存。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 当前方案选择 */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium shrink-0">当前方案：</label>
              <Select value={currentId} onValueChange={(id) => switchConfig(platform, id)}>
                <SelectTrigger className="h-9 flex-1 max-w-xs">
                  <SelectValue placeholder="选择方案..." />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setNewConfigName(''); setShowSaveDialog(true); }}
                className="shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                另存为新方案
              </Button>
            </div>

            {/* 已保存的方案列表 */}
            <div className="space-y-1.5">
              {configs.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    c.id === currentId
                      ? 'border-primary/30 bg-primary/5 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className={`h-2 w-2 rounded-full shrink-0 ${c.id === currentId ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  {renamingId === c.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmRename();
                          if (e.key === 'Escape') handleCancelRename();
                        }}
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleConfirmRename}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCancelRename}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 font-medium truncate">{c.name}</span>
                      {c.id === currentId && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">使用中</Badge>
                      )}
                      <span className="text-xs text-muted-foreground/70 shrink-0">
                        {new Date(c.updatedAt).toLocaleDateString('zh-CN')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => handleStartRename(c)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {configs.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                          onClick={() => deleteConfig(platform, c.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 字段映射 */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            字段映射
            <Badge variant="outline" className="text-xs font-normal">{config.name}</Badge>
          </CardTitle>
          <CardDescription>
            从导入表格的列头中选择对应的系统字段。双击字段名称可自定义命名；「商品名称」由 SKU 映射库自动匹配；「店铺名称」在导入表格时选择。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {headers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              暂无可选字段。请先在「数据导入」标签页上传表格文件。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 商品名称 — 来自 SKU 映射，不可选择 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">商品名称</label>
                <div className="flex h-9 items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-sm">
                  <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-500 truncate">
                    {skuMappings.length > 0
                      ? `自动从 SKU 映射获取（已录入 ${skuMappings.length} 条）`
                      : '暂无 SKU 映射数据，请先录入'}
                  </span>
                </div>
              </div>
              {/* 店铺名称 — 在导入时选择 */}
              {fieldKeys.map((key) => (
                <div key={key} className="space-y-1.5">
                  {editingAlias === key ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={aliasValue}
                        onChange={(e) => setAliasValue(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmAlias();
                          if (e.key === 'Escape') handleCancelAlias();
                        }}
                        onBlur={handleConfirmAlias}
                      />
                    </div>
                  ) : (
                    <label
                      className="text-sm font-medium cursor-pointer hover:text-primary group flex items-center gap-1"
                      onDoubleClick={() => handleStartAliasEdit(key)}
                      title="双击编辑字段名称"
                    >
                      {getFieldAlias(key)}
                      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </label>
                  )}
                  <Select
                    value={config.fieldMapping[key] || '__none__'}
                    onValueChange={(value) => updateFieldMapping(platform, key, value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择对应列..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">— 不映射 —</span>
                      </SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          {hasImportedData && headers.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs text-muted-foreground">
                已检测到 <span className="font-medium text-foreground">{headers.length}</span> 个表格列头字段：
                <span className="ml-1">{headers.join('、')}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 订单过滤规则 */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            订单过滤规则
          </CardTitle>
          <CardDescription className="text-xs">
            设置排除规则：被排除的订单不计算单量也不计算销售额；或设置只统计数量不计金额的规则
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 规则1：根据字段排除指定状态 */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">排除指定状态的订单（不计算单量也不计算销售额）</Label>
            <div className="flex items-center gap-2">
              <Select
                value={config?.filterRules?.excludeStatusField || ''}
                onValueChange={(v) => {
                  updateFilterRules(platform, { excludeStatusField: v });
                  // 清空之前选择的排除值
                  if (v !== (config?.filterRules?.excludeStatusField || '')) {
                    updateFilterRules(platform, { excludeStatusValues: [] });
                  }
                }}
              >
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="选择状态字段" />
                </SelectTrigger>
                <SelectContent>
                  {(headers || []).map((h: string) => (
                    <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-slate-500">下的</span>
            </div>
            {config?.filterRules?.excludeStatusField && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {getUniqueValuesForField(config.filterRules.excludeStatusField).map((val: string) => {
                    const isSelected = (config?.filterRules?.excludeStatusValues || []).includes(val);
                    return (
                      <Badge
                        key={val}
                        variant={isSelected ? 'default' : 'outline'}
                        className={`cursor-pointer text-xs h-6 ${isSelected ? 'bg-red-100 text-red-700 hover:bg-red-200 border-red-300' : 'hover:bg-slate-100'}`}
                        onClick={() => {
                          const current = config?.filterRules?.excludeStatusValues || [];
                          const next = isSelected
                            ? current.filter((v: string) => v !== val)
                            : [...current, val];
                          updateFilterRules(platform, { excludeStatusValues: next });
                        }}
                      >
                        {val}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  点击选择要排除的状态，排除后不计算单量也不计算销售额（已选 {(config?.filterRules?.excludeStatusValues || []).length} 项）
                </p>
              </div>
            )}
          </div>

          {/* 规则2：订单金额为0不计入 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="excludeZeroAmount"
              checked={config?.filterRules?.excludeZeroAmount ?? true}
              onChange={(e) => updateFilterRules(platform, { excludeZeroAmount: e.target.checked })}
              className="rounded border-slate-300"
            />
            <Label htmlFor="excludeZeroAmount" className="text-xs font-medium text-slate-700 cursor-pointer">
              排除订单金额为0的订单（寄样订单）
            </Label>
          </div>

          {/* 规则3：只统计数量不统计金额的状态 */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-700">只统计数量不统计金额的订单</Label>
            <div className="flex items-center gap-2">
              <Select
                value={config?.filterRules?.quantityOnlyStatusField || ''}
                onValueChange={(v) => {
                  updateFilterRules(platform, { quantityOnlyStatusField: v });
                  if (v !== (config?.filterRules?.quantityOnlyStatusField || '')) {
                    updateFilterRules(platform, { quantityOnlyStatusValues: [] });
                  }
                }}
              >
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="选择状态字段" />
                </SelectTrigger>
                <SelectContent>
                  {(headers || []).map((h: string) => (
                    <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-slate-500">下的</span>
            </div>
            {config?.filterRules?.quantityOnlyStatusField && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {getUniqueValuesForField(config.filterRules.quantityOnlyStatusField).map((val: string) => {
                    const isSelected = (config?.filterRules?.quantityOnlyStatusValues || []).includes(val);
                    return (
                      <Badge
                        key={val}
                        variant={isSelected ? 'default' : 'outline'}
                        className={`cursor-pointer text-xs h-6 ${isSelected ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-300' : 'hover:bg-slate-100'}`}
                        onClick={() => {
                          const current = config?.filterRules?.quantityOnlyStatusValues || [];
                          const next = isSelected
                            ? current.filter((v: string) => v !== val)
                            : [...current, val];
                          updateFilterRules(platform, { quantityOnlyStatusValues: next });
                        }}
                      >
                        {val}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  点击选择只统计数量的状态（已选 {(config?.filterRules?.quantityOnlyStatusValues || []).length} 项）
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 数量计算方式 */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" />
            数量计算方式
            <Badge variant="outline" className="text-xs font-normal">{config.name}</Badge>
          </CardTitle>
          <CardDescription className="mt-1">
            选择"数量"字段的计算方式：求和（将每行的数量值累加）或计数（每行计为1，不读取数量字段的值）。Lazada 平台通常使用计数方式。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`quantityMode-${platform}`}
                checked={!config.countQuantityAsRows}
                onChange={() => {
                  setCountQuantityAsRows(platform, false);
                }}
                className="accent-slate-800"
              />
              <span className="text-sm">求和 — 累加每行数量字段的值</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`quantityMode-${platform}`}
                checked={config.countQuantityAsRows}
                onChange={() => {
                  setCountQuantityAsRows(platform, true);
                }}
                className="accent-slate-800"
              />
              <span className="text-sm">计数 — 每行计为1（适用于Lazada）</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* 计算公式 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                计算公式
                <Badge variant="outline" className="text-xs font-normal">{config.name}</Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                定义各计算指标的计算方式。可用变量来源于字段映射和 SKU 映射。公式按顺序执行：总金额 → 扣除手续费后金额 → 利润 → 利润率，后面的公式可引用前面的计算结果。点击变量按钮可插入到当前聚焦的公式中。
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingFormula(!editingFormula)}
            >
              {editingFormula ? '锁定公式' : '编辑公式'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 可用变量参考 — 来源于字段映射中已映射的字段 */}
            {editingFormula && formulaVariables.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">可用变量（点击插入到当前公式）：</span>
                <div className="flex flex-wrap gap-1.5">
                  {formulaVariables.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-mono hover:bg-muted transition-colors"
                      onClick={() => {
                        if (!activeFormulaKey) return;
                        const currentExpr = config.formulas[activeFormulaKey as keyof typeof config.formulas] ?? '';
                        updateFormula(
                          platform,
                          activeFormulaKey as keyof typeof config.formulas,
                          currentExpr + v.key
                        );
                      }}
                      title={`插入变量 ${v.key}（${v.label}）`}
                    >
                      <span className="text-primary font-medium">{v.key}</span>
                      <span className="text-muted-foreground">({v.label})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {Object.entries(formulaLabels).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">{label}</label>
                </div>
                {editingFormula ? (
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={config.formulas[key as keyof typeof config.formulas] ?? ''}
                    onChange={(e) =>
                      updateFormula(platform, key as keyof typeof config.formulas, e.target.value)
                    }
                    onFocus={() => setActiveFormulaKey(key)}
                    placeholder="输入计算表达式，如: totalAmount - platformFee"
                  />
                ) : (
                  <div className="px-3 py-2 bg-muted rounded-md font-mono text-sm">
                    {config.formulas[key as keyof typeof config.formulas]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 另存为新方案弹窗 */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>另存为新方案</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">方案名称</label>
            <Input
              value={newConfigName}
              onChange={(e) => setNewConfigName(e.target.value)}
              placeholder="输入方案名称，如：含运费利润"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAs();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>取消</Button>
            <Button onClick={handleSaveAs} disabled={!newConfigName.trim()}>
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 平台统计结果组件
function PlatformStats({ platform }: { platform: Platform }) {
  const { calculateSummary, calculateSkuSummaries, shopNames, rawOrders, savedConfigs, activeConfigId, getActiveConfig } = useAppStore();
  const summary = calculateSummary(platform);
  const skuSummaries = calculateSkuSummaries(platform);
  const platformConfig = PLATFORM_CONFIG[platform];
  const [viewMode, setViewMode] = useState<'orders' | 'sku'>('sku');
  const [filterShops, setFilterShops] = useState<string[]>([]); // 多选店铺，空数组=全部
  const [filterYearMonth, setFilterYearMonth] = useState<string>('__all__');
  const [showDebug, setShowDebug] = useState(false);

  // 获取该平台下的店铺名称列表
  const platformShops = shopNames.filter((s) => s.platform === platform);

  // 从订单数据中提取可用的年月选项
  const availableYearMonths = Array.from(
    new Set(summary.orders.map((o) => o.orderDate).filter(Boolean))
  ).sort().reverse();

  // 筛选订单
  const filteredOrders = summary.orders.filter((o) => {
    if (filterShops.length > 0 && !filterShops.includes(o.shopName)) return false;
    if (filterYearMonth !== '__all__' && o.orderDate !== filterYearMonth) return false;
    return true;
  });

  // 筛选后的商品汇总（仅按商品名称分类，不按 SKU 分类）
  const filteredSkuSummaries = (() => {
    const map = new Map<string, SkuSummary>();
    for (const order of filteredOrders) {
      const key = `${order.productName || order.sku}|${order.shopName || '__all__'}`;
      if (!map.has(key)) {
        map.set(key, {
          sku: order.sku,
          productName: order.productName,
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
      const s = map.get(key)!;
      s.totalQuantity += order.quantity;
      s.totalSales += order.totalAmount;
      s.totalPlatformFee += order.platformFee;
      s.totalNetAmount += order.netAmount;
      s.totalPurchaseCost += order.purchasePrice * order.quantity;
      s.totalProfit += order.profit;
      s.orderCount += 1;
    }
    // 计算平均单价和利润率
    for (const s of map.values()) {
      s.avgUnitPrice = s.totalQuantity > 0 ? s.totalSales / s.totalQuantity : 0;
      s.profitRate = s.totalSales > 0 ? s.totalProfit / s.totalSales * 100 : 0;
    }
    return Array.from(map.values());
  })();

  // 筛选后的汇总数据
  const filteredTotalSales = filteredOrders.reduce((s: number, o: CalculatedOrder) => s + o.totalAmount, 0);
  const filteredTotalOrders = new Set(filteredOrders.map((o: CalculatedOrder) => o.orderNo)).size;
  const filteredTotalQuantity = filteredOrders.reduce((s: number, o: CalculatedOrder) => s + o.quantity, 0);
  const filteredTotalPlatformFee = filteredOrders.reduce((s: number, o: CalculatedOrder) => s + o.platformFee, 0);
  const filteredTotalNetAmount = filteredOrders.reduce((s: number, o: CalculatedOrder) => s + o.netAmount, 0);
  const filteredTotalPurchaseCost = filteredOrders.reduce((s: number, o: CalculatedOrder) => s + o.purchasePrice * o.quantity, 0);
  const filteredTotalProfit = filteredOrders.reduce((s: number, o: CalculatedOrder) => s + o.profit, 0);
  const filteredTotalProfitRate = filteredTotalSales > 0 ? filteredTotalProfit / filteredTotalSales * 100 : 0;

  const hasData = summary.orders.length > 0;

  if (!hasData) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>暂无统计数据</p>
        <p className="text-xs mt-1">请先在「数据导入」标签页导入订单数据，并在「计算配置」中设置字段映射</p>
      </div>
    );
  }

  // 筛选条件是否生效
  const isFiltering = filterShops.length > 0 || filterYearMonth !== '__all__';

  return (
    <div className="space-y-6">
      {/* 筛选器 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">筛选：</span>
            </div>
            {/* 店铺名称筛选 - 多选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground shrink-0">店铺名称</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-auto min-w-[160px] justify-between font-normal">
                    {filterShops.length === 0
                      ? '全部店铺'
                      : filterShops.length === 1
                        ? filterShops[0]
                        : `已选 ${filterShops.length} 个店铺`}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="搜索店铺..." />
                    <CommandList>
                      <CommandEmpty>未找到店铺</CommandEmpty>
                      <CommandGroup>
                        {/* 全选/取消全选 */}
                        <CommandItem
                          onSelect={() => setFilterShops([])}
                          className="cursor-pointer"
                        >
                          <Checkbox
                            checked={filterShops.length === 0}
                            className="mr-2"
                          />
                          <span className="font-medium">全部店铺</span>
                        </CommandItem>
                        {platformShops.map((s) => (
                          <CommandItem
                            key={s.id}
                            onSelect={() => {
                              setFilterShops((prev) =>
                                prev.includes(s.name)
                                  ? prev.filter((n) => n !== s.name)
                                  : [...prev, s.name]
                              );
                            }}
                            className="cursor-pointer"
                          >
                            <Checkbox
                              checked={filterShops.includes(s.name)}
                              className="mr-2"
                            />
                            {s.name}
                          </CommandItem>
                        ))}
                        {/* 也添加订单中实际出现但未在店铺列表中的名称 */}
                        {Array.from(new Set(summary.orders.map((o) => o.shopName).filter(Boolean)))
                          .filter((name) => !platformShops.some((s) => s.name === name))
                          .map((name) => (
                            <CommandItem
                              key={name}
                              onSelect={() => {
                                setFilterShops((prev) =>
                                  prev.includes(name)
                                    ? prev.filter((n) => n !== name)
                                    : [...prev, name]
                                );
                              }}
                              className="cursor-pointer"
                            >
                              <Checkbox
                                checked={filterShops.includes(name)}
                                className="mr-2"
                              />
                              {name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {filterShops.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={() => setFilterShops([])}
                >
                  清除
                </Button>
              )}
            </div>
            {/* 年月筛选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground shrink-0">年月</label>
              <Select value={filterYearMonth} onValueChange={setFilterYearMonth}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder="全部时间" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部时间</SelectItem>
                  {availableYearMonths.map((ym) => (
                    <SelectItem key={ym} value={ym}>{ym}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* 重置 */}
            {isFiltering && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFilterShops([]); setFilterYearMonth('__all__'); }}
              >
                重置筛选
              </Button>
            )}
            {isFiltering && (
              <span className="text-xs text-muted-foreground">
                已筛选 {filteredOrders.length} / {summary.orders.length} 条订单
              </span>
            )}
            {summary.excludedCount > 0 && (
              <span className="text-xs text-amber-600">
                已排除 {summary.excludedCount} 条订单（过滤规则）
              </span>
            )}
            {summary.excludedCount === 0 && (() => {
              const ac = getActiveConfig(platform);
              const hasRules = ac?.filterRules?.excludeStatusField || ac?.filterRules?.quantityOnlyStatusField;
              return hasRules ? (
                <span className="text-xs text-orange-500">
                  过滤规则已设置但未排除任何订单
                </span>
              ) : null;
            })()}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-6"
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? '隐藏诊断' : '诊断过滤'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 过滤诊断面板 */}
      {showDebug && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 pb-4">
            <h4 className="text-sm font-bold text-amber-800 mb-2">过滤规则诊断</h4>
            <div className="space-y-2 text-xs font-mono">
              {(() => {
                const activeConfig = getActiveConfig(platform);
                const platformOrders = rawOrders[platform] || [];
                const configs = savedConfigs[platform] || [];
                return (
                  <>
                    <div><strong>激活方案ID:</strong> {activeConfigId[platform]}</div>
                    <div><strong>激活方案名称:</strong> {activeConfig?.name}</div>
                    <div><strong>过滤规则:</strong> {JSON.stringify(activeConfig?.filterRules)}</div>
                    <div><strong>所有方案:</strong> {configs.map((c: SavedCalcConfig) => `${c.name}(${c.id})`).join(', ')}</div>
                    <div><strong>导入文件数:</strong> {platformOrders.length}</div>
                    {platformOrders.map((file: RawOrderData, idx: number) => {
                      const fileConfig = file.configId
                        ? configs.find((c: SavedCalcConfig) => c.id === file.configId)
                        : activeConfig;
                      const statusField = fileConfig?.filterRules?.excludeStatusField;
                      const statusValues: string[] = [];
                      if (statusField && file.rows) {
                        const seen = new Set<string>();
                        for (const row of file.rows) {
                          let val: string | number | undefined = row[statusField];
                          if (val === undefined || val === null) {
                            const trimmedKey = Object.keys(row).find(k => k.trim() === statusField);
                            val = trimmedKey ? row[trimmedKey] : undefined;
                          }
                          if (val !== undefined && val !== null) seen.add(String(val));
                        }
                        seen.forEach(v => statusValues.push(v));
                      }
                      return (
                        <div key={file.id} className="border-t border-amber-200 pt-2">
                          <div><strong>文件{idx + 1}:</strong> configId={file.configId}, shop={file.shopName}, rows={file.rows?.length}</div>
                          <div><strong>关联方案:</strong> {fileConfig?.name}({fileConfig?.id})</div>
                          <div><strong>关联方案过滤规则:</strong> {JSON.stringify(fileConfig?.filterRules)}</div>
                          <div><strong>行Key样本:</strong> {file.rows?.[0] ? Object.keys(file.rows[0]).slice(0, 8).join(', ') : '无'}</div>
                          {statusField && (
                            <div><strong>状态字段"{statusField}"的唯一值:</strong> {statusValues.length > 0 ? statusValues.map(v => `"${v}"`).join(', ') : '(无匹配值)'}</div>
                          )}
                        </div>
                      );
                    })}
                    <div className="border-t border-amber-200 pt-2">
                      <strong>统计结果:</strong> orders={summary.orders.length}, excludedCount={summary.excludedCount}, totalSales={summary.totalSales}
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              总销售额
            </div>
            <div className="text-lg font-bold font-mono">
              {formatCurrency(filteredTotalSales)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ShoppingCart className="h-3.5 w-3.5" />
              总单量
            </div>
            <div className="text-lg font-bold font-mono">
              {filteredTotalOrders}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Package className="h-3.5 w-3.5" />
              总商品数量
            </div>
            <div className="text-lg font-bold font-mono">
              {filteredTotalQuantity}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-xs mb-1" style={{ color: filteredTotalProfit >= 0 ? '#10b981' : '#ef4444' }}>
              {filteredTotalProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              总利润
            </div>
            <div className="text-lg font-bold font-mono" style={{ color: filteredTotalProfit >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(filteredTotalProfit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-sm">
          <span className="text-muted-foreground">扣除手续费后金额: </span>
          <span className="font-medium font-mono">{formatCurrency(filteredTotalNetAmount)}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">总平台手续费: </span>
          <span className="font-medium font-mono">{formatCurrency(filteredTotalPlatformFee)}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">总采购成本: </span>
          <span className="font-medium font-mono">{formatCurrency(filteredTotalPurchaseCost)}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">利润率: </span>
          <span className="font-medium font-mono" style={{ color: filteredTotalProfitRate >= 0 ? '#10b981' : '#ef4444' }}>
            {filteredTotalProfitRate.toFixed(1)}%
          </span>
        </div>
      </div>

      <Separator />

      {/* 视图切换 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'sku' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('sku')}
          >
            商品统计
          </Button>
          <Button
            variant={viewMode === 'orders' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('orders')}
          >
            订单明细
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const data = viewMode === 'sku'
              ? filteredSkuSummaries.map((s: SkuSummary) => ({
                  商品名称: s.productName,
                  店铺名称: s.shopName,
                  销量: s.totalQuantity,
                  总价: s.totalSales,
                  平均单价: s.avgUnitPrice,
                  采购单价: s.purchasePrice,
                  采购成本: s.totalPurchaseCost,
                  利润: s.totalProfit,
                  利润率: `${s.profitRate.toFixed(1)}%`,
                }))
              : filteredOrders.map((o: CalculatedOrder) => ({
                  订单号: o.orderNo,
                  SKU: o.sku,
                  商品名称: o.productName,
                  店铺名称: o.shopName || '-',
                  日期: o.orderDate || '-',
                  数量: o.quantity,
                  单价: o.unitPrice,
                  平台折扣: o.platformDiscount,
                  总价: o.totalAmount,
                  手续费: o.platformFee,
                  运费: o.shippingFee,
                  扣费后金额: o.netAmount,
                  采购单价: o.purchasePrice,
                  采购成本: o.purchaseCost,
                  利润: o.profit,
                  利润率: `${o.profitRate.toFixed(1)}%`,
                }));
            exportToExcel(data, `${platformConfig.name}_${viewMode === 'sku' ? '商品统计' : '订单明细'}`);
          }}
        >
          <Download className="h-4 w-4 mr-1.5" />
          导出
        </Button>
      </div>

      {/* 数据表格 */}
      {viewMode === 'sku' ? (
        <SkuSummaryTable summaries={filteredSkuSummaries} platform={platform} />
      ) : (
        <OrderDetailTable orders={filteredOrders} platform={platform} />
      )}
    </div>
  );
}

// 商品统计表格（按商品名称分类）
type SortField = 'totalQuantity' | 'totalSales' | 'totalProfit' | 'profitRate';
type SortDirection = 'asc' | 'desc';

function SkuSummaryTable({ summaries, platform }: { summaries: SkuSummary[]; platform: Platform }) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedSummaries = useMemo(() => {
    if (!sortField) return summaries;
    return [...summaries].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const diff = (aVal as number) - (bVal as number);
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [summaries, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 inline h-3 w-3 text-emerald-600" />
      : <ArrowDown className="ml-1 inline h-3 w-3 text-emerald-600" />;
  };

  const sortableCls = "cursor-pointer select-none hover:text-foreground transition-colors";

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品名称</TableHead>
                <TableHead className="w-[100px]">店铺名称</TableHead>
                <TableHead className={`w-[80px] text-right ${sortableCls}`} onClick={() => handleSort('totalQuantity')}>
                  销量<SortIcon field="totalQuantity" />
                </TableHead>
                <TableHead className={`w-[130px] text-right ${sortableCls}`} onClick={() => handleSort('totalSales')}>
                  总价<SortIcon field="totalSales" />
                </TableHead>
                <TableHead className="w-[110px] text-right">平均单价</TableHead>
                <TableHead className="w-[110px] text-right">采购单价</TableHead>
                <TableHead className="w-[120px] text-right">采购成本</TableHead>
                <TableHead className={`w-[120px] text-right ${sortableCls}`} onClick={() => handleSort('totalProfit')}>
                  利润<SortIcon field="totalProfit" />
                </TableHead>
                <TableHead className={`w-[80px] text-right ${sortableCls}`} onClick={() => handleSort('profitRate')}>
                  利润率<SortIcon field="profitRate" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSummaries.map((s) => (
                <TableRow key={`${s.productName}-${s.shopName}`}>
                  <TableCell className="font-medium">{s.productName || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.shopName || '-'}</TableCell>
                  <TableCell className="text-right font-mono">{s.totalQuantity}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.totalSales)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.avgUnitPrice)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.purchasePrice)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.totalPurchaseCost)}</TableCell>
                  <TableCell className="text-right font-mono" style={{ color: s.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatCurrency(s.totalProfit)}
                  </TableCell>
                  <TableCell className="text-right font-mono" style={{ color: platform === 'tiktok' && s.profitRate < 25 ? '#ef4444' : s.profitRate >= 0 ? '#10b981' : '#ef4444' }}>
                    {s.profitRate.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// 订单明细表格
function OrderDetailTable({ orders, platform }: { orders: CalculatedOrder[]; platform: Platform }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">订单号</TableHead>
                <TableHead className="w-[120px]">SKU</TableHead>
                <TableHead>商品名称</TableHead>
                <TableHead className="w-[100px]">店铺名称</TableHead>
                <TableHead className="w-[80px]">日期</TableHead>
                <TableHead className="w-[60px] text-right">数量</TableHead>
                <TableHead className="w-[100px] text-right">单价</TableHead>
                <TableHead className="w-[100px] text-right">平台折扣</TableHead>
                <TableHead className="w-[110px] text-right">总价</TableHead>
                <TableHead className="w-[100px] text-right">手续费</TableHead>
                <TableHead className="w-[80px] text-right">运费</TableHead>
                <TableHead className="w-[110px] text-right">扣费后金额</TableHead>
                <TableHead className="w-[100px] text-right">采购单价</TableHead>
                <TableHead className="w-[110px] text-right">采购成本</TableHead>
                <TableHead className="w-[100px] text-right">利润</TableHead>
                <TableHead className="w-[80px] text-right">利润率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.slice(0, 100).map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.orderNo}</TableCell>
                  <TableCell className="font-mono text-sm">{order.sku}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{order.productName || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{order.shopName || '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{order.orderDate || '-'}</TableCell>
                  <TableCell className="text-right font-mono">{order.quantity}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.unitPrice)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.platformDiscount)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.totalAmount)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.platformFee)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.shippingFee)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.netAmount)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.purchasePrice)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.purchaseCost)}</TableCell>
                  <TableCell className="text-right font-mono" style={{ color: order.profit >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatCurrency(order.profit)}
                  </TableCell>
                  <TableCell className="text-right font-mono" style={{ color: platform === 'tiktok' && order.profitRate < 25 ? '#ef4444' : order.profitRate >= 0 ? '#10b981' : '#ef4444' }}>
                    {order.profitRate.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {orders.length > 100 && (
            <div className="py-3 text-center text-sm text-muted-foreground">
              仅显示前 100 条，共 {orders.length} 条。请点击「导出」查看完整数据。
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// 平台主页面
export function PlatformPage({ platform }: { platform: Platform }) {
  const platformConfig = PLATFORM_CONFIG[platform];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: platformConfig.color }}
        >
          {platformConfig.icon}
        </div>
        <div>
          <h2 className="text-xl font-bold">{platformConfig.name}</h2>
          <p className="text-sm text-muted-foreground">管理 {platformConfig.name} 平台的订单数据与统计</p>
        </div>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import">
            <Upload className="h-4 w-4 mr-1.5" />
            数据导入
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings2 className="h-4 w-4 mr-1.5" />
            计算配置
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            统计结果
          </TabsTrigger>
        </TabsList>
        <TabsContent value="import">
          <PlatformDataImport platform={platform} />
        </TabsContent>
        <TabsContent value="config">
          <PlatformCalcConfig platform={platform} />
        </TabsContent>
        <TabsContent value="stats">
          <PlatformStats platform={platform} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
