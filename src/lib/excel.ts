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

        const headers = Object.keys(jsonData[0]);
        resolve({ headers, rows: jsonData });
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
    },
    {
      SKU编码: 'SKU-002',
      商品名称: '示例商品B',
      采购单价: 25.0,
      分类: '家居用品',
    },
  ];
  exportToExcel(templateData, 'SKU映射模板', 'SKU映射');
}

// 导入 SKU 映射数据
export function importSkuFromExcel(
  rows: Record<string, string | number>[]
): Omit<SkuMapping, 'id'>[] {
  return rows.map((row) => ({
    sku: String(row['SKU编码'] ?? row['sku'] ?? row['SKU'] ?? ''),
    productName: String(row['商品名称'] ?? row['productName'] ?? ''),
    purchasePrice: Number(row['采购单价'] ?? row['purchasePrice'] ?? 0),
    category: String(row['分类'] ?? row['category'] ?? ''),
  })).filter((m) => m.sku !== '');
}

// 生成平台订单导入字段参考模板
export function downloadPlatformTemplate(platform: string): void {
  const templates: Record<string, Record<string, string | number>[]> = {
    shopee: [
      {
        订单编号: 'SHP20240101001',
        商品编码: 'SKU-001',
        商品名称: '测试商品',
        商品数量: 2,
        商品单价: 50.0,
        订单金额: 100.0,
        佣金: 6.0,
        运费: 5.0,
      },
    ],
    lazada: [
      {
        订单号: 'LZD20240101001',
        卖家SKU: 'SKU-001',
        商品名称: '测试商品',
        数量: 1,
        单价: 80.0,
        订单总金额: 80.0,
        平台佣金: 4.0,
        运费: 3.0,
      },
    ],
    tiktok: [
      {
        订单ID: 'TK20240101001',
        卖家SKU: 'SKU-001',
        商品名称: '测试商品',
        数量: 3,
        商品单价: 30.0,
        订单金额: 90.0,
        平台服务费: 5.4,
        运费: 4.0,
      },
    ],
  };

  const data = templates[platform] || templates.shopee;
  exportToExcel(data, `${platform}_订单导入模板`, '订单数据');
}
