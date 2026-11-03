import { describe, it, expect, beforeEach } from "vitest";
import { useApiKeyStore } from "@/lib/api-key-store";

describe("useApiKeyStore", () => {
  beforeEach(() => {
    useApiKeyStore.setState({ keys: [], providers: [], alerts: [] });
  });

  it("adds and retrieves keys by provider", () => {
    const store = useApiKeyStore.getState();
    const id1 = store.addKey({
      provider: "Groq",
      label: "groq-1",
      apiKey: "gsk_test1",
      emailAccount: "test1@gmail.com",
    });
    const id2 = store.addKey({
      provider: "Groq",
      label: "groq-2",
      apiKey: "gsk_test2",
      emailAccount: "test2@gmail.com",
    });

    const groqKeys = useApiKeyStore.getState().getProviderKeys("Groq");
    expect(groqKeys.length).toBe(2);
    expect(groqKeys[0].id).toBe(id1);
    expect(groqKeys[1].id).toBe(id2);
  });

  it("marks key exhausted with reset timestamp and fail count", () => {
    const store = useApiKeyStore.getState();
    const id = store.addKey({
      provider: "Gemini",
      label: "gemini-1",
      apiKey: "test_key",
    });

    store.markKeyExhausted(id, 24);
    const key = useApiKeyStore.getState().keys.find((k) => k.id === id);
    expect(key?.status).toBe("quota_exhausted");
    expect(key?.quotaExhaustedAt).toBeTypeOf("number");
    expect(key?.resetAt).toBeTypeOf("number");
    expect(key?.failCount).toBe(1);

    // Active keys should now be empty
    expect(useApiKeyStore.getState().getActiveKeys("Gemini").length).toBe(0);
    expect(useApiKeyStore.getState().providerAllExhausted("Gemini")).toBe(true);
  });

  it("auto resets exhausted keys when resetAt timestamp is reached", () => {
    const store = useApiKeyStore.getState();
    const id = store.addKey({
      provider: "OpenRouter",
      label: "openrouter-1",
      apiKey: "test_or_key",
    });

    // Artificially mark key exhausted in the past
    useApiKeyStore.getState().setKeyStatus(id, "quota_exhausted", Date.now() - 5000, Date.now() - 1000);

    expect(useApiKeyStore.getState().getActiveKeys("OpenRouter").length).toBe(0);

    // Run checkQuotaReset
    useApiKeyStore.getState().checkQuotaReset();

    const activeKeys = useApiKeyStore.getState().getActiveKeys("OpenRouter");
    expect(activeKeys.length).toBe(1);
    expect(activeKeys[0].status).toBe("active");
  });

  it("selects next active key using least-recently-used (LRU) order", () => {
    const store = useApiKeyStore.getState();
    const id1 = store.addKey({ provider: "Groq", label: "g-1", apiKey: "key1" });
    const id2 = store.addKey({ provider: "Groq", label: "g-2", apiKey: "key2" });

    // Initially both have lastUsedAt null; picks first
    const firstPick = store.getNextActiveKey("Groq");
    expect(firstPick?.id).toBe(id1);

    // Mark id1 as used just now
    store.updateKey(id1, { lastUsedAt: Date.now() });

    // Next active key should be id2 because it hasn't been used yet (null)
    const secondPick = useApiKeyStore.getState().getNextActiveKey("Groq");
    expect(secondPick?.id).toBe(id2);
  });
});
