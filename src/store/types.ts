import type {
  Platform,
  SkuMapping,
  ShopName,
  RawOrderData,
  CalculatedOrder,
  SkuSummary,
  PlatformSummary,
  SavedCalcConfig,
  OrderFilterRules,
} from '@/types';

export interface AppState {
  // 数据
  skuMappings: SkuMapping[];
  shopNames: ShopName[];
  savedConfigs: Record<Platform, SavedCalcConfig[]>;
  activeConfigId: Record<Platform, string>;
  rawOrders: Record<Platform, RawOrderData[]>;
  availableHeaders: Record<Platform, string[]>;

  // 加载状态
  isLoading: boolean;
  isSaving: boolean;
  dbConnected: boolean;

  // 数据加载
  loadAllData: () => Promise<void>;
  retryConnection: () => Promise<void>;

  // SKU 映射
  addSkuMapping: (mapping: Omit<SkuMapping, 'id'>) => Promise<void>;
  updateSkuMapping: (id: string, mapping: Partial<SkuMapping>) => Promise<void>;
  deleteSkuMapping: (id: string) => Promise<void>;
  deleteSkuMappingsBatch: (ids: string[]) => Promise<void>;
  importSkuMappings: (mappings: Omit<SkuMapping, 'id'>[]) => Promise<void>;
  clearSkuMappings: () => Promise<void>;

  // 店铺名称
  addShopName: (name: Omit<ShopName, 'id'>) => Promise<void>;
  addShopNamesBatch: (platform: Platform, names: string[]) => Promise<void>;
  updateShopName: (id: string, name: string) => Promise<void>;
  deleteShopName: (id: string) => Promise<void>;
  clearShopNames: (platform: Platform) => Promise<void>;

  // 计算配置
  getActiveConfig: (platform: Platform) => SavedCalcConfig | undefined;
  setActiveConfig: (platform: Platform, configId: string) => Promise<void>;
  switchConfig: (platform: Platform, configId: string) => Promise<void>;
  saveCurrentConfig: (platform: Platform, name: string) => Promise<void>;
  updateFieldMapping: (platform: Platform, field: string, value: string) => Promise<void>;
  updateFieldAlias: (platform: Platform, field: string, alias: string) => Promise<void>;
  updateFormula: (platform: Platform, field: string, formula: string) => Promise<void>;
  updateFilterRules: (platform: Platform, rules: Partial<OrderFilterRules>) => Promise<void>;
  setCountQuantityAsRows: (platform: Platform, value: boolean) => Promise<void>;
  setProfitRateRedThreshold: (platform: Platform, value: number | null) => Promise<void>;
  saveAsNewConfig: (platform: Platform, name: string) => Promise<void>;
  renameConfig: (platform: Platform, configId: string, name: string) => Promise<void>;
  deleteConfig: (platform: Platform, configId: string) => Promise<void>;

  // 导入数据
  importOrders: (platform: Platform, data: { headers: string[]; rows: Record<string, string | number>[]; shopName: string; yearMonth: string; configId: string; fileName?: string }) => Promise<void>;
  deleteOrderFile: (platform: Platform, fileId: string) => Promise<void>;
  clearOrders: (platform: Platform) => Promise<void>;
  mergeHeaders: (platform: Platform, headers: string[]) => void;

  // 计算方法（纯前端，不涉及数据库）
  calculateSummary: (platform: Platform) => PlatformSummary;
  calculateAllSummaries: () => Record<Platform, PlatformSummary>;
  calculateSkuSummaries: (platform: Platform) => SkuSummary[];
}
