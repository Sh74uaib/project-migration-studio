import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ApiKeyItem,
  ApiKeyStoreState,
  ApiAlert,
  ApiKeyStatus,
} from "./api-key-types";

export type { ApiKeyItem, ApiKeyStoreState, ApiAlert, ApiKeyStatus } from "./api-key-types";

const STORAGE_KEY = "orion.apiKeys";
const DEFAULT_RESET_HOURS = 24;
const RESET_CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

export const useApiKeyStore = create<ApiKeyStoreState>()(
  persist(
    (set, get) => ({
      keys: [],
      providers: [],
      alerts: [],

      addKey: (key) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const newKey: ApiKeyItem = {
          ...key,
          id,
          createdAt: now,
          lastUsedAt: null,
          failCount: 0,
          status: key.status || "active",
          quotaExhaustedAt: null,
          resetAt: null,
          emailAccount: key.emailAccount || null,
        };

        set((state) => {
          const newKeys = [...state.keys, newKey];
          const providers = Array.from(new Set(newKeys.map((k) => k.provider)));
          // Automatically mark alerts for this provider as resolved if we added an active key
          const alerts = state.alerts.map((a) =>
            a.provider === key.provider && a.type === "all_keys_exhausted"
              ? { ...a, read: true }
              : a,
          );
          return { keys: newKeys, providers, alerts };
        });

        return id;
      },

      updateKey: (id, updates) => {
        set((state) => {
          const newKeys = state.keys.map((k) => (k.id === id ? { ...k, ...updates } : k));
          const providers = Array.from(new Set(newKeys.map((k) => k.provider)));
          return { keys: newKeys, providers };
        });
      },

      deleteKey: (id) => {
        set((state) => {
          const newKeys = state.keys.filter((k) => k.id !== id);
          const providers = Array.from(new Set(newKeys.map((k) => k.provider)));
          return { keys: newKeys, providers };
        });
      },

      setKeyStatus: (id, status, quotaExhaustedAt = null, resetAt = null) => {
        set((state) => ({
          keys: state.keys.map((k) =>
            k.id === id
              ? {
                  ...k,
                  status,
                  quotaExhaustedAt,
                  resetAt,
                  lastUsedAt: status === "active" ? Date.now() : k.lastUsedAt,
                  failCount: status === "quota_exhausted" ? k.failCount + 1 : k.failCount,
                }
              : k,
          ),
        }));
      },

      markKeyExhausted: (id, hours = DEFAULT_RESET_HOURS) => {
        const now = Date.now();
        const resetAt = now + hours * 60 * 60 * 1000;
        set((state) => ({
          keys: state.keys.map((k) =>
            k.id === id
              ? {
                  ...k,
                  status: "quota_exhausted" as ApiKeyStatus,
                  quotaExhaustedAt: now,
                  resetAt,
                  failCount: k.failCount + 1,
                }
              : k,
          ),
        }));
      },

      resetKey: (id) => {
        set((state) => ({
          keys: state.keys.map((k) =>
            k.id === id
              ? {
                  ...k,
                  status: "active" as ApiKeyStatus,
                  quotaExhaustedAt: null,
                  resetAt: null,
                }
              : k,
          ),
        }));
      },

      resetAllForProvider: (provider) => {
        set((state) => ({
          keys: state.keys.map((k) =>
            k.provider === provider
              ? {
                  ...k,
                  status: "active" as ApiKeyStatus,
                  quotaExhaustedAt: null,
                  resetAt: null,
                }
              : k,
          ),
          alerts: state.alerts.map((a) =>
            a.provider === provider ? { ...a, read: true } : a,
          ),
        }));
      },

      getProviderKeys: (provider) => {
        return get().keys.filter((k) => k.provider.toLowerCase() === provider.toLowerCase());
      },

      getActiveKeys: (provider) => {
        return get()
          .getProviderKeys(provider)
          .filter((k) => k.status === "active");
      },

      getNextActiveKey: (provider) => {
        const activeKeys = get().getActiveKeys(provider);
        if (activeKeys.length === 0) return null;
        // Least Recently Used: pick key with earliest lastUsedAt (nulls first)
        const sorted = [...activeKeys].sort((a, b) => {
          if (a.lastUsedAt === null && b.lastUsedAt !== null) return -1;
          if (a.lastUsedAt !== null && b.lastUsedAt === null) return 1;
          if (a.lastUsedAt === null && b.lastUsedAt === null) return 0;
          return (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0);
        });
        return sorted[0] ?? null;
      },

      providerAllExhausted: (provider) => {
        const allKeys = get().getProviderKeys(provider);
        return allKeys.length > 0 && allKeys.every((k) => k.status !== "active");
      },

      checkQuotaReset: () => {
        const now = Date.now();
        set((state) => {
          let changed = false;
          const newKeys = state.keys.map((k) => {
            if (k.status === "quota_exhausted" && k.resetAt && now >= k.resetAt) {
              changed = true;
              return {
                ...k,
                status: "active" as ApiKeyStatus,
                quotaExhaustedAt: null,
                resetAt: null,
              };
            }
            return k;
          });
          return changed ? { keys: newKeys } : state;
        });
      },

      addAlert: (alert) => {
        const id = crypto.randomUUID();
        const newAlert: ApiAlert = { ...alert, id, createdAt: Date.now(), read: false };
        set((state) => {
          // Avoid duplicate unread alerts for same provider and type
          const exists = state.alerts.some(
            (a) => !a.read && a.provider === alert.provider && a.type === alert.type,
          );
          if (exists) return state;
          return { alerts: [newAlert, ...state.alerts].slice(0, 50) };
        });
      },

      markAlertRead: (id) => {
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
        }));
      },

      removeAlert: (id) => {
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
        }));
      },

      clearAlerts: () => {
        set({ alerts: [] });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      partialize: (state) => ({
        keys: state.keys,
        providers: state.providers,
        alerts: state.alerts,
      }),
    },
  ),
);

// Auto seed default keys if store is empty (runs once on first load)
export function seedDefaultKeys() {
  const { keys, addKey } = useApiKeyStore.getState();
  if (keys.length > 0) return;

  const defaultKeys: Omit<
    ApiKeyItem,
    "id" | "createdAt" | "status" | "quotaExhaustedAt" | "resetAt" | "lastUsedAt" | "failCount"
  >[] = [
    // Shuaibhassan133@gmail.com
    {
      provider: "Mistral",
      label: "mistral-1 (shuaib)",
      apiKey: "mstrl_wszucPMiqkkmW3Q1ymQ4dBXhNiRU3PqN_2VpHqZ",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "Groq",
      label: "groq-1 (shuaib)",
      apiKey: "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",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "OpenRouter",
      label: "openrouter-1 (shuaib)",
      apiKey: "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",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "Tavily",
      label: "tavily-1 (shuaib)",
      apiKey: "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",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "Exa",
      label: "exa-1 (shuaib)",
      apiKey: "5d57a74f-d5a5-4720-9a9c-0d310241abbd",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "SerpAPI",
      label: "serpapi-1 (shuaib)",
      apiKey: "e06f8674b0039a61df3ff9f573f9c50f3f33e70f49d1a9c164c32c8e9f632bc6",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "Serper",
      label: "serper-1 (shuaib)",
      apiKey: "749e025e5492bffef5251094626c1e19139add1b",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "Oolostep",
      label: "olostep-1 (shuaib)",
      apiKey: "olostep_Htmntdy4YOzPoQRxEbu9IIwB6Q5r8ZlUgbH7",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "NewsData.io",
      label: "newsdata-1 (shuaib)",
      apiKey: "pub_09f50c4e896f454e9f641f48c8b34425",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "You.com",
      label: "you-1 (shuaib)",
      apiKey: "ydc-sk-78def3b793a1e9bc-FRh3HUmhMXpkoRsUPmIGBdqYPq0JzZIO-9a27c3f2",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "Gnews",
      label: "gnews-1 (shuaib)",
      apiKey: "cba398537da916acad1ea502dd5f5b71",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "NewsAPI.org",
      label: "newsapi-1 (shuaib)",
      apiKey: "a56400a7b23f482d88cb0838e975f907",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "FreenewsAPI.io",
      label: "freenews-1 (shuaib)",
      apiKey: "cf5f202a76cf7ea05ee27b056e761eb39451087451069a731dcab8c68d6250bc",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "Marketaux",
      label: "marketaux-1 (shuaib)",
      apiKey: "38BCuI6gJt1WrwzJH9VF6cuojVKpl7grRqDfN9fj",
      emailAccount: "Shuaibhassan133@gmail.com",
    },
    {
      provider: "Currentnewsapi.services",
      label: "currentnews-1 (shuaib)",
      apiKey: "ctZ9BR9EbxhQUyCBXb9xOHGgo0L_UuwVjKuvkiIh6J7FV3I_",
      emailAccount: "Shuaibhassan133@gmail.com",
    },

    // S16139306@gmail.com
    {
      provider: "Gemini",
      label: "gemini-1 (s16139306)",
      apiKey: "AQ.Ab8RN6I0wOeJFSUE0tmoyujtBzq_Ih_BL5WA8qkd_GYQzcPCUw",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "Groq",
      label: "groq-2 (s16139306)",
      apiKey: "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",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "OpenRouter",
      label: "openrouter-2 (s16139306)",
      apiKey: "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",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "Tavily",
      label: "tavily-2 (s16139306)",
      apiKey: "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",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "Exa",
      label: "exa-2 (s16139306)",
      apiKey: "82f8ff4d-adff-42c0-a6ad-673d32c394b1",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "Serper",
      label: "serper-2 (s16139306)",
      apiKey: "6a1452bb0b1cbb818a80090dc5bd2ea904fc481d",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "NewsData.io",
      label: "newsdata-2 (s16139306)",
      apiKey: "pub_207c98f9e99f44d49b3469dab665ae0b",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "Oolostep",
      label: "olostep-2 (s16139306)",
      apiKey: "olostep_pbhqFdAQeSRVqiedRdgt1V53Gfq5xi6Shzve",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "Gnews",
      label: "gnews-2 (s16139306)",
      apiKey: "0f4748978a4249bcb4f37ff7ec52f35d",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "You.com",
      label: "you-2 (s16139306)",
      apiKey: "ydc-sk-5be2a0cff3d8d5b6-CJukDLJht2Y7p0LHpU1jREML1UEDl4nX-a4699f28",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "NewsAPI.org",
      label: "newsapi-2 (s16139306)",
      apiKey: "4658541423c9483b96de0993a178b241",
      emailAccount: "S16139306@gmail.com",
    },
    {
      provider: "FreenewsAPI.io",
      label: "freenews-2 (s16139306)",
      apiKey: "17eb10d05c78f8f2f566e8f2bf11e3590adad0bd69adb25d908256842061bf45",
      emailAccount: "S16139306@gmail.com",
    },

    // intileq@gmail.com
    {
      provider: "You.com",
      label: "you-3 (intileq)",
      apiKey: "ydc-sk-872a397f8b957004-AVCNKe1s2c0rHNLL9jyimsW2FkcCIYMk-5699e485",
      emailAccount: "intileq@gmail.com",
    },
    {
      provider: "Groq",
      label: "groq-3 (intileq)",
      apiKey: "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",
      emailAccount: "intileq@gmail.com",
    },
    {
      provider: "OpenRouter",
      label: "openrouter-3 (intileq)",
      apiKey: "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",
      emailAccount: "intileq@gmail.com",
    },

    // Iqbalahmed4657@gmail.com
    {
      provider: "Gemini",
      label: "gemini-2 (iqbal)",
      apiKey: "AQ.Ab8RN6IIwt_q6KyhE9wFNyq9FLouw_S9_rwPxkTzDeyAg7Szxw",
      emailAccount: "Iqbalahmed4657@gmail.com",
    },
    {
      provider: "Groq",
      label: "groq-4 (iqbal)",
      apiKey: "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",
      emailAccount: "Iqbalahmed4657@gmail.com",
    },
    {
      provider: "OpenRouter",
      label: "openrouter-4 (iqbal)",
      apiKey: "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",
      emailAccount: "Iqbalahmed4657@gmail.com",
    },
    {
      provider: "You.com",
      label: "you-4 (iqbal)",
      apiKey: "ydc-sk-03a4df34c6875b86-c3TAgh5OS5Fid4PTGE2wbTrdOed0iZ3I-3a2d460c",
      emailAccount: "Iqbalahmed4657@gmail.com",
    },

    // Developer / Tools
    {
      provider: "GitHub",
      label: "github-1",
      apiKey: "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",
      emailAccount: null,
    },
    {
      provider: "HuggingFace",
      label: "hf-1",
      apiKey: "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",
      emailAccount: null,
    },
  ];

  defaultKeys.forEach((k) => addKey(k));
}

// Auto-check quota reset loop
export function initQuotaResetWatcher() {
  if (typeof window === "undefined") return () => {};
  useApiKeyStore.getState().checkQuotaReset();
  const id = setInterval(() => {
    useApiKeyStore.getState().checkQuotaReset();
  }, RESET_CHECK_INTERVAL_MS);
  return () => clearInterval(id);
}
