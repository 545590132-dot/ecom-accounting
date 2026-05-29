# AGENTS.md

## 项目概览

电商做账统计工具，支持 Shopee、Lazada、TikTok 三个平台的数据导入、SKU 映射、自动计算和利润分析。

## 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **状态管理**: Zustand (persist middleware)
- **表格解析**: xlsx + file-saver

## 目录结构

```
src/
├── app/
│   ├── (main)/                  # 主布局路由组
│   │   ├── layout.tsx           # 侧边栏 + 主内容布局
│   │   ├── page.tsx             # 总览仪表盘首页
│   │   ├── sku/page.tsx         # SKU 映射管理页
│   │   └── platform/[platform]/ # 平台动态路由
│   │       └── page.tsx         # Shopee/Lazada/TikTok 页面
│   ├── globals.css              # 全局样式
│   └── layout.tsx               # 根布局
├── components/
│   ├── features/
│   │   ├── app-sidebar.tsx      # 侧边栏导航
│   │   ├── dashboard.tsx        # 总览仪表盘组件
│   │   ├── sku-manager.tsx      # SKU 映射管理组件
│   │   └── platform-page.tsx    # 平台页面组件（数据导入/计算配置/统计结果）
│   └── ui/                      # shadcn/ui 组件库
├── store/
│   └── index.ts                 # Zustand 状态管理（含 SKU/配置/订单/计算逻辑）
├── types/
│   └── index.ts                 # 类型定义 + 工具函数
└── lib/
    ├── utils.ts                 # cn 工具函数
    └── excel.ts                 # Excel 解析/导出/模板下载
```

## 构建和测试命令

- 开发：`pnpm dev`
- 构建：`pnpm build`
- 类型检查：`pnpm ts-check`
- Lint：`pnpm lint`
- 启动生产：`pnpm start`

## 核心数据流

1. 用户在「SKU 映射」页录入/导入 SKU 及采购单价
2. 用户在各平台页「数据导入」标签页上传订单 Excel
3. 用户可在「计算配置」标签页自定义字段映射和计算公式
4. 系统根据字段映射和公式自动计算统计结果
5. 总览页汇总三个平台数据

## 数据持久化

使用 Zustand persist middleware，数据存储在 localStorage，key 为 `ecommerce-accounting-store`。
