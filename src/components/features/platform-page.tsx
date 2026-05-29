'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/store';
import { parseExcelFile, downloadPlatformTemplate, exportToExcel } from '@/lib/excel';
import { formatCurrency, PLATFORM_CONFIG } from '@/types';
import type { Platform, RawOrderData, SkuSummary, PlatformSummary, CalculatedOrder } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  ShoppingCart, Info, AlertCircle,
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
        <div className="flex gap-2">
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
              你可以在「计算配置」标签页中选择各字段对应的列名。也可点击「下载导入模板」获取参考格式。
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

// 平台计算配置组件 — 核心改动：用下拉选择替代手动输入
function PlatformCalcConfig({ platform }: { platform: Platform }) {
  const { calculationConfigs, updateFieldMapping, updateFormula, availableHeaders, rawOrders, skuMappings } = useAppStore();
  const config = calculationConfigs[platform];
  const headers = availableHeaders[platform];
  const hasImportedData = rawOrders[platform].length > 0;
  const [editingFormula, setEditingFormula] = useState(false);

  const fieldLabels: Record<string, string> = {
    orderNo: '订单号',
    sku: 'SKU',
    quantity: '数量',
    unitPrice: '单价',
    totalAmount: '订单金额',
    platformFee: '平台手续费',
    shippingFee: '运费',
  };

  const formulaLabels: Record<string, string> = {
    netAmount: '扣除手续费后金额',
    profit: '单品利润',
  };

  const formulaDescriptions: Record<string, string> = {
    netAmount: '可使用变量: totalAmount, platformFee',
    profit: '可使用变量: netAmount, purchasePrice, quantity, shippingFee',
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

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            字段映射
          </CardTitle>
          <CardDescription>
            从导入表格的列头中选择对应的系统字段。「商品名称」由 SKU 映射库自动匹配，无需手动选择。
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
              {Object.entries(fieldLabels).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-sm font-medium">{label}</label>
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

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                计算公式
              </CardTitle>
              <CardDescription className="mt-1">
                定义平台手续费和利润的计算方式，基于映射后的字段进行运算。
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
            {Object.entries(formulaLabels).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">{label}</label>
                  <span className="text-xs text-muted-foreground">
                    {formulaDescriptions[key]}
                  </span>
                </div>
                {editingFormula ? (
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={config.formulas[key as keyof typeof config.formulas] ?? ''}
                    onChange={(e) =>
                      updateFormula(platform, key as keyof typeof config.formulas, e.target.value)
                    }
                    placeholder="输入计算表达式"
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
    </div>
  );
}

// 平台统计结果组件
function PlatformStats({ platform }: { platform: Platform }) {
  const { calculateSummary, calculateSkuSummaries } = useAppStore();
  const summary = calculateSummary(platform);
  const skuSummaries = calculateSkuSummaries(platform);
  const platformConfig = PLATFORM_CONFIG[platform];
  const [viewMode, setViewMode] = useState<'orders' | 'sku'>('sku');

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

  return (
    <div className="space-y-6">
      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              总销售额
            </div>
            <div className="text-lg font-bold font-mono">
              {formatCurrency(summary.totalSales)}
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
              {summary.totalOrders}
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
              {summary.totalQuantity}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-xs mb-1" style={{ color: summary.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
              {summary.totalProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              总利润
            </div>
            <div className="text-lg font-bold font-mono" style={{ color: summary.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
              {formatCurrency(summary.totalProfit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-sm">
          <span className="text-muted-foreground">扣除手续费后金额: </span>
          <span className="font-medium font-mono">{formatCurrency(summary.totalNetAmount)}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">总平台手续费: </span>
          <span className="font-medium font-mono">{formatCurrency(summary.totalPlatformFee)}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">总采购成本: </span>
          <span className="font-medium font-mono">{formatCurrency(summary.totalPurchaseCost)}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">利润率: </span>
          <span className="font-medium font-mono" style={{ color: summary.totalSales > 0 ? (summary.totalProfit / summary.totalSales * 100 >= 0 ? '#10b981' : '#ef4444') : 'inherit' }}>
            {summary.totalSales > 0 ? (summary.totalProfit / summary.totalSales * 100).toFixed(1) : '0.0'}%
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
              ? skuSummaries.map((s: SkuSummary) => ({
                  SKU: s.sku,
                  商品名称: s.productName,
                  采购单价: s.purchasePrice,
                  总销量: s.totalQuantity,
                  总销售额: s.totalSales,
                  总手续费: s.totalPlatformFee,
                  扣费后金额: s.totalNetAmount,
                  总采购成本: s.totalPurchaseCost,
                  总利润: s.totalProfit,
                  订单数: s.orderCount,
                }))
              : summary.orders.map((o: CalculatedOrder) => ({
                  订单号: o.orderNo,
                  SKU: o.sku,
                  商品名称: o.productName,
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
        <SkuSummaryTable summaries={skuSummaries} />
      ) : (
        <OrderDetailTable summary={summary} />
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
                <TableRow key={s.sku}>
                  <TableCell className="font-mono text-sm">{s.sku}</TableCell>
                  <TableCell>{s.productName || '-'}</TableCell>
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
function OrderDetailTable({ summary }: { summary: PlatformSummary }) {
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
              {summary.orders.slice(0, 100).map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.orderNo}</TableCell>
                  <TableCell className="font-mono text-sm">{order.sku}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{order.productName || '-'}</TableCell>
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
          {summary.orders.length > 100 && (
            <div className="py-3 text-center text-sm text-muted-foreground">
              仅显示前 100 条，共 {summary.orders.length} 条。请点击「导出」查看完整数据。
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
