'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/store';
import { parseExcelFile, downloadPlatformTemplate, exportToExcel } from '@/lib/excel';
import { formatCurrency, PLATFORM_CONFIG } from '@/types';
import type { Platform, RawOrderData, SkuSummary, PlatformSummary, CalculatedOrder, SavedCalcConfig } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
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
import {
  Upload, Download, Trash2, FileSpreadsheet, Settings2,
  BarChart3, Package, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Info, AlertCircle, Save, Plus, Pencil, Check, X, Store,
} from 'lucide-react';

// 平台数据导入组件
function PlatformDataImport({ platform }: { platform: Platform }) {
  const { rawOrders, importOrders, deleteOrderFile, clearOrders } = useAppStore();
  const platformOrders = rawOrders[platform];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const config = PLATFORM_CONFIG[platform];

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const { headers, rows } = await parseExcelFile(file);
      if (rows.length === 0) return;
      importOrders(platform, {
        platform,
        fileName: file.name,
        headers,
        rows,
      });
    } catch (err) {
      console.error('导入失败:', err);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [platform, importOrders]);

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
            onChange={handleImport}
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
                        {order.rows.length} 条记录 · {order.headers.length} 个字段 · {new Date(order.importTime).toLocaleString('zh-CN')}
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
    </div>
  );
}

// 平台计算配置组件 — 支持多配置方案存储
function PlatformCalcConfig({ platform }: { platform: Platform }) {
  const {
    savedConfigs, activeConfigId, getActiveConfig,
    updateFieldMapping, updateFieldAlias, updateFormula, updateConfigShopName, availableHeaders, rawOrders, skuMappings, shopNames,
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
  const fieldKeys = ['orderNo', 'sku', 'quantity', 'unitPrice', 'totalAmount', 'platformFee', 'shippingFee', 'orderDate'];

  // 获取字段别名（自定义名称），优先使用 fieldAliases，否则 fallback 到默认中文名
  const getFieldAlias = (key: string): string => {
    return config.fieldAliases?.[key] || key;
  };

  const formulaLabels: Record<string, string> = {
    netAmount: '扣除手续费后金额',
    profit: '单品利润',
  };

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
    // 系统计算字段
    vars.push({ key: 'purchasePrice', label: '采购单价', mapped: true });
    vars.push({ key: 'netAmount', label: formulaLabels.netAmount, mapped: true });
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
                      {c.shopName && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          <Store className="h-2.5 w-2.5 mr-0.5" />
                          {c.shopName}
                        </Badge>
                      )}
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
            从导入表格的列头中选择对应的系统字段。双击字段名称可自定义命名；「商品名称」由 SKU 映射库自动匹配，「店铺名称」从店铺名称明细中选择。
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
              {/* 店铺名称 — 从店铺名称明细中选择 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5 text-slate-400" />
                  店铺名称
                </label>
                {platformShopNames.length > 0 ? (
                  <Select
                    value={config.shopName || '__none__'}
                    onValueChange={(value) => updateConfigShopName(platform, value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择店铺..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">— 不指定 —</span>
                      </SelectItem>
                      {platformShopNames.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-9 items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-sm">
                    <Store className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-500 truncate">
                      暂无店铺名称，请先在「店铺名称明细」中配置
                    </span>
                  </div>
                )}
              </div>
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
                定义平台手续费和利润的计算方式。可用变量来源于字段映射中已映射的字段，点击变量按钮可插入到当前聚焦的公式中。
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
  const { calculateSummary, calculateSkuSummaries, shopNames } = useAppStore();
  const summary = calculateSummary(platform);
  const skuSummaries = calculateSkuSummaries(platform);
  const platformConfig = PLATFORM_CONFIG[platform];
  const [viewMode, setViewMode] = useState<'orders' | 'sku'>('sku');
  const [filterShop, setFilterShop] = useState<string>('__all__');
  const [filterYearMonth, setFilterYearMonth] = useState<string>('__all__');

  // 获取该平台下的店铺名称列表
  const platformShops = shopNames.filter((s) => s.platform === platform);

  // 从订单数据中提取可用的年月选项
  const availableYearMonths = Array.from(
    new Set(summary.orders.map((o) => o.orderDate).filter(Boolean))
  ).sort().reverse();

  // 筛选订单
  const filteredOrders = summary.orders.filter((o) => {
    if (filterShop !== '__all__' && o.shopName !== filterShop) return false;
    if (filterYearMonth !== '__all__' && o.orderDate !== filterYearMonth) return false;
    return true;
  });

  // 筛选后的 SKU 汇总
  const filteredSkuSummaries = (() => {
    const map = new Map<string, SkuSummary>();
    for (const order of filteredOrders) {
      const key = `${order.sku}|${order.shopName || '__all__'}`;
      if (!map.has(key)) {
        map.set(key, {
          sku: order.sku,
          productName: order.productName,
          shopName: order.shopName || '-',
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
      const s = map.get(key)!;
      s.totalQuantity += order.quantity;
      s.totalSales += order.totalAmount;
      s.totalPlatformFee += order.platformFee;
      s.totalNetAmount += order.netAmount;
      s.totalPurchaseCost += order.purchasePrice * order.quantity;
      s.totalProfit += order.profit;
      s.orderCount += 1;
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
  const isFiltering = filterShop !== '__all__' || filterYearMonth !== '__all__';

  return (
    <div className="space-y-6">
      {/* 筛选器 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">筛选：</span>
            </div>
            {/* 店铺名称筛选 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground shrink-0">店铺名称</label>
              <Select value={filterShop} onValueChange={setFilterShop}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue placeholder="全部店铺" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部店铺</SelectItem>
                  {platformShops.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                  {/* 也添加订单中实际出现但未在店铺列表中的名称 */}
                  {Array.from(new Set(summary.orders.map((o) => o.shopName).filter(Boolean)))
                    .filter((name) => !platformShops.some((s) => s.name === name))
                    .map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
                onClick={() => { setFilterShop('__all__'); setFilterYearMonth('__all__'); }}
              >
                重置筛选
              </Button>
            )}
            {isFiltering && (
              <span className="text-xs text-muted-foreground">
                已筛选 {filteredOrders.length} / {summary.orders.length} 条订单
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" />
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
          <span className="font-medium font-mono" style={{ color: filteredTotalSales > 0 ? (filteredTotalProfit / filteredTotalSales * 100 >= 0 ? '#10b981' : '#ef4444') : 'inherit' }}>
            {filteredTotalSales > 0 ? (filteredTotalProfit / filteredTotalSales * 100).toFixed(1) : '0.0'}%
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
            SKU 汇总
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
                  SKU: s.sku,
                  商品名称: s.productName,
                  店铺名称: s.shopName,
                  采购单价: s.purchasePrice,
                  总销量: s.totalQuantity,
                  总销售额: s.totalSales,
                  总手续费: s.totalPlatformFee,
                  扣费后金额: s.totalNetAmount,
                  总采购成本: s.totalPurchaseCost,
                  总利润: s.totalProfit,
                  订单数: s.orderCount,
                }))
              : filteredOrders.map((o: CalculatedOrder) => ({
                  订单号: o.orderNo,
                  SKU: o.sku,
                  商品名称: o.productName,
                  店铺名称: o.shopName || '-',
                  日期: o.orderDate || '-',
                  数量: o.quantity,
                  单价: o.unitPrice,
                  订单金额: o.totalAmount,
                  手续费: o.platformFee,
                  运费: o.shippingFee,
                  扣费后金额: o.netAmount,
                  采购单价: o.purchasePrice,
                  利润: o.profit,
                }));
            exportToExcel(data, `${platformConfig.name}_${viewMode === 'sku' ? 'SKU汇总' : '订单明细'}`);
          }}
        >
          <Download className="h-4 w-4 mr-1.5" />
          导出
        </Button>
      </div>

      {/* 数据表格 */}
      {viewMode === 'sku' ? (
        <SkuSummaryTable summaries={filteredSkuSummaries} />
      ) : (
        <OrderDetailTable orders={filteredOrders} />
      )}
    </div>
  );
}

// SKU 汇总表格
function SkuSummaryTable({ summaries }: { summaries: SkuSummary[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">SKU</TableHead>
                <TableHead>商品名称</TableHead>
                <TableHead className="w-[120px]">店铺名称</TableHead>
                <TableHead className="w-[100px] text-right">采购单价</TableHead>
                <TableHead className="w-[80px] text-right">销量</TableHead>
                <TableHead className="w-[120px] text-right">销售额</TableHead>
                <TableHead className="w-[120px] text-right">手续费</TableHead>
                <TableHead className="w-[120px] text-right">扣费后金额</TableHead>
                <TableHead className="w-[120px] text-right">采购成本</TableHead>
                <TableHead className="w-[120px] text-right">利润</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((s) => (
                <TableRow key={`${s.sku}-${s.shopName}`}>
                  <TableCell className="font-mono text-sm">{s.sku}</TableCell>
                  <TableCell>{s.productName || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.shopName || '-'}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.purchasePrice)}</TableCell>
                  <TableCell className="text-right font-mono">{s.totalQuantity}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.totalSales)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.totalPlatformFee)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.totalNetAmount)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.totalPurchaseCost)}</TableCell>
                  <TableCell className="text-right font-mono" style={{ color: s.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatCurrency(s.totalProfit)}
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
function OrderDetailTable({ orders }: { orders: CalculatedOrder[] }) {
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
                <TableHead className="w-[110px] text-right">订单金额</TableHead>
                <TableHead className="w-[100px] text-right">手续费</TableHead>
                <TableHead className="w-[80px] text-right">运费</TableHead>
                <TableHead className="w-[110px] text-right">扣费后金额</TableHead>
                <TableHead className="w-[100px] text-right">采购单价</TableHead>
                <TableHead className="w-[100px] text-right">利润</TableHead>
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
                  <TableCell className="text-right font-mono">{formatCurrency(order.totalAmount)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.platformFee)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.shippingFee)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.netAmount)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(order.purchasePrice)}</TableCell>
                  <TableCell className="text-right font-mono" style={{ color: order.profit >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatCurrency(order.profit)}
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
