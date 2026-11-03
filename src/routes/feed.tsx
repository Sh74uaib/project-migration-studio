import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, MessageCircle, RefreshCw, X } from "lucide-react";
import { AgentChat } from "@/components/agent-chat";
import { usePersonalData } from "@/components/personal-tools";
import { useApiRouter } from "@/hooks/use-api-router";
import { seedDefaultKeys } from "@/lib/api-key-store";
import { DEFAULT_INTELLIGENCE_AGENTS } from "@/lib/sources";
import { buildRewritePrompt, parseArticles, todayKey, type FeedArticle } from "@/lib/feed";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "ORION Feed — আজকের সেক্টরভিত্তিক খবর" },
      { name: "description", content: "AI দিয়ে বিশ্লেষণ ও পুনর্লিখিত আজকের পরিষ্কার, সেক্টরভিত্তিক খবর।" },
      { property: "og:title", content: "ORION Feed — আজকের সেক্টরভিত্তিক খবর" },
      { property: "og:description", content: "AI দিয়ে বিশ্লেষণ ও পুনর্লিখিত আজকের পরিষ্কার, সেক্টরভিত্তিক খবর।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeedPage,
});

const sectors = DEFAULT_INTELLIGENCE_AGENTS.filter((a) => !a.isSuperAgent);
const chatAgents = DEFAULT_INTELLIGENCE_AGENTS.map((a) => ({ name: a.name, desc: a.desc, icon: a.icon }));

function FeedPage() {
  const [sectorId, setSectorId] = useState(sectors[0]!.id);
  const sector = sectors.find((s) => s.id === sectorId)!;
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<FeedArticle | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState(sector.name);
  const [question, setQuestion] = useState<string | undefined>();
  const me = usePersonalData();
  const { searchWithFallback, chatWithFallback } = useApiRouter();

  useEffect(() => { seedDefaultKeys(); }, []);

  const load = useCallback(async (force = false) => {
    const key = todayKey(sector.id);
    if (!force) {
      const cached = localStorage.getItem(key);
      if (cached) { setArticles(JSON.parse(cached)); setError(null); return; }
    }
    setLoading(true); setError(null); setArticles([]);
    try {
      const search = await searchWithFallback(`${sector.name.replace(" Intelligence", "")} latest news today`, sector.domains);
      if (!search.success || !search.items.length) throw new Error("আজকের খবর পাওয়া যায়নি।");
      const res = await chatWithFallback({
        messages: [
          { role: "system", content: "You are a careful news editor. Output strict JSON only." },
          { role: "user", content: buildRewritePrompt(sector.name, search.items) },
        ],
        maxTokens: 3500,
      });
      const list = parseArticles(res.success ? res.content : "", search.items);
      setArticles(list);
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : "কিছু একটা ভুল হয়েছে।");
    } finally {
      setLoading(false);
    }
  }, [sector, searchWithFallback, chatWithFallback]);

  useEffect(() => { void load(); }, [sectorId]); // eslint-disable-line react-hooks/exhaustive-deps

  function ask(q?: string) {
    setChatAgent(sector.name);
    setQuestion(q);
    setChatOpen(true);
  }

  const [lead, ...rest] = articles;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-4 px-5">
          <Link to="/" className="flex items-center gap-2 text-[18px] font-bold tracking-[0.2em]">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" /> ORION
          </Link>
          <span className="text-sm text-muted-foreground">Feed</span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/" className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <ArrowLeft className="h-3.5 w-3.5" /> হোম
            </Link>
            <button onClick={() => ask("আজকের এই সেক্টরের সব খবরের একটা সংক্ষিপ্ত ব্রিফিং দাও")} className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-ink-foreground">
              <MessageCircle className="h-3.5 w-3.5" /> Assistant
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1160px] gap-2 overflow-x-auto px-5 pb-3">
          {sectors.map((s) => (
            <button key={s.id} onClick={() => setSectorId(s.id)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition ${s.id === sectorId ? "bg-ink text-ink-foreground" : "bg-card border border-border hover:bg-muted"}`}>
              {s.shortName ?? s.name}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[860px] px-5 py-10">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="font-display text-4xl">{sector.name.replace(" Intelligence", "")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">আজকের খবর — AI দিয়ে বিশ্লেষণ ও পুনর্লিখিত</p>
          </div>
          <button onClick={() => load(true)} disabled={loading} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> রিফ্রেশ
          </button>
        </div>

        {loading && (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-muted-foreground">খবর সংগ্রহ ও AI দিয়ে সাজানো হচ্ছে…</p>
            {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        )}
        {error && !loading && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm">
            {error} <button onClick={() => load(true)} className="ml-2 text-brand underline">আবার চেষ্টা করুন</button>
          </div>
        )}

        {lead && !loading && (
          <article onClick={() => setReading(lead)} className="mt-8 cursor-pointer rounded-2xl border border-border bg-card p-8 transition hover:shadow-md">
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">প্রধান খবর</span>
            <h2 className="mt-4 font-display text-[34px] leading-tight">{lead.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{lead.summary}</p>
            <div className="mt-4 text-xs text-muted-foreground">{lead.source} · {lead.readMin} মিনিট পড়া</div>
          </article>
        )}

        {!loading && rest.map((a) => (
          <article key={a.id} onClick={() => setReading(a)} className="cursor-pointer border-b border-border py-6 last:border-0 hover:text-brand">
            <h3 className="text-lg font-semibold leading-snug">{a.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a.summary}</p>
            <div className="mt-2 text-xs text-muted-foreground">{a.source} · {a.readMin} মিনিট</div>
          </article>
        ))}
      </main>

      {reading && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-background" role="dialog" aria-modal="true">
          <div className="mx-auto max-w-[720px] px-5 py-10">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">{sector.shortName ?? sector.name}</span>
              <button onClick={() => setReading(null)} aria-label="বন্ধ করুন" className="grid size-9 place-items-center rounded-full border border-border hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <h1 className="mt-6 font-display text-[40px] leading-tight">{reading.title}</h1>
            <p className="mt-3 text-lg text-muted-foreground">{reading.summary}</p>
            {reading.keyPoints.length > 0 && (
              <ul className="mt-6 space-y-2 rounded-2xl bg-brand-soft p-5 text-sm">
                {reading.keyPoints.map((k, i) => <li key={i} className="flex gap-2"><span className="text-brand">•</span>{k}</li>)}
              </ul>
            )}
            <div className="mt-8 space-y-5 text-[17px] leading-8">
              {reading.body.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6">
              <button onClick={() => ask(`এই খবরটা নিয়ে আরও ব্যাখ্যা করো: "${reading.title}"`)} className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground">
                <MessageCircle className="h-4 w-4" /> Assistant-কে জিজ্ঞেস করুন
              </button>
              {reading.url && reading.url !== "#" && (
                <a href={reading.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  মূল সূত্র: {reading.source} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <AgentChat
        agents={chatAgents}
        active={chatAgent}
        open={chatOpen}
        onOpenChange={(o) => { setChatOpen(o); if (!o) setQuestion(undefined); }}
        onAgentChange={setChatAgent}
        watchlist={me.watchlist}
        onSaveNote={me.saveNote}
        {...(question ? { initialQuestion: question } : {})}
      />
    </div>
  );
}
