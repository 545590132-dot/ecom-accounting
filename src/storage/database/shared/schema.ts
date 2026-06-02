import { pgTable, serial, varchar, text, timestamp, jsonb, boolean, integer, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// SKU 映射
export const skuMappings = pgTable("sku_mappings", {
	id: serial().notNull(),
	platform: varchar("platform", { length: 20 }).notNull(), // shopee / lazada / tiktok
	sku: varchar("sku", { length: 200 }).notNull(),
	productName: varchar("product_name", { length: 500 }).notNull().default(""),
	purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull().default("0"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 店铺名称
export const shopNames = pgTable("shop_names", {
	id: serial().notNull(),
	platform: varchar("platform", { length: 20 }).notNull(),
	name: varchar("name", { length: 200 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 计算配置方案
export const calcConfigs = pgTable("calc_configs", {
	id: serial().notNull(),
	configId: varchar("config_id", { length: 100 }).notNull(), // 前端生成的唯一ID
	platform: varchar("platform", { length: 20 }).notNull(),
	name: varchar("name", { length: 200 }).notNull().default("默认方案"),
	isActive: boolean("is_active").notNull().default(false),
	// 字段映射：{ orderNo: "xxx", sku: "xxx", quantity: "xxx", ... }
	fieldMapping: jsonb("field_mapping").notNull().default({}),
	// 字段别名：{ orderNo: "订单号", sku: "SKU", ... }
	fieldAliases: jsonb("field_aliases").notNull().default({}),
	// 计算公式：{ totalAmount: "xxx", netAmount: "xxx", profit: "xxx", profitRate: "xxx" }
	formulas: jsonb("formulas").notNull().default({}),
	// 订单过滤规则
	filterRules: jsonb("filter_rules").notNull().default({}),
	// 数量计算方式：false=求和 true=计数
	countQuantityAsRows: boolean("count_quantity_as_rows").notNull().default(false),
	// 利润率标红阈值（null 表示不标红）
	profitRateRedThreshold: numeric("profit_rate_red_threshold", { precision: 5, scale: 2 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 导入文件
export const importedFiles = pgTable("imported_files", {
	id: serial().notNull(),
	fileId: varchar("file_id", { length: 100 }).notNull(), // 前端生成的唯一ID
	platform: varchar("platform", { length: 20 }).notNull(),
	fileName: varchar("file_name", { length: 500 }).notNull().default(""),
	shopName: varchar("shop_name", { length: 200 }).notNull().default(""),
	yearMonth: varchar("year_month", { length: 10 }).notNull().default(""),
	configId: varchar("config_id", { length: 100 }).notNull().default(""),
	// 表头列表
	headers: jsonb("headers").notNull().default([]),
	importTime: timestamp("import_time", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 订单行数据
export const orderRows = pgTable("order_rows", {
	id: serial().notNull(),
	fileId: varchar("file_id", { length: 100 }).notNull(), // 关联 imported_files.fileId
	rowIndex: integer("row_index").notNull(), // 行序号
	// 行数据（key-value，key 是 Excel 表头，value 是对应值）
	rowData: jsonb("row_data").notNull().default({}),
});
