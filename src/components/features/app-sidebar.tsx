'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PLATFORM_CONFIG } from '@/types';
import type { Platform } from '@/types';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Package, ChevronLeft, ChevronRight,
  Calculator, Store, LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  {
    title: '总览',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'SKU 映射',
    href: '/sku',
    icon: Package,
  },
  {
    title: '店铺名称明细',
    href: '/shops',
    icon: Store,
  },
];

const PLATFORM_ITEMS: Platform[] = ['shopee', 'lazada', 'tiktok'];

export function AppSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'h-screen bg-white border-r flex flex-col transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center border-b px-4 gap-2 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white shrink-0">
          <Calculator className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-sm font-bold truncate">电商做账统计</div>
            <div className="text-[10px] text-muted-foreground truncate">多平台数据管理</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {/* 常规导航 */}
        <div className={cn('mb-3', !collapsed && 'px-2')}>
          {!collapsed && <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">导航</div>}
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-slate-50',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}

        {/* 平台目录 */}
        <div className={cn('mt-6 mb-3', !collapsed && 'px-2')}>
          {!collapsed && <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">平台目录</div>}
        </div>
        {PLATFORM_ITEMS.map((platform) => {
          const config = PLATFORM_CONFIG[platform];
          const href = `/platform/${platform}`;
          const isActive = pathname === href;
          return (
            <Link
              key={platform}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-slate-50',
                collapsed && 'justify-center px-2'
              )}
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ backgroundColor: config.color }}
              >
                {config.icon}
              </div>
              {!collapsed && <span>{config.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout + Collapse button */}
      <div className="border-t p-2 space-y-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-slate-500 hover:text-red-600 hover:bg-red-50"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
