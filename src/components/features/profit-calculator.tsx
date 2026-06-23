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

// 各平台固定值设置字段定义
interface SettingFieldDef {
  key: keyof PlatformCalcSettings;
  label: string;
  unit: string; // '%' | '马币' | '人民币'
}

const SHOPEE_SETTING_FIELDS: SettingFieldDef[] = [
  { key: 'exchangeRate', label: '汇率（1马币=?人民币）', unit: '' },
  { key: 'overseasFee', label: '海外仓操作费', unit: '人民币' },
  { key: 'commissionRate', label: '佣金比例', unit: '%' },
  { key: 'savingsFee', label: '节省计划费用', unit: '马币' },
  { key: 'fixedServiceFee', label: '固定服务费', unit: '马币' },
  { key: 'campaignRateNormal', label: '活动服务费-平日', unit: '%' },
  { key: 'campaignRatePromo', label: '活动服务费-大促', unit: '%' },
  { key: 'transactionRate', label: '交易手续费', unit: '%' },
];

const LAZADA_SETTING_FIELDS: SettingFieldDef[] = [
  { key: 'exchangeRate', label: '汇率（1马币=?人民币）', unit: '' },
  { key: 'overseasFee', label: '海外仓操作费', unit: '人民币' },
  { key: 'lazadaCommissionRate', label: '佣金比例', unit: '%' },
  { key: 'coinDiscountRate', label: '金币折扣服务费比例', unit: '%' },
  { key: 'paymentFeeRate', label: '支付手续费', unit: '%' },
];

const TIKTOK_SETTING_FIELDS: SettingFieldDef[] = [
  { key: 'exchangeRate', label: '汇率（1马币=?人民币）', unit: '' },
  { key: 'overseasFee', label: '海外仓操作费', unit: '人民币' },
  { key: 'commissionRate', label: '佣金比例', unit: '%' },
  { key: 'transactionRate', label: '交易手续费', unit: '%' },
];

const PLATFORM_SETTING_FIELDS: Record<Platform, SettingFieldDef[]> = {
  shopee: SHOPEE_SETTING_FIELDS,
  lazada: LAZADA_SETTING_FIELDS,
  tiktok: TIKTOK_SETTING_FIELDS,
};

// 计算行类型
interface CalcRow {
  field: string;
  myr: number;
  cny: number;
  tooltip?: string;
  isCampaign?: boolean;
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

  // Shopee 计算结果
  const shopeeResult = useMemo(() => {
    const price = parseFloat(priceMYR) || 0;
    const rate = settings.exchangeRate || 1.7;
    const purchaseCNY = matchedPurchasePrice ?? 0;
    const purchaseMYR = purchaseCNY / rate;
    const overseasCNY = settings.overseasFee;
    const overseasMYR = overseasCNY / rate;
    const commissionMYR = price * (settings.commissionRate / 100);
    const savingsMYR = settings.savingsFee;
    const fixedFeeMYR = settings.fixedServiceFee;
    const campaignRate = campaignMode === 'normal' ? settings.campaignRateNormal : settings.campaignRatePromo;
    const campaignMYR = price * (campaignRate / 100);
    const transactionMYR = price * (settings.transactionRate / 100);
    const profitMYR = price - purchaseMYR - overseasMYR - commissionMYR - savingsMYR - fixedFeeMYR - campaignMYR - transactionMYR;

    return {
      price, priceMYR: price, priceCNY: price * rate,
      purchaseMYR, purchaseCNY,
      overseasMYR, overseasCNY,
      commissionMYR, commissionCNY: commissionMYR * rate,
      savingsMYR, savingsCNY: savingsMYR * rate,
      fixedFeeMYR, fixedFeeCNY: fixedFeeMYR * rate,
      campaignMYR, campaignCNY: campaignMYR * rate,
      transactionMYR, transactionCNY: transactionMYR * rate,
      profitMYR, profitCNY: profitMYR * rate,
    };
  }, [priceMYR, matchedPurchasePrice, campaignMode, settings]);

  // Lazada 计算结果
  const lazadaResult = useMemo(() => {
    const price = parseFloat(priceMYR) || 0;
    const rate = settings.exchangeRate || 1.7;
    const purchaseCNY = matchedPurchasePrice ?? 0;
    const purchaseMYR = purchaseCNY / rate;
    const overseasCNY = settings.overseasFee;
    const overseasMYR = overseasCNY / rate;
    const commissionMYR = price * (settings.lazadaCommissionRate / 100);
    const coinDiscountMYR = price * (settings.coinDiscountRate / 100);
    const paymentFeeMYR = price * (settings.paymentFeeRate / 100);
    const profitMYR = price - purchaseMYR - overseasMYR - commissionMYR - coinDiscountMYR - paymentFeeMYR;

    return {
      price, priceMYR: price, priceCNY: price * rate,
      purchaseMYR, purchaseCNY,
      overseasMYR, overseasCNY,
      commissionMYR, commissionCNY: commissionMYR * rate,
      coinDiscountMYR, coinDiscountCNY: coinDiscountMYR * rate,
      paymentFeeMYR, paymentFeeCNY: paymentFeeMYR * rate,
      profitMYR, profitCNY: profitMYR * rate,
    };
  }, [priceMYR, matchedPurchasePrice, settings]);

  // TikTok 计算结果（框架，暂无具体公式）
  const tiktokResult = useMemo(() => {
    const price = parseFloat(priceMYR) || 0;
    const rate = settings.exchangeRate || 1.7;
    const purchaseCNY = matchedPurchasePrice ?? 0;
    const purchaseMYR = purchaseCNY / rate;
    const profitMYR = price - purchaseMYR;

    return {
      price, priceMYR: price, priceCNY: price * rate,
      purchaseMYR, purchaseCNY,
      profitMYR, profitCNY: profitMYR * rate,
    };
  }, [priceMYR, matchedPurchasePrice, settings]);

  // 获取当前平台计算结果
  const calcResult = useMemo(() => {
    switch (platform) {
      case 'shopee': return shopeeResult;
      case 'lazada': return lazadaResult;
      case 'tiktok': return tiktokResult;
    }
  }, [platform, shopeeResult, lazadaResult, tiktokResult]);

  // 各平台计算行
  const shopeeRows: CalcRow[] = [
    { field: '商品定价', myr: shopeeResult.priceMYR, cny: shopeeResult.priceCNY },
    { field: '采购成本', myr: shopeeResult.purchaseMYR, cny: shopeeResult.purchaseCNY, tooltip: '出厂价+海运成本+国内运费' },
    { field: '海外仓操作费', myr: shopeeResult.overseasMYR, cny: shopeeResult.overseasCNY },
    { field: '佣金', myr: shopeeResult.commissionMYR, cny: shopeeResult.commissionCNY },
    { field: '节省计划费用', myr: shopeeResult.savingsMYR, cny: shopeeResult.savingsCNY },
    { field: '固定服务费', myr: shopeeResult.fixedFeeMYR, cny: shopeeResult.fixedFeeCNY },
    { field: '活动服务费', myr: shopeeResult.campaignMYR, cny: shopeeResult.campaignCNY, isCampaign: true },
    { field: '交易手续费', myr: shopeeResult.transactionMYR, cny: shopeeResult.transactionCNY, tooltip: '实际是按付款金额来计算，这里按定价计算会稍微多一点点' },
  ];

  const lazadaRows: CalcRow[] = [
    { field: '商品定价', myr: lazadaResult.priceMYR, cny: lazadaResult.priceCNY },
    { field: '采购成本', myr: lazadaResult.purchaseMYR, cny: lazadaResult.purchaseCNY, tooltip: '出厂价+海运成本+国内运费' },
    { field: '海外仓操作费', myr: lazadaResult.overseasMYR, cny: lazadaResult.overseasCNY },
    { field: '佣金', myr: lazadaResult.commissionMYR, cny: lazadaResult.commissionCNY },
    { field: '金币折扣服务费', myr: lazadaResult.coinDiscountMYR, cny: lazadaResult.coinDiscountCNY },
    { field: '支付手续费', myr: lazadaResult.paymentFeeMYR, cny: lazadaResult.paymentFeeCNY, tooltip: '实际是按付款金额来计算，这里按定价计算会稍微多一点点' },
  ];

  const tiktokRows: CalcRow[] = [
    { field: '商品定价', myr: tiktokResult.priceMYR, cny: tiktokResult.priceCNY },
    { field: '采购成本', myr: tiktokResult.purchaseMYR, cny: tiktokResult.purchaseCNY, tooltip: '出厂价+海运成本+国内运费' },
  ];

  const rows: CalcRow[] = useMemo(() => {
    switch (platform) {
      case 'shopee': return shopeeRows;
      case 'lazada': return lazadaRows;
      case 'tiktok': return tiktokRows;
    }
  }, [platform, shopeeRows, lazadaRows, tiktokRows]);

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

  const formatNum = (n: number) => n.toFixed(4);

  // 获取平台按钮样式
  const getPlatformBtnClass = (p: Platform) => {
    if (platform !== p) return '';
    switch (p) {
      case 'shopee': return 'bg-[#ee4d2d] hover:bg-[#d4432a]';
      case 'lazada': return 'bg-[#0f146d] hover:bg-[#0a0f5a]';
      case 'tiktok': return 'bg-[#010101] hover:bg-[#333]';
    }
  };

  // 当前平台的设置字段
  const currentSettingFields = PLATFORM_SETTING_FIELDS[platform];

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
              className={getPlatformBtnClass(p)}
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
              {currentSettingFields.map((field) => (
                <div key={field.key} className="grid grid-cols-3 items-center gap-4">
                  <span className="text-sm font-medium">
                    {field.label}{field.unit ? `（${field.unit}）` : ''}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    value={editSettings[field.key]}
                    onChange={(e) => setEditSettings({ ...editSettings, [field.key]: parseFloat(e.target.value) || 0 })}
                    className="col-span-2"
                  />
                </div>
              ))}
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
                      {row.isCampaign ? (
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

          {platform === 'tiktok' && (
            <p className="text-xs text-slate-400 mt-3 text-center">
              TikTok 计算方式待补充，当前仅展示框架，请在「固定值设置」中配置参数
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
