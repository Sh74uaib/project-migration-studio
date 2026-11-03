import { createServerFn } from "@tanstack/react-start";

export interface ProxyApiPayload {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface ProxyApiResponse {
  ok: boolean;
  status: number;
  data: any;
  error?: string;
}

export const proxyApiCall = createServerFn({ method: "POST" })
  .validator((data: ProxyApiPayload) => data)
  .handler(async ({ data }: { data: ProxyApiPayload }): Promise<ProxyApiResponse> => {
    try {
      const response = await fetch(data.url, {
        method: data.method || "GET",
        headers: data.headers || {},
        body: data.body,
      });

      const text = await response.text();
      let parsedData: any = text;
      try {
        parsedData = JSON.parse(text);
      } catch {
        // Return raw text if not valid JSON
      }

      return {
        ok: response.ok,
        status: response.status,
        data: parsedData,
        ...(response.ok
          ? {}
          : {
              error:
                typeof parsedData === "string"
                  ? parsedData
                  : JSON.stringify(parsedData),
            }),
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 500,
        data: null,
        error: err?.message || "Server proxy execution failed",
      };
    }
  });
