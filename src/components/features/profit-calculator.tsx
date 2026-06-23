'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '@/store';
import type { Platform, PlatformCalcSettings, CalculatorSettings } from '@/types';
import { DEFAULT_SHOPEE_SETTINGS, DEFAULT_LAZADA_SETTINGS, DEFAULT_TIKTOK_SETTINGS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Settings, Info } from 'lucide-react';

const PLATFORM_LABELS: Record<Platform, string> = {
  shopee: 'Shopee',
  lazada: 'Lazada',
  tiktok: 'TikTok',
};

const DEFAULT_SETTINGS: Record<Platform, PlatformCalcSettings> = {
  shopee: DEFAULT_SHOPEE_SETTINGS,
  lazada: DEFAULT_LAZADA_SETTINGS,
  tiktok: DEFAULT_TIKTOK_SETTINGS,
};

function getSettingsForPlatform(allSettings: CalculatorSettings[], platform: Platform): PlatformCalcSettings {
  const found = allSettings.find((s) => s.platform === platform);
  return found?.settings || DEFAULT_SETTINGS[platform];
}

// 从SKU编码中提取数字部分用于匹配
function extractDigits(sku: string): string {
  return sku.replace(/[^0-9]/g, '');
}

export function ProfitCalculator() {
  const { skuMappings, calculatorSettings, updateCalculatorSetting } = useAppStore();
  const [platform, setPlatform] = useState<Platform>('shopee');
  const [priceMYR, setPriceMYR] = useState<string>('');
  const [skuInput, setSkuInput] = useState<string>('');
  const [campaignMode, setCampaignMode] = useState<'normal' | 'promo'>('normal');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 当前平台的配置
  const settings = useMemo(
    () => getSettingsForPlatform(calculatorSettings, platform),
    [calculatorSettings, platform]
  );

  // 采购成本自动匹配
  const matchedPurchasePrice = useMemo(() => {
    if (!skuInput.trim()) return null;
    const inputDigits = extractDigits(skuInput.trim());
    if (!inputDigits) {
      // 纯英文输入，精确匹配SKU
      const match = skuMappings.find(
        (m) => m.sku.toLowerCase().replace(/\s/g, '') === skuInput.trim().toLowerCase().replace(/\s/g, '') && m.platform === platform
      );
      return match?.purchasePrice ?? null;
    }
    // 数字匹配：SKU编码中的数字部分包含输入的数字
    const match = skuMappings.find((m) => {
      const skuDigits = extractDigits(m.sku);
      return skuDigits.includes(inputDigits) && m.platform === platform;
    });
    return match?.purchasePrice ?? null;
  }, [skuInput, skuMappings, platform]);

  // 计算各项金额
  const calcResult = useMemo(() => {
    const price = parseFloat(priceMYR) || 0;
    const rate = settings.exchangeRate || 1.7;
    const purchaseCNY = matchedPurchasePrice ?? 0;
    const purchaseMYR = purchaseCNY / rate;
    const overseasCNY = settings.overseasFee;
    const overseasMYR = overseasCNY / rate;
    const commissionMYR = price * (settings.commissionRate / 100);
    const commissionCNY = commissionMYR * rate;
    const savingsMYR = settings.savingsFee;
    const savingsCNY = savingsMYR * rate;
    const fixedFeeMYR = settings.fixedServiceFee;
    const fixedFeeCNY = fixedFeeMYR * rate;
    const campaignRate = campaignMode === 'normal' ? settings.campaignRateNormal : settings.campaignRatePromo;
    const campaignMYR = price * (campaignRate / 100);
    const campaignCNY = campaignMYR * rate;
    const transactionMYR = price * (settings.transactionRate / 100);
    const transactionCNY = transactionMYR * rate;
    const profitMYR = price - purchaseMYR - overseasMYR - commissionMYR - savingsMYR - fixedFeeMYR - campaignMYR - transactionMYR;
    const profitCNY = profitMYR * rate;

    return {
      price, priceMYR: price, priceCNY: price * rate,
      purchaseMYR, purchaseCNY,
      overseasMYR, overseasCNY,
      commissionMYR, commissionCNY,
      savingsMYR, savingsCNY,
      fixedFeeMYR, fixedFeeCNY,
      campaignMYR, campaignCNY,
      transactionMYR, transactionCNY,
      profitMYR, profitCNY,
    };
  }, [priceMYR, matchedPurchasePrice, campaignMode, settings]);

  // 占比计算
  const getPercentage = useCallback((valueMYR: number) => {
    if (!calcResult.price) return '-';
    return ((valueMYR / calcResult.price) * 100).toFixed(2) + '%';
  }, [calcResult.price]);

  // 设置表单状态
  const [editSettings, setEditSettings] = useState<PlatformCalcSettings>(settings);

  const handleOpenSettings = () => {
    setEditSettings({ ...settings });
    setSettingsOpen(true);
  };

  const handleSaveSettings = async () => {
    const newSetting: CalculatorSettings = {
      id: platform,
      platform,
      settings: editSettings,
      createdAt: Date.now(),
    };
    await updateCalculatorSetting(newSetting);
    setSettingsOpen(false);
  };

  // 表格行数据
  const rows = [
    { field: '商品定价', myr: calcResult.priceMYR, cny: calcResult.priceCNY, isInput: true, tooltip: '' },
    { field: '采购成本', myr: calcResult.purchaseMYR, cny: calcResult.purchaseCNY, isSkuInput: true, tooltip: '出厂价+海运成本+国内运费' },
    { field: '海外仓操作费', myr: calcResult.overseasMYR, cny: calcResult.overseasCNY, tooltip: '' },
    { field: '佣金', myr: calcResult.commissionMYR, cny: calcResult.commissionCNY, tooltip: '' },
    { field: '节省计划费用', myr: calcResult.savingsMYR, cny: calcResult.savingsCNY, tooltip: '' },
    { field: '固定服务费', myr: calcResult.fixedFeeMYR, cny: calcResult.fixedFeeCNY, tooltip: '' },
    { field: '活动服务费', myr: calcResult.campaignMYR, cny: calcResult.campaignCNY, isCampaign: true, tooltip: '' },
    { field: '交易手续费', myr: calcResult.transactionMYR, cny: calcResult.transactionCNY, tooltip: '实际是按付款金额来计算，这里按定价计算会稍微多一点点' },
  ];

  const formatNum = (n: number) => n.toFixed(4);

  return (
    <div className="space-y-6">
      {/* 平台切换 + 设置按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['shopee', 'lazada', 'tiktok'] as Platform[]).map((p) => (
            <Button
              key={p}
              variant={platform === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setPlatform(p); setSkuInput(''); setPriceMYR(''); }}
              className={platform === p && p === 'shopee' ? 'bg-[#ee4d2d] hover:bg-[#d4432a]' : ''}
            >
              {PLATFORM_LABELS[p]}
            </Button>
          ))}
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={handleOpenSettings}>
              <Settings className="mr-1 h-4 w-4" />
              固定值设置
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{PLATFORM_LABELS[platform]} - 固定值设置</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium">汇率（1马币=？人民币）</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editSettings.exchangeRate}
                  onChange={(e) => setEditSettings({ ...editSettings, exchangeRate: parseFloat(e.target.value) || 0 })}
                  className="col-span-2"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium">海外仓操作费（人民币）</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editSettings.overseasFee}
                  onChange={(e) => setEditSettings({ ...editSettings, overseasFee: parseFloat(e.target.value) || 0 })}
                  className="col-span-2"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium">佣金比例（%）</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editSettings.commissionRate}
                  onChange={(e) => setEditSettings({ ...editSettings, commissionRate: parseFloat(e.target.value) || 0 })}
                  className="col-span-2"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium">节省计划费用（马币）</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editSettings.savingsFee}
                  onChange={(e) => setEditSettings({ ...editSettings, savingsFee: parseFloat(e.target.value) || 0 })}
                  className="col-span-2"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium">固定服务费（马币）</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editSettings.fixedServiceFee}
                  onChange={(e) => setEditSettings({ ...editSettings, fixedServiceFee: parseFloat(e.target.value) || 0 })}
                  className="col-span-2"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium">活动服务费-平日（%）</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editSettings.campaignRateNormal}
                  onChange={(e) => setEditSettings({ ...editSettings, campaignRateNormal: parseFloat(e.target.value) || 0 })}
                  className="col-span-2"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium">活动服务费-大促（%）</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editSettings.campaignRatePromo}
                  onChange={(e) => setEditSettings({ ...editSettings, campaignRatePromo: parseFloat(e.target.value) || 0 })}
                  className="col-span-2"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium">交易手续费（%）</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editSettings.transactionRate}
                  onChange={(e) => setEditSettings({ ...editSettings, transactionRate: parseFloat(e.target.value) || 0 })}
                  className="col-span-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>取消</Button>
              <Button onClick={handleSaveSettings}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 输入区域 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{PLATFORM_LABELS[platform]} 利润计算器</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">商品定价（马币）</label>
              <Input
                type="number"
                step="0.01"
                placeholder="输入商品定价"
                value={priceMYR}
                onChange={(e) => setPriceMYR(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">商品编号/商品名称（自动匹配采购单价）</label>
              <Input
                placeholder="输入SKU编码或商品名称"
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
              />
              {skuInput.trim() && (
                <p className="text-xs text-slate-500 mt-1">
                  {matchedPurchasePrice !== null
                    ? `已匹配采购单价：¥${matchedPurchasePrice.toFixed(2)}`
                    : '未找到匹配的SKU，请手动确认'}
                </p>
              )}
            </div>
          </div>

          {/* 计算结果表格 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-[160px]">字段</TableHead>
                  <TableHead className="text-right">金额（马币）</TableHead>
                  <TableHead className="text-right">金额（人民币）</TableHead>
                  <TableHead className="text-right">占比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.field}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        {row.field}
                        {row.tooltip && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs max-w-[250px]">{row.tooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.isInput ? (
                        <span className="font-semibold text-slate-800">{calcResult.price ? formatNum(row.myr) : '-'}</span>
                      ) : row.isCampaign ? (
                        <div className="flex items-center justify-end gap-1">
                          <span>{calcResult.price ? formatNum(row.myr) : '-'}</span>
                          <Badge
                            variant={campaignMode === 'normal' ? 'secondary' : 'default'}
                            className="cursor-pointer text-xs px-1.5 py-0 ml-1"
                            onClick={() => setCampaignMode(campaignMode === 'normal' ? 'promo' : 'normal')}
                          >
                            {campaignMode === 'normal' ? '平日' : '大促'}
                          </Badge>
                        </div>
                      ) : (
                        <span>{calcResult.price ? formatNum(row.myr) : '-'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {calcResult.price ? formatNum(row.cny) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {getPercentage(row.myr)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* 利润行 */}
                <TableRow className="bg-slate-50 font-bold">
                  <TableCell className="font-bold">利润</TableCell>
                  <TableCell className={`text-right font-mono font-bold ${calcResult.profitMYR >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {calcResult.price ? formatNum(calcResult.profitMYR) : '-'}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-bold ${calcResult.profitCNY >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {calcResult.price ? formatNum(calcResult.profitCNY) : '-'}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-bold ${calcResult.profitMYR >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {getPercentage(calcResult.profitMYR)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {platform !== 'shopee' && (
            <p className="text-xs text-slate-400 mt-3 text-center">
              {PLATFORM_LABELS[platform]} 计算方式待补充，当前仅展示框架，请在「固定值设置」中配置参数
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
