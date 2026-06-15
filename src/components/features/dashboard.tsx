'use client';

import React, { lazy, Suspense } from 'react';
import { useAppStore } from '@/store';
import { formatCurrency, PLATFORM_CONFIG } from '@/types';
import type { Platform, PlatformSummary, CalculatedOrder } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ShoppingCart, Package, TrendingUp, TrendingDown,
  BarChart3, Calendar, Users,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts';

function YuanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l6 8M18 3l-6 8" />
      <path d="M6 21h12" />
      <path d="M6 15h12" />
      <path d="M8 15v6M16 15v6" />
    </svg>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color?: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </div>
        <div className="text-2xl font-bold font-mono" style={color ? { color } : undefined}>
          {value}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

function PlatformOverviewCard({
  platform,
  summary,
}: {
  platform: Platform;
  summary: PlatformSummary;
}) {
  const config = PLATFORM_CONFIG[platform];
  const hasData = summary.orders.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3" style={{ borderBottom: `2px solid ${config.color}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: config.color }}
            >
              {config.icon}
            </div>
            <CardTitle className="text-base">{config.name}</CardTitle>
          </div>
          {hasData && (
            <span className="text-xs text-muted-foreground">
              {summary.orders.length} 条订单
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {!hasData ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            暂无数据，请先导入订单表格
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground">销售额</div>
              <div className="font-bold font-mono text-sm">{formatCurrency(summary.totalSales)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">订单数</div>
              <div className="font-bold font-mono text-sm">{summary.totalOrders}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">商品数量</div>
              <div className="font-bold font-mono text-sm">{summary.totalQuantity}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">利润</div>
              <div
                className="font-bold font-mono text-sm"
                style={{ color: summary.totalProfit >= 0 ? '#10b981' : '#ef4444' }}
              >
                {formatCurrency(summary.totalProfit)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 从订单列表中提取所有年份和月份
function extractYearMonths(orders: CalculatedOrder[]): { years: string[]; months: string[] } {
  const yearSet = new Set<string>();
  const monthSet = new Set<string>();
  for (const o of orders) {
    if (o.orderDate) {
      const parts = o.orderDate.split('-');
      if (parts.length >= 1) yearSet.add(parts[0]);
      if (parts.length >= 2) monthSet.add(o.orderDate);
    }
  }
  const years = Array.from(yearSet).sort();
  const months = Array.from(monthSet).sort();
  return { years, months };
}

// 按日期筛选订单
function filterOrdersByDate(orders: CalculatedOrder[], yearFilter: string, monthFilter: string): CalculatedOrder[] {
  return orders.filter((o) => {
    if (!o.orderDate) return false;
    if (yearFilter && !o.orderDate.startsWith(yearFilter)) return false;
    if (monthFilter) {
      // 如果有年份筛选，月份必须完全匹配 (YYYY-MM)
      // 如果没有年份筛选，只匹配月份部分
      if (yearFilter) {
        if (o.orderDate !== monthFilter) return false;
      } else {
        const orderMonth = o.orderDate.split('-')[1];
        const filterMonth = monthFilter.split('-')[1];
        if (orderMonth !== filterMonth) return false;
      }
    }
    return true;
  });
}

// 从筛选后的订单计算平台汇总
function computeSummaryFromOrders(orders: CalculatedOrder[], platform: Platform): PlatformSummary {
  const totalSales = orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalOrders = new Set(orders.map((o) => o.orderNo)).size;
  const totalQuantity = orders.reduce((s, o) => s + o.quantity, 0);
  const totalPlatformFee = orders.reduce((s, o) => s + o.platformFee, 0);
  const totalNetAmount = orders.reduce((s, o) => s + o.netAmount, 0);
  const totalPurchaseCost = orders.reduce((s, o) => s + o.purchaseCost, 0);
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
    excludedCount: 0,
    orders,
  };
}

// 生成月度各平台销售额柱状图数据
function buildMonthlyChartData(
  allOrders: Record<Platform, CalculatedOrder[]>,
  yearFilter: string
): { month: string; Shopee: number; Lazada: number; TikTok: number }[] {
  const platforms: Platform[] = ['shopee', 'lazada', 'tiktok'];
  const platformNames: Record<Platform, string> = { shopee: 'Shopee', lazada: 'Lazada', tiktok: 'TikTok' };

  // 收集该年份下的所有月份
  const monthSet = new Set<string>();
  for (const p of platforms) {
    for (const o of allOrders[p]) {
      if (o.orderDate && (!yearFilter || o.orderDate.startsWith(yearFilter))) {
        monthSet.add(o.orderDate);
      }
    }
  }
  const sortedMonths = Array.from(monthSet).sort();

  return sortedMonths.map((month) => {
    const entry: Record<string, string | number> = {
      month,
      Shopee: 0,
      Lazada: 0,
      TikTok: 0,
    };
    for (const p of platforms) {
      const name = platformNames[p];
      for (const o of allOrders[p]) {
        if (o.orderDate === month) {
          entry[name] = (entry[name] as number) + o.totalAmount;
        }
      }
    }
    // 保留两位小数
    entry.Shopee = Math.round((entry.Shopee as number) * 100) / 100;
    entry.Lazada = Math.round((entry.Lazada as number) * 100) / 100;
    entry.TikTok = Math.round((entry.TikTok as number) * 100) / 100;
    return entry as { month: string; Shopee: number; Lazada: number; TikTok: number };
  });
}

// 自定义 Tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="font-semibold mb-1 text-slate-700">{label}</div>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: item.color }} />
          <span className="text-slate-600">{item.name}:</span>
          <span className="font-mono font-medium">{formatCurrency(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardOverview() {
  const skuMappings = useAppStore((s) => s.skuMappings);
  const rawOrders = useAppStore((s) => s.rawOrders);
  const savedConfigs = useAppStore((s) => s.savedConfigs);
  const activeConfigId = useAppStore((s) => s.activeConfigId);
  const calculateAllSummaries = useAppStore((s) => s.calculateAllSummaries);
  const inventoryRecords = useAppStore((s) => s.inventoryRecords);
  const inventoryFiles = useAppStore((s) => s.inventoryFiles);

  const summaries = React.useMemo(() => calculateAllSummaries(), [rawOrders, savedConfigs, activeConfigId, skuMappings]);
  const platforms: Platform[] = ['shopee', 'lazada', 'tiktok'];

  // 收集所有订单
  const allOrders = React.useMemo(() => {
    const result: Record<Platform, CalculatedOrder[]> = {
      shopee: [],
      lazada: [],
      tiktok: [],
    };
    for (const p of platforms) {
      result[p] = summaries[p].orders;
    }
    return result;
  }, [summaries]);

  const allOrdersFlat = React.useMemo(
    () => platforms.flatMap((p) => allOrders[p]),
    [allOrders]
  );

  // 提取年份和月份
  const { years, months } = React.useMemo(() => extractYearMonths(allOrdersFlat), [allOrdersFlat]);

  // 筛选状态
  const [yearFilter, setYearFilter] = React.useState<string>('');
  const [monthFilter, setMonthFilter] = React.useState<string>('');

  // 年份变化时：如果月份不在新年份范围内则重置
  const handleYearChange = (year: string) => {
    setYearFilter(year);
    if (monthFilter && !monthFilter.startsWith(year)) {
      setMonthFilter('');
    }
  };

  // 根据年份筛选可选月份
  const availableMonths = React.useMemo(() => {
    if (!yearFilter) return months;
    return months.filter((m) => m.startsWith(yearFilter));
  }, [months, yearFilter]);

  // 筛选后的各平台订单
  const filteredOrders = React.useMemo(() => {
    const result: Record<Platform, CalculatedOrder[]> = { shopee: [], lazada: [], tiktok: [] };
    for (const p of platforms) {
      result[p] = filterOrdersByDate(allOrders[p], yearFilter, monthFilter);
    }
    return result;
  }, [allOrders, yearFilter, monthFilter]);

  // 筛选后的各平台汇总
  const filteredSummaries = React.useMemo(() => {
    const result: Record<Platform, PlatformSummary> = { shopee: {} as PlatformSummary, lazada: {} as PlatformSummary, tiktok: {} as PlatformSummary };
    for (const p of platforms) {
      result[p] = computeSummaryFromOrders(filteredOrders[p], p);
    }
    return result;
  }, [filteredOrders]);

  // 全局汇总
  const totalSales = platforms.reduce((s, p) => s + filteredSummaries[p].totalSales, 0);
  const totalOrders = platforms.reduce((s, p) => s + filteredSummaries[p].totalOrders, 0);
  const totalQuantity = platforms.reduce((s, p) => s + filteredSummaries[p].totalQuantity, 0);
  const totalProfit = platforms.reduce((s, p) => s + filteredSummaries[p].totalProfit, 0);
  const totalProfitRate = totalSales > 0 ? totalProfit / totalSales * 100 : 0;
  const totalNetAmount = platforms.reduce((s, p) => s + filteredSummaries[p].totalNetAmount, 0);
  const hasAnyData = allOrdersFlat.length > 0;

  // 柱状图数据（按年份展示月度各平台销售额）
  const chartYear = yearFilter || (years.length > 0 ? years[years.length - 1] : '');
  const chartData = React.useMemo(
    () => buildMonthlyChartData(allOrders, chartYear),
    [allOrders, chartYear]
  );

  // 运营人产品维护情况图表数据
  const ownerProductData = React.useMemo(() => {
    if (inventoryRecords.length === 0) return [];

    // SKU 映射: sku (lowercase, no spaces) -> productOwner
    const skuOwnerMap = new Map<string, string>();
    for (const m of skuMappings) {
      const key = m.sku.toLowerCase().replace(/\s+/g, '');
      if (m.productOwner && !skuOwnerMap.has(key)) {
        skuOwnerMap.set(key, m.productOwner);
      }
    }

    // 按产品负责人统计
    const ownerStats = new Map<string, { hot: number; normal: number; slow: number; clearance: number; total: number }>();

    for (const rec of inventoryRecords) {
      const key = rec.sku.toLowerCase().replace(/\s+/g, '');
      const owner = skuOwnerMap.get(key) || '未分配';

      if (!ownerStats.has(owner)) {
        ownerStats.set(owner, { hot: 0, normal: 0, slow: 0, clearance: 0, total: 0 });
      }
      const stats = ownerStats.get(owner)!;
      stats.total++;

      // 判断显示销售状态
      let displayStatus = '';
      if (rec.salesStatus === '清货') {
        displayStatus = '清货';
      } else {
        // 系统判定逻辑: 需要月销量数据
        // 从当前记录找月销量 = 当前月库存 - 上月库存
        const ym = rec.yearMonth;
        const prevYm = (() => {
          const [y, m] = ym.split('-').map(Number);
          const pm = m - 1;
          if (pm === 0) return `${y - 1}-12`;
          return `${y}-${String(pm).padStart(2, '0')}`;
        })();
        const prevRec = inventoryRecords.find(r => r.sku === rec.sku && r.yearMonth === prevYm);
        const prevStock = prevRec ? Number(prevRec.stockQty) : 0;
        const currentStock = Number(rec.stockQty);
        const monthlySales = prevStock - currentStock; // 上月库存 - 当前库存 = 月销量(正数表示消耗)

        if (monthlySales >= 500) {
          displayStatus = '热销';
        } else {
          const estimatedMonths = monthlySales > 0 ? currentStock / monthlySales : Infinity;
          if (estimatedMonths <= 6) {
            displayStatus = '正常';
          } else {
            displayStatus = '平销';
          }
        }
      }

      if (displayStatus === '热销') stats.hot++;
      else if (displayStatus === '正常') stats.normal++;
      else if (displayStatus === '平销') stats.slow++;
      else if (displayStatus === '清货') stats.clearance++;
    }

    // 转换为数组并按总产品数降序排列
    return Array.from(ownerStats.entries())
      .map(([owner, stats]) => ({
        name: owner,
        热销: stats.hot,
        正常: stats.normal,
        平销: stats.slow,
        清货: stats.clearance,
        总产品数: stats.total,
      }))
      .sort((a, b) => b.总产品数 - a.总产品数);
  }, [inventoryRecords, skuMappings]);

  const hasInventoryData = inventoryRecords.length > 0 && ownerProductData.length > 0;

  return (
    <div className="space-y-8">
      {/* 全局汇总 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            全店总览
          </h2>
          {/* 年份/月份筛选 */}
          {hasAnyData && (
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <select
                value={yearFilter}
                onChange={(e) => handleYearChange(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">全部年份</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">全部月份</option>
                {availableMonths.map((m) => {
                  const parts = m.split('-');
                  return (
                    <option key={m} value={m}>{parts[0]}年{parseInt(parts[1])}月</option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
        {hasAnyData ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              title="总销售额"
              value={formatCurrency(totalSales)}
              icon={YuanIcon}
            />
            <StatCard
              title="总订单数"
              value={String(totalOrders)}
              icon={ShoppingCart}
            />
            <StatCard
              title="总商品数量"
              value={String(totalQuantity)}
              icon={Package}
            />
            <StatCard
              title="扣费后金额"
              value={formatCurrency(totalNetAmount)}
              icon={YuanIcon}
            />
            <StatCard
              title="总利润"
              value={formatCurrency(totalProfit)}
              icon={totalProfit >= 0 ? TrendingUp : TrendingDown}
              color={totalProfit >= 0 ? '#10b981' : '#ef4444'}
              subtitle={`利润率 ${totalProfitRate.toFixed(1)}%`}
            />
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>暂无数据</p>
              <p className="text-xs mt-1">请先在各平台页面导入订单数据，此处将自动汇总统计</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* 月度各平台销售额柱状图 */}
      {hasAnyData && chartData.length > 0 && (
        <>
          <div>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {chartYear ? `${chartYear}年` : ''}每月各平台销售额
            </h2>
            <Card>
              <CardContent className="pt-6 pb-4">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} margin={{ top: 30, right: 20, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickFormatter={(v: string) => {
                        const parts = v.split('-');
                        return parts.length >= 2 ? `${parseInt(parts[1])}月` : v;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v: number) => {
                        if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
                        if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
                        return String(v);
                      }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      iconSize={10}
                      formatter={(value: string) => <span className="text-sm font-medium text-slate-700">{value}</span>}
                    />
                    <Bar dataKey="Shopee" fill="#ee4d2d" radius={[2, 2, 0, 0]} maxBarSize={40} name="Shopee">
                      <LabelList dataKey="Shopee" position="top" style={{ fontSize: 10, fill: '#64748b' }} formatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)} />
                    </Bar>
                    <Bar dataKey="Lazada" fill="#0f146d" radius={[2, 2, 0, 0]} maxBarSize={40} name="Lazada">
                      <LabelList dataKey="Lazada" position="top" style={{ fontSize: 10, fill: '#64748b' }} formatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)} />
                    </Bar>
                    <Bar dataKey="TikTok" fill="#fe2c55" radius={[2, 2, 0, 0]} maxBarSize={40} name="TikTok">
                      <LabelList dataKey="TikTok" position="top" style={{ fontSize: 10, fill: '#64748b' }} formatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <Separator />
        </>
      )}

      {/* 运营人产品维护情况图表 */}
      {hasInventoryData && (
        <>
          <div>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              运营人产品维护情况
            </h2>
            <Card>
              <CardContent className="pt-6 pb-4">
                <ResponsiveContainer width="100%" height={Math.max(200, ownerProductData.length * 50 + 60)}>
                  <BarChart data={ownerProductData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#1e293b' }} width={70} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      iconSize={10}
                      formatter={(value: string) => <span className="text-sm font-medium text-slate-700">{value}</span>}
                    />
                    <Bar dataKey="热销" fill="#ef4444" radius={[0, 2, 2, 0]} maxBarSize={20} stackId="status" name="热销" />
                    <Bar dataKey="正常" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={20} stackId="status" name="正常" />
                    <Bar dataKey="平销" fill="#f59e0b" radius={[0, 0, 0, 0]} maxBarSize={20} stackId="status" name="平销" />
                    <Bar dataKey="清货" fill="#6366f1" radius={[0, 2, 2, 0]} maxBarSize={20} stackId="status" name="清货" />
                    <Bar dataKey="总产品数" fill="#94a3b8" radius={[0, 2, 2, 0]} maxBarSize={20} name="总产品数" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <Separator />
        </>
      )}

      {/* 各平台概览 */}
      <div>
        <h2 className="text-lg font-bold mb-4">各平台概况</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {platforms.map((p) => (
            <PlatformOverviewCard key={p} platform={p} summary={filteredSummaries[p]} />
          ))}
        </div>
      </div>

      <Separator />

      {/* SKU 映射状态 */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          SKU 映射库状态
        </h2>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold font-mono">{skuMappings.length}</div>
                <div className="text-sm text-muted-foreground">已录入 SKU 映射</div>
              </div>
              {skuMappings.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  尚未配置 SKU 映射，利润计算将无法获取采购成本
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
