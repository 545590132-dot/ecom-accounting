'use client';

import React from 'react';
import { useAppStore } from '@/store';
import { formatCurrency, PLATFORM_CONFIG } from '@/types';
import type { Platform, PlatformSummary } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ShoppingCart, Package, TrendingUp, TrendingDown,
  BarChart3,
} from 'lucide-react';

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

export function DashboardOverview() {
  const { calculateAllSummaries, skuMappings } = useAppStore();
  const summaries = calculateAllSummaries();
  const platforms: Platform[] = ['shopee', 'lazada', 'tiktok'];

  const totalSales = platforms.reduce((s, p) => s + summaries[p].totalSales, 0);
  const totalOrders = platforms.reduce((s, p) => s + summaries[p].totalOrders, 0);
  const totalQuantity = platforms.reduce((s, p) => s + summaries[p].totalQuantity, 0);
  const totalProfit = platforms.reduce((s, p) => s + summaries[p].totalProfit, 0);
  const totalProfitRate = totalSales > 0 ? totalProfit / totalSales * 100 : 0;
  const totalPlatformFee = platforms.reduce((s, p) => s + summaries[p].totalPlatformFee, 0);
  const totalNetAmount = platforms.reduce((s, p) => s + summaries[p].totalNetAmount, 0);
  const hasAnyData = platforms.some((p) => summaries[p].orders.length > 0);

  return (
    <div className="space-y-8">
      {/* 全局汇总 */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          全店总览
        </h2>
        {hasAnyData ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
              title="总手续费"
              value={formatCurrency(totalPlatformFee)}
              icon={TrendingDown}
              color="#ef4444"
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

      {/* 各平台概览 */}
      <div>
        <h2 className="text-lg font-bold mb-4">各平台概况</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {platforms.map((p) => (
            <PlatformOverviewCard key={p} platform={p} summary={summaries[p]} />
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
