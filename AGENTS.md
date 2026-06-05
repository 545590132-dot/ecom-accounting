# AGENTS.md

## 项目概览

电商做账统计工具，支持 Shopee、Lazada、TikTok 三个平台的数据导入、SKU 映射、自动计算和利润分析。

## 版本技术栈

- **Framework**: Next.js 16 (App Router, 静态导出)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **状态管理**: Zustand (内存状态，无 persist)
- **数据库**: Supabase PostgreSQL (Coze 托管实例，通过环境变量连接)
- **表格解析**: xlsx + file-saver
- **部署**: GitHub Pages (gh-pages 分支)

## 目录结构

```
src/
├── app/
│   ├── (main)/                  # 主布局路由组
│   │   ├── layout.tsx           # 侧边栏 + 主内容布局 + DataProvider
│   │   ├── page.tsx             # 总览仪表盘首页
│   │   ├── sku/page.tsx         # SKU 映射管理页
│   │   ├── shops/page.tsx       # 店铺管理页
│   │   └── platform/[platform]/ # 平台动态路由
│   │       ├── page.tsx         # 服务端组件 (generateStaticParams)
│   │       └── client.tsx       # 客户端平台页包装
│   ├── globals.css              # 全局样式
│   └── layout.tsx               # 根布局
├── components/
│   ├── features/
│   │   ├── app-sidebar.tsx      # 侧边栏导航
│   │   ├── dashboard.tsx        # 总览仪表盘组件
│   │   ├── sku-manager.tsx      # SKU 映射管理组件 (含平台切换)
│   │   ├── shop-manager.tsx     # 店铺管理组件
│   │   └── platform-page.tsx    # 平台页面组件 (数据导入/计算配置/统计结果)
│   ├── data-provider.tsx        # 数据加载组件 (Supabase → Zustand)
│   └── ui/                      # shadcn/ui 组件库
├── store/
│   └── index.ts                 # Zustand 状态管理 (Supabase 同步)
├── types/
│   └── index.ts                 # 类型定义 + 工具函数
└── lib/
    ├── utils.ts                 # cn 工具函数
    ├── supabase.ts              # Supabase 客户端初始化
    ├── db.ts                    # Supabase 数据访问层 (CRUD)
    └── excel.ts                 # Excel 解析/导出/模板下载
```

## 构建和测试命令

- 开发：`pnpm dev` (端口 5000, 无 basePath)
- 构建：`NODE_ENV=production pnpm build` (静态导出到 out/, basePath=/ecommerce-accounting)
- 类型检查：`pnpm ts-check`
- Lint：`pnpm lint`
- 部署：将 `out/` 内容推送到 gh-pages 分支

## 核心数据流

1. DataProvider 在 App 挂载时调用 `loadAllData()` 从 Supabase 加载所有数据到 Zustand
2. 用户在「SKU 映射」页录入/导入 SKU 及采购单价 (按平台分类)
3. 用户在各平台页「数据导入」标签页上传订单 Excel
4. 用户可在「计算配置」标签页自定义字段映射和计算公式
5. 系统根据字段映射和公式自动计算统计结果
6. 所有修改操作先更新 Supabase 再更新本地状态

## 数据持久化

- **Supabase 数据库**：5 张表
  - `sku_mappings` — SKU 映射 (id, sku, product_name, purchase_price, platform)
  - `shop_names` — 店铺名称 (id, name, platform, created_at)
  - `calc_configs` — 计算配置 (field_mapping/field_aliases/formulas/filter_rules 为 JSONB)
  - `raw_order_files` — 原始订单文件元数据
  - `order_rows` — 订单行数据 (row_data 为 JSONB)
- **RLS 策略**：所有表允许 anon 用户全部操作 (团队共享无认证场景)
- **无 localStorage**：移除了 Zustand persist middleware

## GitHub Pages 部署

- 仓库：`545590132-dot/ecom-accounting`
- 访问地址：`https://545590132-dot.github.io/ecom-accounting/`
- `main` 分支：源代码
- `gh-pages` 分支：静态构建产物 (out/ 目录内容)
- `next.config.ts`：开发环境无 basePath，生产环境 basePath=/ecom-accounting

## Supabase 数据库配置

- 连接信息通过环境变量注入（不再硬编码）：
  - `NEXT_PUBLIC_SUPABASE_URL`：Supabase 项目 URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase 匿名密钥
- 开发环境：`.env.local` 文件配置（已在 `.gitignore` 中）
- 构建/部署时：环境变量在构建阶段注入到静态产物
- 数据库 Schema：由 Coze 托管 Supabase 管理，包含 `product_owner` 和 `category` 列
- RLS 策略：所有表启用 RLS，`anon` 角色有完整读写权限
