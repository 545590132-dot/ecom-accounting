import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '电商做账统计 | 多平台数据管理',
    template: '%s | 电商做账统计',
  },
  description: '支持 Shopee、Lazada、TikTok 多平台的电商做账统计工具，提供 SKU 映射、数据导入、自动计算与利润分析。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-slate-50 text-foreground min-h-screen">
        {children}
      </body>
    </html>
  );
}
