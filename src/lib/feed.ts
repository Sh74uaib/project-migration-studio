import type { SearchResultItem } from "@/hooks/use-api-router";

export type FeedArticle = {
  id: string;
  title: string;
  summary: string;
  body: string[];
  keyPoints: string[];
  source: string;
  url: string;
  readMin: number;
};

export function todayKey(sectorId: string, d = new Date()) {
  const day = d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  return `orion.feed.${sectorId}.${day}`;
}

export function buildRewritePrompt(sectorName: string, items: SearchResultItem[]) {
  const list = items
    .slice(0, 8)
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nSource: ${r.source ?? ""}\n${r.snippet}`)
    .join("\n\n");
  return `You are ORION's editorial desk for "${sectorName}". Below are today's raw news results.
Analyze them, merge duplicates, drop irrelevant ones, and rewrite each real story as a clean, neutral, easy-to-read article in fluent Bengali.

Return ONLY a JSON array (no markdown, no commentary) of up to 6 objects:
{"title": string, "summary": string (1-2 sentences), "body": string[] (3-5 short paragraphs), "keyPoints": string[] (3 bullets), "source": string, "url": string, "readMin": number}

Use only facts present in the results. Keep the original url.

RESULTS:
${list}`;
}

export function parseArticles(raw: string, fallback: SearchResultItem[]): FeedArticle[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  try {
    if (start === -1 || end <= start) throw new Error("no json");
    const arr = JSON.parse(raw.slice(start, end + 1)) as Partial<FeedArticle>[];
    const out = arr
      .filter((a) => a && typeof a.title === "string" && a.title.trim())
      .map((a, i) => ({
        id: `${i}-${a.title!.slice(0, 20)}`,
        title: a.title!.trim(),
        summary: String(a.summary ?? ""),
        body: Array.isArray(a.body) ? a.body.map(String) : [String(a.body ?? a.summary ?? "")],
        keyPoints: Array.isArray(a.keyPoints) ? a.keyPoints.map(String) : [],
        source: String(a.source ?? ""),
        url: String(a.url ?? "#"),
        readMin: Number(a.readMin) || 2,
      }));
    if (out.length) return out;
  } catch {
    /* fall through */
  }
  return fallback.slice(0, 6).map((r, i) => ({
    id: `raw-${i}`,
    title: r.title,
    summary: r.snippet,
    body: [r.snippet],
    keyPoints: [],
    source: r.source ?? "",
    url: r.url,
    readMin: 1,
  }));
}
