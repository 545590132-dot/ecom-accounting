'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/store';
import { parseExcelFile, downloadSkuTemplate, importSkuFromExcel } from '@/lib/excel';
import { formatCurrency, PLATFORM_CONFIG } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Plus, Trash2, Edit3, Search, Package, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { SkuMapping, Platform } from '@/types';

const PAGE_SIZE = 100;

export function SkuManager() {
  const skuMappings = useAppStore((s) => s.skuMappings);
  const addSkuMapping = useAppStore((s) => s.addSkuMapping);
  const updateSkuMapping = useAppStore((s) => s.updateSkuMapping);
  const deleteSkuMapping = useAppStore((s) => s.deleteSkuMapping);
  const clearSkuMappingsByPlatform = useAppStore((s) => s.clearSkuMappingsByPlatform);
  const importSkuMappings = useAppStore((s) => s.importSkuMappings);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SkuMapping>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('shopee');
  const [currentPage, setCurrentPage] = useState(1);
  const [newSku, setNewSku] = useState({ sku: '', productName: '', purchasePrice: 0, category: '', productOwner: '' });
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [perfMs, setPerfMs] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const platformMappings = useMemo(
    () => skuMappings.filter((m: SkuMapping) => m.platform === selectedPlatform),
    [skuMappings, selectedPlatform]
  );

  const filteredMappings = useMemo(
    () => platformMappings.filter(
      (m: SkuMapping) =>
        m.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.category && m.category.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [platformMappings, searchTerm]
  );

  const totalPages = Math.max(1, Math.ceil(filteredMappings.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedMappings = useMemo(
    () => filteredMappings.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE),
    [filteredMappings, safeCurrentPage]
  );

  const handlePlatformChange = useCallback((p: Platform) => {
    setSelectedPlatform(p);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { rows } = await parseExcelFile(file);
      const mappings = importSkuFromExcel(rows);
      if (mappings.length > 0) {
        importSkuMappings(mappings.map((m) => ({ ...m, platform: selectedPlatform })));
      }
    } catch (err) {
      console.error('导入失败:', err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [importSkuMappings, selectedPlatform]);

  const handleAdd = () => {
    if (!newSku.sku || !newSku.productName) return;
    addSkuMapping({ ...newSku, platform: selectedPlatform });
    setNewSku({ sku: '', productName: '', purchasePrice: 0, category: '', productOwner: '' });
    setDialogOpen(false);
  };

  const handleClearPlatform = useCallback(() => {
    if (clearing) return;
    setConfirmClear(true);
  }, [clearing]);

  const doClearPlatform = useCallback(() => {
    if (platformMappings.length === 0) return;
    const t0 = performance.now();
    setClearing(true);
    setConfirmClear(false);
    clearSkuMappingsByPlatform(selectedPlatform);
    setClearing(false);
    const elapsed = performance.now() - t0;
    setPerfMs(Math.round(elapsed * 10) / 10);
    console.log(`[PERF] clearPlatform: ${elapsed.toFixed(1)}ms`);
    setTimeout(() => setPerfMs(null), 3000);
  }, [platformMappings.length, selectedPlatform, clearSkuMappingsByPlatform]);

  const startEdit = (mapping: SkuMapping) => {
    setEditingId(mapping.id);
    setEditForm({ ...mapping });
  };

  const saveEdit = () => {
    if (editingId && editForm) {
      updateSkuMapping(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div className="space-y-6">
      {/* 操作栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(['shopee', 'lazada', 'tiktok'] as Platform[]).map((p) => {
              const pc = PLATFORM_CONFIG[p];
              return (
                <Button
                  key={p}
                  size="sm"
                  variant={selectedPlatform === p ? 'default' : 'outline'}
                  style={selectedPlatform === p ? { backgroundColor: pc.color, color: '#fff' } : {}}
                  onClick={() => handlePlatformChange(p)}
                >
                  {pc.name}
                </Button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 SKU / 商品名称 / 分类..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1.5" />
            导入 SKU
          </Button>
          <Button variant="outline" size="sm" onClick={downloadSkuTemplate}>
            <Download className="h-4 w-4 mr-1.5" />
            下载模板
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                新增 SKU
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增 SKU 映射</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>SKU 编码 *</Label>
                  <Input
                    placeholder="例如: SKU-001"
                    value={newSku.sku}
                    onChange={(e) => setNewSku({ ...newSku, sku: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>商品名称 *</Label>
                  <Input
                    placeholder="例如: 蓝牙耳机 Pro"
                    value={newSku.productName}
                    onChange={(e) => setNewSku({ ...newSku, productName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>采购单价</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newSku.purchasePrice || ''}
                    onChange={(e) => setNewSku({ ...newSku, purchasePrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>分类（可选）</Label>
                  <Input
                    placeholder="例如: 电子产品"
                    value={newSku.category}
                    onChange={(e) => setNewSku({ ...newSku, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>产品负责人（可选）</Label>
                  <Input
                    placeholder="例如: 张三"
                    value={newSku.productOwner}
                    onChange={(e) => setNewSku({ ...newSku, productOwner: e.target.value })}
                  />
                </div>
                <Button onClick={handleAdd} className="w-full" disabled={!newSku.sku || !newSku.productName}>
                  确认添加
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 格式参考提示 */}
      <Card className="border-dashed">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">导入格式参考：</span>
              表格需包含列头「SKU编码」「商品名称」「采购单价」「分类（可选）」「产品负责人（可选）」，
              可点击「下载模板」获取标准格式文件。导入时将自动匹配列头。
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据统计 */}
      <div className="flex gap-4 text-sm text-muted-foreground items-center">
        <span>共 <span className="font-medium text-foreground">{platformMappings.length}</span> 条 {PLATFORM_CONFIG[selectedPlatform].name} SKU 映射</span>
        {filteredMappings.length !== platformMappings.length && (
          <span>筛选显示 <span className="font-medium text-foreground">{filteredMappings.length}</span> 条</span>
        )}
        {platformMappings.length > 0 && (
          <>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-destructive hover:text-destructive"
            disabled={clearing}
            onClick={handleClearPlatform}
          >
            {clearing ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                正在清空...
              </>
            ) : (
              '清空当前平台'
            )}
          </Button>
          {perfMs !== null ? (
            <span className="text-xs text-muted-foreground ml-2">操作耗时: {perfMs}ms</span>
          ) : null}
          </>
        )}
        {confirmClear && (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-destructive font-medium">确认清空 {platformMappings.length} 条？</span>
            <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={doClearPlatform}>确认</Button>
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setConfirmClear(false)}>取消</Button>
          </span>
        )}
      </div>

      {/* SKU 表格 */}
      <Card>
        <CardContent className="p-0">
          {pagedMappings.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{platformMappings.length === 0 ? '暂无 SKU 映射数据' : '没有匹配的搜索结果'}</p>
              <p className="text-xs mt-1">
                {platformMappings.length === 0 ? `点击「导入 SKU」或「新增 SKU」添加 ${PLATFORM_CONFIG[selectedPlatform].name} 数据` : '尝试修改搜索条件'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">SKU 编码</TableHead>
                    <TableHead>商品名称</TableHead>
                    <TableHead className="w-[120px] text-right">采购单价</TableHead>
                    <TableHead className="w-[120px]">分类</TableHead>
                    <TableHead className="w-[120px]">产品负责人</TableHead>
                    <TableHead className="w-[100px] text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedMappings.map((mapping: SkuMapping) => (
                    <TableRow key={mapping.id}>
                      {editingId === mapping.id ? (
                        <>
                          <TableCell>
                            <Input
                              value={editForm.sku ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editForm.productName ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.purchasePrice ?? 0}
                              onChange={(e) => setEditForm({ ...editForm, purchasePrice: parseFloat(e.target.value) || 0 })}
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editForm.category ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editForm.productOwner ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, productOwner: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={saveEdit}>保存</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEdit}>取消</Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-mono text-sm">{mapping.sku}</TableCell>
                          <TableCell>{mapping.productName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(mapping.purchasePrice)}
                          </TableCell>
                          <TableCell>
                            {mapping.category ? (
                              <Badge variant="secondary" className="text-xs">{mapping.category}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {mapping.productOwner || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(mapping)}>
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { const t0 = performance.now(); console.log('[PERF-UI] deleteSkuMapping START id=' + mapping.id); deleteSkuMapping(mapping.id); console.log(`[PERF-UI] deleteSkuMapping store call took=${(performance.now()-t0).toFixed(1)}ms`); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {/* 分页控件 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                第 {safeCurrentPage}/{totalPages} 页，共 {filteredMappings.length} 条
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
