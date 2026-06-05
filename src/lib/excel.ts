'use client';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { SkuMapping } from '@/types';

// 解析上传的表格文件，返回表头和行数据
export async function parseExcelFile(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string | number>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(worksheet, {
          defval: '',
        });

        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        // 对表头 key 做 trim，确保与 availableHeaders 一致
        const rawHeaders = Object.keys(jsonData[0]);
        const headers = rawHeaders.map(h => h.trim());
        const rows = jsonData.map(row => {
          const newRow: Record<string, string | number> = {};
          for (const [key, value] of Object.entries(row)) {
            newRow[key.trim()] = value;
          }
          return newRow;
        });
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// 导出数据为 Excel 文件
export function exportToExcel(
  data: Record<string, string | number>[],
  fileName: string,
  sheetName = 'Sheet1'
): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${fileName}.xlsx`);
}

// 生成 SKU 映射模板
export function downloadSkuTemplate(): void {
  const templateData = [
    {
      SKU编码: 'SKU-001',
      商品名称: '示例商品A',
      采购单价: 10.5,
      分类: '电子产品',
      产品负责人: '张三',
    },
    {
      SKU编码: 'SKU-002',
      商品名称: '示例商品B',
      采购单价: 25.0,
      分类: '家居用品',
      产品负责人: '李四',
    },
  ];
  exportToExcel(templateData, 'SKU映射模板', 'SKU映射');
}

// 导入 SKU 映射数据
export function importSkuFromExcel(
  rows: Record<string, string | number>[]
): Omit<SkuMapping, 'id' | 'platform'>[] {
  return rows.map((row) => ({
    sku: String(row['SKU编码'] ?? row['sku'] ?? row['SKU'] ?? ''),
    productName: String(row['商品名称'] ?? row['productName'] ?? ''),
    purchasePrice: Number(row['采购单价'] ?? row['purchasePrice'] ?? 0),
    category: String(row['分类'] ?? row['category'] ?? ''),
    productOwner: String(row['产品负责人'] ?? row['productOwner'] ?? ''),
  })).filter((m) => m.sku !== '');
}

// 平台订单导入模板 — 使用各平台真实导出格式中的常见表头
// 注意：此模板仅供参考格式。实际使用时请直接上传平台导出的原始表格，
// 系统会自动读取表头字段，无需手工修改列名。
export function downloadPlatformTemplate(platform: string): void {
  const templates: Record<string, Record<string, string | number>[]> = {
    shopee: [
      {
        '订单编号': '240101ABCD1P',
        '订单状态': '已完成',
        '配送方式': '标准配送',
        '追踪号': 'SHP1234567890',
        '运输商': 'SPX',
        '退货/退款': '-',
        '买家用户名': 'user_abc',
        '付款方式': '信用卡',
        '订单金额': 100.0,
        '买家支付运费': 5.0,
        '优惠券折扣': 0,
        '信用卡交易手续费': 2.5,
        '订单总佣金': 6.0,
        '佣金': 6.0,
        '服务费': 1.0,
        '物流费': 3.0,
        '实际运费': 4.0,
        '商品编码': 'SKU-001',
        '商品名称': '示例商品A',
        '商品数量': 2,
        '商品原始价格': 50.0,
        '商品单价': 50.0,
        '商品折扣': 0,
      },
    ],
    lazada: [
      {
        '订单号': '5001234567890',
        '订单状态': 'Delivered',
        '子订单状态': 'Delivered',
        '运单号': 'LZD9876543210',
        '创建时间': '2024-01-01 10:30:00',
        '买家姓名': '张三',
        '卖家SKU': 'SKU-001',
        'Lazada SKU': 'LZ-SKU-001',
        '商品名称': '示例商品A',
        '数量': 1,
        '单价': 80.0,
        '订单总金额': 80.0,
        '佣金': 4.0,
        '平台佣金率': '5%',
        '运费': 3.0,
        '物流方式': 'LGS',
        '支付方式': 'Online Payment',
      },
    ],
    tiktok: [
      {
        '订单ID': '730012345678901234',
        '子订单ID': '730012345678901235',
        '订单状态': 'Delivered',
        '卖家SKU': 'SKU-001',
        '商品名称': '示例商品A',
        '数量': 3,
        '商品单价': 30.0,
        '订单金额': 90.0,
        '平台服务费': 5.4,
        '运费': 4.0,
        '买家支付运费': 2.0,
        '支付方式': 'Online Payment',
        '创建时间': '2024-01-01 12:00:00',
      },
    ],
  };

  const data = templates[platform] || templates.shopee;
  exportToExcel(data, `${platform}_订单导入模板`, '订单数据');
}
