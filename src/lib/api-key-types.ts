export type ApiKeyStatus = "active" | "quota_exhausted" | "invalid";

export type ApiKeyItem = {
  id: string;
  provider: string;
  label: string;
  apiKey: string;
  emailAccount?: string | null;
  status: ApiKeyStatus;
  quotaExhaustedAt: number | null;
  resetAt: number | null;
  lastUsedAt: number | null;
  createdAt: number;
  failCount: number;
};

export type ProviderGroup = {
  provider: string;
  keys: ApiKeyItem[];
  currentIndex: number;
  allExhausted: boolean;
};

export type ApiAlert = {
  id: string;
  provider: string;
  message: string;
  type: "quota_exhausted" | "all_keys_exhausted" | "error" | "info";
  createdAt: number;
  read: boolean;
};

export type ApiKeyStoreState = {
  keys: ApiKeyItem[];
  providers: string[];
  alerts: ApiAlert[];
  addKey: (
    key: Omit<ApiKeyItem, "id" | "createdAt" | "status" | "quotaExhaustedAt" | "resetAt" | "lastUsedAt" | "failCount"> & {
      status?: ApiKeyStatus;
    },
  ) => string;
  updateKey: (id: string, updates: Partial<ApiKeyItem>) => void;
  deleteKey: (id: string) => void;
  setKeyStatus: (
    id: string,
    status: ApiKeyStatus,
    quotaExhaustedAt?: number | null,
    resetAt?: number | null,
  ) => void;
  markKeyExhausted: (id: string, hours?: number) => void;
  resetKey: (id: string) => void;
  resetAllForProvider: (provider: string) => void;
  getProviderKeys: (provider: string) => ApiKeyItem[];
  getActiveKeys: (provider: string) => ApiKeyItem[];
  getNextActiveKey: (provider: string) => ApiKeyItem | null;
  providerAllExhausted: (provider: string) => boolean;
  checkQuotaReset: () => void;
  addAlert: (alert: Omit<ApiAlert, "id" | "createdAt" | "read">) => void;
  markAlertRead: (id: string) => void;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
};
