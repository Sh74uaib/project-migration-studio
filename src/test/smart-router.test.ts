import { describe, it, expect, beforeEach, vi } from "vitest";
import { useApiKeyStore } from "@/lib/api-key-store";
import * as serverProxy from "@/lib/server-api-proxy";
import { renderHook, act } from "@testing-library/react";
import { useApiRouter } from "@/hooks/use-api-router";

describe("Smart API Router & Failover", () => {
  beforeEach(() => {
    useApiKeyStore.setState({ keys: [], providers: [], alerts: [] });
    vi.restoreAllMocks();
  });

  it("handles 429 rate limit by switching to the next active key without dropping the request", async () => {
    const store = useApiKeyStore.getState();
    const id1 = store.addKey({
      provider: "Groq",
      label: "groq-acc1",
      apiKey: "gsk_acc1",
      emailAccount: "acc1@gmail.com",
    });
    const id2 = store.addKey({
      provider: "Groq",
      label: "groq-acc2",
      apiKey: "gsk_acc2",
      emailAccount: "acc2@gmail.com",
    });

    // Mock proxyApiCall: first call returns 429, second call returns 200 OK
    const proxyMock = vi.spyOn(serverProxy, "proxyApiCall").mockImplementation(async (opts: any) => {
      const headers = opts?.data?.headers || {};
      const auth = headers["Authorization"] || "";
      if (auth.includes("gsk_acc1")) {
        return {
          ok: false,
          status: 429,
          data: { error: { message: "Rate limit reached" } },
          error: "Rate limit reached",
        };
      }
      return {
        ok: true,
        status: 200,
        data: { choices: [{ message: { content: "Success response from acc2" } }] },
      };
    });

    const { result } = renderHook(() => useApiRouter());

    let fetchResult: any;
    await act(async () => {
      fetchResult = await result.current.smartFetch({
        provider: "Groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        body: { messages: [{ role: "user", content: "Hi" }] },
      });
    });

    expect(fetchResult.success).toBe(true);
    expect(fetchResult.keyUsed?.id).toBe(id2);
    expect(fetchResult.attempts).toBe(2);

    // Key 1 must be marked as quota_exhausted with reset timestamp
    const key1 = useApiKeyStore.getState().keys.find((k) => k.id === id1);
    expect(key1?.status).toBe("quota_exhausted");
    expect(key1?.resetAt).toBeGreaterThan(Date.now());

    // Key 2 must remain active and have lastUsedAt updated
    const key2 = useApiKeyStore.getState().keys.find((k) => k.id === id2);
    expect(key2?.status).toBe("active");
    expect(key2?.lastUsedAt).toBeTypeOf("number");
  });

  it("triggers all_keys_exhausted alert when all keys for a provider fail with 429", async () => {
    const store = useApiKeyStore.getState();
    store.addKey({ provider: "Gemini", label: "gemini-1", apiKey: "g_key1" });
    store.addKey({ provider: "Gemini", label: "gemini-2", apiKey: "g_key2" });

    vi.spyOn(serverProxy, "proxyApiCall").mockResolvedValue({
      ok: false,
      status: 429,
      data: { error: "Resource exhausted" },
      error: "Resource exhausted",
    });

    const { result } = renderHook(() => useApiRouter());

    let fetchResult: any;
    await act(async () => {
      fetchResult = await result.current.smartFetch({
        provider: "Gemini",
        url: "https://generativelanguage.googleapis.com",
      });
    });

    expect(fetchResult.success).toBe(false);
    expect(useApiKeyStore.getState().providerAllExhausted("Gemini")).toBe(true);

    const alerts = useApiKeyStore.getState().alerts;
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((a) => a.provider === "Gemini" && a.type === "all_keys_exhausted")).toBe(true);
  });
});
