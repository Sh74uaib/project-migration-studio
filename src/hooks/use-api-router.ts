import { useCallback, useState, useEffect } from "react";
import {
  useApiKeyStore,
  type ApiKeyItem,
} from "@/lib/api-key-store";
import { proxyApiCall } from "@/lib/server-api-proxy";
import { buildDomainFilteredQuery } from "@/lib/sources";

export type FetchOptions = {
  provider: string;
  url: string;
  headers?: Record<string, string>;
  method?: string;
  body?: any;
  keyInUrl?: boolean;
};

export type FetchResult = {
  data: any;
  keyUsed: ApiKeyItem | null;
  attempts: number;
  success: boolean;
  lastError: any;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type SearchResultItem = {
  title: string;
  url: string;
  snippet: string;
  source?: string;
};

export type ChatOptions = {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  preferredProvider?: string;
  preferredModel?: string;
  domains?: string[];
  grounded?: boolean;
  agentName?: string;
};

export type ChatResult = {
  content: string;
  provider: string;
  keyUsed: ApiKeyItem | null;
  attempts: number;
  success: boolean;
  lastError: any;
  citations?: SearchResultItem[];
};

export type SearchResult = {
  items: SearchResultItem[];
  provider: string;
  keyUsed: ApiKeyItem | null;
  success: boolean;
  lastError: any;
};

const LLM_PROVIDERS = [
  {
    provider: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "qwen/qwen3.8-27b",
  },
  {
    provider: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "nvidia/nemotron-3.5-lightning:free",
  },
  {
    provider: "Mistral",
    url: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-small-latest",
  },
  {
    provider: "Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    model: "gemini-1.5-flash",
    keyInUrl: true,
  },
];

function isQuotaOrRateLimitError(status: number, responseBody: any): boolean {
  if (status === 429) return true;
  if (status === 403 || status === 401) {
    // Check if error message mentions quota, credit, limit, exhaustion
    const text = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody || "");
    if (/quota|rate[_\s-]?limit|credit|exhausted|resource_exhausted|insufficient/i.test(text)) {
      return true;
    }
  }
  const errorText = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody || "");
  return /quota[_\s-]?exceeded|rate[_\s-]?limit[_\s-]?exceeded|resource_exhausted|free[_\s-]?tier[_\s-]?limit/i.test(
    errorText,
  );
}

function getProviderAuth(
  provider: string,
  apiKey: string,
  targetUrl: string,
  requestBody: any,
): { url: string; headers: Record<string, string>; body: any } {
  const norm = provider.toLowerCase();
  const headers: Record<string, string> = {};
  let url = targetUrl;
  let body = requestBody;

  switch (norm) {
    case "groq":
      headers["Authorization"] = `Bearer ${apiKey}`;
      break;
    case "openrouter":
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["HTTP-Referer"] = "https://orion-hub.ai";
      headers["X-Title"] = "ORION Hub";
      break;
    case "mistral":
      headers["Authorization"] = `Bearer ${apiKey}`;
      break;
    case "gemini":
      headers["x-goog-api-key"] = apiKey;
      const delim = url.includes("?") ? "&" : "?";
      url = `${url}${delim}key=${encodeURIComponent(apiKey)}`;
      break;
    case "tavily":
      headers["Authorization"] = `Bearer ${apiKey}`;
      if (body && typeof body === "object") {
        body = { ...body, api_key: apiKey };
      }
      break;
    case "exa":
      headers["x-api-key"] = apiKey;
      break;
    case "serper":
      headers["X-API-KEY"] = apiKey;
      break;
    case "you.com":
    case "you":
      headers["X-API-Key"] = apiKey;
      break;
    case "newsdata.io":
    case "newsdata":
      const ndDelim = url.includes("?") ? "&" : "?";
      url = `${url}${ndDelim}apikey=${encodeURIComponent(apiKey)}`;
      break;
    case "serpapi":
      const saDelim = url.includes("?") ? "&" : "?";
      url = `${url}${saDelim}api_key=${encodeURIComponent(apiKey)}`;
      break;
    case "github":
      headers["Authorization"] = `token ${apiKey}`;
      headers["User-Agent"] = "ORION-Hub";
      break;
    case "huggingface":
      headers["Authorization"] = `Bearer ${apiKey}`;
      break;
    default:
      headers["Authorization"] = `Bearer ${apiKey}`;
      break;
  }

  return { url, headers, body };
}

export function useApiRouter() {
  const [isRotating, setIsRotating] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const {
    keys,
    getActiveKeys,
    markKeyExhausted,
    resetKey,
    updateKey,
    providerAllExhausted,
    addAlert,
    alerts,
    markAlertRead,
    removeAlert,
    checkQuotaReset,
  } = useApiKeyStore();

  // Periodically check for auto-resets
  useEffect(() => {
    checkQuotaReset();
    const interval = setInterval(() => {
      checkQuotaReset();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [checkQuotaReset]);

  /**
   * Smart fetch with sequential failover across active keys.
   * If a key encounters 429 or quota limit, it flags it as quota_exhausted
   * and immediately shifts to the next active key without dropping the request!
   */
  const smartFetch = useCallback(
    async (options: FetchOptions): Promise<FetchResult> => {
      const { provider, url: targetUrl, headers = {}, method = "POST", body: initialBody } = options;

      const activeKeys = getActiveKeys(provider);

      if (activeKeys.length === 0) {
        addAlert({
          provider,
          message: `${provider} সার্ভিসের সব কী কোটা শেষ হয়েছে। সেটিংস প্যানেল থেকে নতুন কী যোগ করুন।`,
          type: "all_keys_exhausted",
        });

        return {
          data: null,
          keyUsed: null,
          attempts: 0,
          success: false,
          lastError: new Error(`All ${provider} API keys are exhausted`),
        };
      }

      setIsRotating(true);
      setActiveProvider(provider);
      let lastError: any = null;
      let attempts = 0;
      let keyUsed: ApiKeyItem | null = null;
      let success = false;
      let responseData: any = null;

      // Sequential In-flight Failover
      for (const key of activeKeys) {
        attempts++;
        keyUsed = key;

        try {
          const auth = getProviderAuth(provider, key.apiKey, targetUrl, initialBody);

          const combinedHeaders = {
            "Content-Type": "application/json",
            ...headers,
            ...auth.headers,
          };

          const stringifiedBody =
            auth.body != null
              ? typeof auth.body === "string"
                ? auth.body
                : JSON.stringify(auth.body)
              : undefined;

          // Execute via server proxy to prevent browser CORS blockage
          const res = await proxyApiCall({
            data: {
              url: auth.url,
              method,
              headers: combinedHeaders,
              ...(stringifiedBody !== undefined ? { body: stringifiedBody } : {}),
            },
          });

          if (res.ok) {
            // Success! Update key usage timestamp
            updateKey(key.id, { lastUsedAt: Date.now() });
            success = true;
            responseData = res.data;
            break;
          }

          // Check if error is Rate Limit / Quota Exceeded (429, 403, 401 quota lock)
          if (isQuotaOrRateLimitError(res.status, res.data || res.error)) {
            // Flag this key as quota_exhausted with 24-hour reset countdown
            markKeyExhausted(key.id, 24);
            lastError = new Error(
              `${provider} (${key.label}): ৪২৯ কোটা শেষ হয়েছে (${res.status})। পরবর্তী কী-তে শিফট করা হচ্ছে...`,
            );
            // Immediately continue to next key!
            continue;
          }

          // Other error status
          lastError = new Error(
            res.error || `${provider} এরর রেসপন্স: ${res.status}`,
          );
          continue;
        } catch (err: any) {
          lastError = err;
          continue;
        }
      }

      setIsRotating(false);
      setActiveProvider(null);

      // If all active keys failed and none are active anymore
      if (!success && providerAllExhausted(provider)) {
        addAlert({
          provider,
          message: `${provider} এর সকল কী কোটা শেষ হয়েছে। সেটিংস প্যানেল থেকে নতুন কী যোগ করুন।`,
          type: "all_keys_exhausted",
        });
      }

      return {
        data: responseData,
        keyUsed: success ? keyUsed : null,
        attempts,
        success,
        lastError,
      };
    },
    [getActiveKeys, markKeyExhausted, updateKey, providerAllExhausted, addAlert],
  );

  /**
   * Cross-provider Web Search with sequential failover.
   * Priority 1: You.com (Search / News endpoint with domain filters)
   * Priority 2 (Fallback): Tavily Search (with include_domains)
   * Priority 3: Exa / Serper
   */
  const searchWithFallback = useCallback(
    async (query: string, domains?: string[]): Promise<SearchResult> => {
      const searchProviders = [
        {
          provider: "You.com",
          url: (q: string, doms?: string[]) => {
            const filteredQuery = doms && doms.length > 0 ? buildDomainFilteredQuery(q, doms) : q;
            return `https://api.ydc-index.io/search?query=${encodeURIComponent(filteredQuery)}&count=5`;
          },
          method: "GET",
          buildBody: () => undefined,
          parse: (data: any): SearchResultItem[] =>
            (data?.hits ?? []).map((r: any) => {
              let domain = "You.com";
              try {
                if (r.url) domain = new URL(r.url).hostname.replace(/^www\./, "");
              } catch {}
              return {
                title: r.title || "Untitled",
                url: r.url || "#",
                snippet: (r.snippets ?? []).join(" ") || r.description || "",
                source: domain,
              };
            }),
        },
        {
          provider: "Tavily",
          url: () => "https://api.tavily.com/search",
          method: "POST",
          buildBody: (q: string, doms?: string[]) => ({
            query: q,
            search_depth: "basic",
            include_answer: true,
            max_results: 5,
            ...(doms && doms.length > 0 ? { include_domains: doms } : {}),
          }),
          parse: (data: any): SearchResultItem[] =>
            (data?.results ?? []).map((r: any) => {
              let domain = "Tavily";
              try {
                if (r.url) domain = new URL(r.url).hostname.replace(/^www\./, "");
              } catch {}
              return {
                title: r.title || "Untitled",
                url: r.url || "#",
                snippet: r.content || r.snippet || "",
                source: domain,
              };
            }),
        },
        {
          provider: "Exa",
          url: () => "https://api.exa.ai/search",
          method: "POST",
          buildBody: (q: string, doms?: string[]) => ({
            query: q,
            numResults: 5,
            contents: { text: true },
            ...(doms && doms.length > 0 ? { includeDomains: doms } : {}),
          }),
          parse: (data: any): SearchResultItem[] =>
            (data?.results ?? []).map((r: any) => {
              let domain = "Exa";
              try {
                if (r.url) domain = new URL(r.url).hostname.replace(/^www\./, "");
              } catch {}
              return {
                title: r.title || "Untitled",
                url: r.url || "#",
                snippet: (r.text || "").slice(0, 300),
                source: domain,
              };
            }),
        },
        {
          provider: "Serper",
          url: () => "https://google.serper.dev/search",
          method: "POST",
          buildBody: (q: string, doms?: string[]) => ({
            q: doms && doms.length > 0 ? buildDomainFilteredQuery(q, doms) : q,
            num: 5,
          }),
          parse: (data: any): SearchResultItem[] =>
            (data?.organic ?? []).map((r: any) => {
              let domain = "Serper";
              try {
                if (r.link) domain = new URL(r.link).hostname.replace(/^www\./, "");
              } catch {}
              return {
                title: r.title || "Untitled",
                url: r.link || "#",
                snippet: r.snippet || "",
                source: domain,
              };
            }),
        },
      ];

      let lastError: any = null;

      for (const sp of searchProviders) {
        const activeKeys = getActiveKeys(sp.provider);
        if (activeKeys.length === 0) continue;

        const url = sp.url(query, domains);
        const body = sp.buildBody(query, domains);

        const result = await smartFetch({
          provider: sp.provider,
          url,
          method: sp.method,
          body,
        });

        if (result.success && result.data) {
          const items = sp.parse(result.data);
          if (items.length > 0) {
            return {
              items,
              provider: sp.provider,
              keyUsed: result.keyUsed,
              success: true,
              lastError: null,
            };
          }
        }

        lastError = result.lastError;
      }

      return {
        items: [],
        provider: "",
        keyUsed: null,
        success: false,
        lastError: lastError ?? new Error("All search providers failed"),
      };
    },
    [getActiveKeys, smartFetch],
  );

  /**
   * Cross-provider LLM chat with sequential failover and optional domain-grounding.
   * Priority: Groq (Qwen 3.8 / Llama 3.3) -> OpenRouter -> Mistral -> Gemini
   */
  const chatWithFallback = useCallback(
    async (options: ChatOptions): Promise<ChatResult> => {
      const {
        messages,
        temperature = 0.7,
        maxTokens = 1200,
        preferredProvider,
        preferredModel,
        domains,
        grounded = true,
      } = options;
      let lastError: any = null;
      let totalAttempts = 0;

      // Real-time source grounding if domains specified or grounded option is true
      let citations: SearchResultItem[] = [];
      let finalMessages = [...messages];

      if (grounded) {
        const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
        if (lastUserMsg.trim()) {
          try {
            const searchRes = await searchWithFallback(lastUserMsg, domains);
            if (searchRes.success && searchRes.items.length > 0) {
              citations = searchRes.items;
              const sourcesBlock = citations
                .slice(0, 5)
                .map(
                  (c, i) =>
                    `[Source ${i + 1}]: ${c.title}\nURL: ${c.url}\nPublisher: ${c.source || "News"}\nSummary: ${c.snippet}`,
                )
                .join("\n\n");

              finalMessages = messages.map((m, idx) => {
                if (idx === messages.length - 1 && m.role === "user") {
                  return {
                    role: "user",
                    content: `${m.content}\n\n---\n[VERIFIED REAL-TIME INTELLIGENCE SOURCES (Current Date: October 2026)]:\n${sourcesBlock}\n\n[Response Guidelines]: Synthesize the above verified sources with domain authority. Format with clean bullet points. Answer naturally in Bengali (or English if prompted). Underline key facts and reference the sources accurately.`,
                  };
                }
                return m;
              });
            }
          } catch {
            // If search fails, gracefully proceed with normal LLM generation
          }
        }
      }

      // Order providers with preferred one first if specified
      let orderedProviders = [...LLM_PROVIDERS];
      if (preferredProvider) {
        const found = orderedProviders.find(
          (p) => p.provider.toLowerCase() === preferredProvider.toLowerCase(),
        );
        if (found) {
          orderedProviders = [found, ...orderedProviders.filter((p) => p !== found)];
        }
      }

      for (const llm of orderedProviders) {
        const activeKeys = getActiveKeys(llm.provider);
        if (activeKeys.length === 0) continue; // Provider has no active keys, skip to next

        const body = buildChatBody(llm, finalMessages, temperature, maxTokens, preferredModel);

        const result = await smartFetch({
          provider: llm.provider,
          url: llm.url,
          method: "POST",
          body,
          ...(llm.keyInUrl !== undefined ? { keyInUrl: llm.keyInUrl } : {}),
        });

        totalAttempts += result.attempts;

        if (result.success && result.data) {
          const content = parseChatResponse(llm.provider, result.data);
          if (content && content.trim().length > 0) {
            return {
              content: content.trim(),
              provider: llm.provider,
              keyUsed: result.keyUsed,
              attempts: totalAttempts,
              success: true,
              lastError: null,
              ...(citations.length > 0 ? { citations } : {}),
            };
          }
        }

        lastError = result.lastError;
      }

      // If all providers failed
      addAlert({
        provider: "AI Providers",
        message: "সব AI প্রোভাইডারের কোটা শেষ হয়েছে। Settings থেকে নতুন কী যোগ করুন।",
        type: "all_keys_exhausted",
      });

      return {
        content: "",
        provider: "",
        keyUsed: null,
        attempts: totalAttempts,
        success: false,
        lastError: lastError ?? new Error("All AI providers and keys are exhausted"),
        ...(citations.length > 0 ? { citations } : {}),
      };
    },
    [getActiveKeys, smartFetch, searchWithFallback, addAlert],
  );

  return {
    smartFetch,
    chatWithFallback,
    searchWithFallback,
    searchForAgent: searchWithFallback,
    isRotating,
    activeProvider,
    resetKey,
    alerts,
    markAlertRead,
    removeAlert,
  };
}

function buildChatBody(
  llm: (typeof LLM_PROVIDERS)[number],
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  preferredModel?: string,
) {
  if (llm.provider === "Gemini") {
    // Build Google Gemini contents format
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find((m) => m.role === "system");

    return {
      contents,
      systemInstruction: systemInstruction
        ? { parts: [{ text: systemInstruction.content }] }
        : undefined,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };
  }

  // OpenAI-compatible format (Groq, OpenRouter, Mistral)
  return {
    model: preferredModel || llm.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: maxTokens,
  };
}

function parseChatResponse(provider: string, data: any): string | null {
  const norm = provider.toLowerCase();
  try {
    if (norm === "gemini") {
      return (
        data.candidates?.[0]?.content?.parts?.[0]?.text ??
        data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") ??
        null
      );
    }
    // OpenAI-compatible (Groq, OpenRouter, Mistral)
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
