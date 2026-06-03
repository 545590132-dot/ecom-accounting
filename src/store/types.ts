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
  addSkuMapping: (mapping: Omit<SkuMapping, 'id'>) => void;
  updateSkuMapping: (id: string, mapping: Partial<SkuMapping>) => void;
  deleteSkuMapping: (id: string) => void;
  deleteSkuMappingsBatch: (ids: string[]) => void;
  importSkuMappings: (mappings: Omit<SkuMapping, 'id'>[]) => void;
  clearSkuMappings: () => void;

  // 店铺名称
  addShopName: (name: Omit<ShopName, 'id'>) => void;
  addShopNamesBatch: (platform: Platform, names: string[]) => void;
  updateShopName: (id: string, name: string) => void;
  deleteShopName: (id: string) => void;
  clearShopNames: (platform: Platform) => void;

  // 计算配置
  getActiveConfig: (platform: Platform) => SavedCalcConfig | undefined;
  setActiveConfig: (platform: Platform, configId: string) => void;
  switchConfig: (platform: Platform, configId: string) => void;
  saveCurrentConfig: (platform: Platform, name: string) => void;
  updateFieldMapping: (platform: Platform, field: string, value: string) => void;
  updateFieldAlias: (platform: Platform, field: string, alias: string) => void;
  updateFormula: (platform: Platform, field: string, formula: string) => void;
  updateFilterRules: (platform: Platform, rules: Partial<OrderFilterRules>) => void;
  setCountQuantityAsRows: (platform: Platform, value: boolean) => void;
  setProfitRateRedThreshold: (platform: Platform, value: number | null) => void;
  saveAsNewConfig: (platform: Platform, name: string) => void;
  renameConfig: (platform: Platform, configId: string, name: string) => void;
  deleteConfig: (platform: Platform, configId: string) => void;

  // 导入数据
  importOrders: (platform: Platform, data: { headers: string[]; rows: Record<string, string | number>[]; shopName: string; yearMonth: string; configId: string; fileName?: string }) => void;
  deleteOrderFile: (platform: Platform, fileId: string) => void;
  clearOrders: (platform: Platform) => void;
  mergeHeaders: (platform: Platform, headers: string[]) => void;

  // 计算方法（纯前端，不涉及数据库）
  calculateSummary: (platform: Platform) => PlatformSummary;
  calculateAllSummaries: () => Record<Platform, PlatformSummary>;
  calculateSkuSummaries: (platform: Platform) => SkuSummary[];
}
