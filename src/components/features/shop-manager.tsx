'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { PLATFORM_CONFIG } from '@/types';
import type { Platform } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Store, Plus, Trash2, Pencil, Check, X, Building2,
} from 'lucide-react';

const PLATFORMS: Platform[] = ['shopee', 'lazada', 'tiktok'];

export function ShopManager() {
  const {
    shopNames, addShopNamesBatch, deleteShopName, updateShopName, clearShopNames,
  } = useAppStore();

  const [activePlatform, setActivePlatform] = useState<Platform>('shopee');
  const [singleInput, setSingleInput] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const currentShops = shopNames.filter((s) => s.platform === activePlatform);
  const platformConfig = PLATFORM_CONFIG[activePlatform];

  // 批量添加（用 '、' 分隔）
  const handleBatchAdd = () => {
    const names = batchInput
      .split('、')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;
    addShopNamesBatch(activePlatform, names);
    setBatchInput('');
  };

  // 单个添加
  const handleSingleAdd = () => {
    const name = singleInput.trim();
    if (!name) return;
    addShopNamesBatch(activePlatform, [name]);
    setSingleInput('');
  };

  // 开始编辑
  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  };

  // 确认编辑
  const handleConfirmEdit = () => {
    if (editingId && editValue.trim()) {
      updateShopName(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-white">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold">店铺名称明细</h2>
          <p className="text-sm text-muted-foreground">管理各平台下的店铺名称，支持批量添加</p>
        </div>
      </div>

      {/* 平台切换 */}
      <div className="flex gap-2">
        {PLATFORMS.map((p) => {
          const cfg = PLATFORM_CONFIG[p];
          const count = shopNames.filter((s) => s.platform === p).length;
          return (
            <Button
              key={p}
              variant={activePlatform === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActivePlatform(p)}
              className="gap-1.5"
            >
              <div
                className="w-4 h-4 rounded flex items-center justify-center text-white text-[8px] font-bold"
                style={{ backgroundColor: cfg.color }}
              >
                {cfg.icon}
              </div>
              {cfg.name}
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{count}</Badge>
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 添加店铺 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              添加店铺
              <Badge variant="outline" className="text-xs font-normal" style={{ color: platformConfig.color }}>
                {platformConfig.name}
              </Badge>
            </CardTitle>
            <CardDescription>
              添加店铺名称到当前平台。支持单个添加或批量添加（用「、」分隔多个名称）。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 单个添加 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">单个添加</label>
              <div className="flex gap-2">
                <Input
                  value={singleInput}
                  onChange={(e) => setSingleInput(e.target.value)}
                  placeholder="输入店铺名称"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSingleAdd();
                  }}
                />
                <Button onClick={handleSingleAdd} disabled={!singleInput.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加
                </Button>
              </div>
            </div>

            <Separator />

            {/* 批量添加 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">批量添加</label>
              <p className="text-xs text-muted-foreground">
                输入多个店铺名称，用「、」符号分隔。例如：店铺A、店铺B、店铺C
              </p>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder="店铺A、店铺B、店铺C"
              />
              <Button
                onClick={handleBatchAdd}
                disabled={!batchInput.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                批量添加
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 店铺列表 */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  店铺列表
                  <Badge variant="outline" className="text-xs font-normal" style={{ color: platformConfig.color }}>
                    {platformConfig.name}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  当前平台已添加 {currentShops.length} 个店铺
                </CardDescription>
              </div>
              {currentShops.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => clearShopNames(activePlatform)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  清空
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {currentShops.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <Store className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>暂无店铺名称</p>
                <p className="text-xs mt-1">请在左侧添加店铺名称</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>店铺名称</TableHead>
                    <TableHead className="w-[100px]">添加时间</TableHead>
                    <TableHead className="w-[80px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentShops.map((shop, index) => (
                    <TableRow key={shop.id}>
                      <TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>
                      <TableCell>
                        {editingId === shop.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleConfirmEdit}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCancelEdit}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="font-medium">{shop.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(shop.createdAt).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleStartEdit(shop.id, shop.name)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteShopName(shop.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 全平台店铺概览 */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            全平台店铺概览
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shopNames.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              尚未添加任何店铺名称
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLATFORMS.map((p) => {
                const cfg = PLATFORM_CONFIG[p];
                const shops = shopNames.filter((s) => s.platform === p);
                return (
                  <div key={p} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-white text-[8px] font-bold"
                        style={{ backgroundColor: cfg.color }}
                      >
                        {cfg.icon}
                      </div>
                      <span className="font-medium text-sm">{cfg.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{shops.length} 个店铺</Badge>
                    </div>
                    {shops.length === 0 ? (
                      <p className="text-xs text-muted-foreground">暂无店铺</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {shops.map((s) => (
                          <Badge key={s.id} variant="outline" className="text-xs">
                            {s.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
