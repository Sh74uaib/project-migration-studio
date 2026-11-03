import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Search,
  Settings,
  Mic,
  ArrowRight,
  Sun,
  Sparkles,
  Plus,
  Trash2,
  AlertCircle,
  X,
  Bell,
} from "lucide-react";
import news from "@/assets/news.jpg";
import { AgentChat } from "@/components/agent-chat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NotesCard, WatchlistCard, usePersisted, usePersonalData } from "@/components/personal-tools";
import { seedDefaultKeys, useApiKeyStore } from "@/lib/api-key-store";
import { useApiRouter } from "@/hooks/use-api-router";
import { SettingsDialog } from "@/components/settings-dialog";
import {
  DEFAULT_INTELLIGENCE_AGENTS,
  getAgentIcon,
  type CustomAgentItem,
} from "@/lib/sources";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ORION — The world, understood" },
      { name: "description", content: "Your personal intelligence for everything happening today." },
      { property: "og:title", content: "ORION — The world, understood" },
      { property: "og:description", content: "Your personal intelligence for everything happening today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// Map DEFAULT_INTELLIGENCE_AGENTS to the agent shape used by the grid + AgentChat
const defaultAgents = DEFAULT_INTELLIGENCE_AGENTS.map((a) => ({
  icon: a.icon,
  name: a.name,
  desc: a.desc,
  id: a.id,
  isSuperAgent: a.isSuperAgent,
}));

const stories = [
  ["Bangladesh achieves tech export milestone", "2m"],
  ["Dhaka metro expands to two new stations", "13m"],
  ["Monsoon season ends earlier than forecast", "19m"],
  ["Garment exports rise 8% in third quarter", "41m"],
];

function Index() {
  const [now, setNow] = useState<Date | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState("Bangladesh");
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsProvider, setSettingsProvider] = useState<string | undefined>();
  const [searchResults, setSearchResults] = useState<{ title: string; url: string; snippet: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const me = usePersonalData();
  const { searchWithFallback } = useApiRouter();
  const { alerts, markAlertRead } = useApiKeyStore();
  const unreadAlerts = alerts.filter((a) => !a.read);

  const [custom, setCustom] = usePersisted<CustomAgentItem[]>("orion.customAgents", []);
  const [hidden, setHidden] = usePersisted<string[]>("orion.hiddenAgents", []);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDomains, setNewDomains] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  const customAgentItems = custom.map((c) => ({
    icon: getAgentIcon(c.iconName),
    name: c.name,
    desc: c.desc || "Your custom agent.",
    id: c.id || c.name.toLowerCase().replace(/\s+/g, "-"),
    isSuperAgent: false,
  }));

  const allAgents = [...defaultAgents, ...customAgentItems];
  const visibleAgents = allAgents.filter((a) => !hidden.includes(a.name));

  const createAgent = (name: string, desc: string, domainsStr: string, prompt: string) => {
    const n = name.trim();
    if (!n) return false;
    // If existing agent was hidden, just unhide it
    if (allAgents.some((a) => a.name.toLowerCase() === n.toLowerCase())) {
      const existing = allAgents.find((a) => a.name.toLowerCase() === n.toLowerCase())!;
      setHidden(hidden.filter((x) => x !== existing.name));
      return true;
    }
    const domains = domainsStr
      .split(",")
      .map((d) => d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
      .filter(Boolean);
    const newAgent: CustomAgentItem = {
      id: n.toLowerCase().replace(/\s+/g, "-"),
      name: n,
      desc: desc.trim() || `${n} intelligence agent.`,
      ...(domains.length > 0 ? { domains } : {}),
      ...(prompt.trim() ? { systemPrompt: prompt.trim() } : {}),
    };
    setCustom([...custom, newAgent]);
    return true;
  };

  const deleteAgent = (name: string) => {
    // Only hide from view — preserve chat history
    setHidden([...hidden, name]);
    const fallback = visibleAgents.find((a) => a.name !== name)?.name ?? defaultAgents[0]?.name ?? "";
    if (active === name) setActive(fallback);
  };

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    seedDefaultKeys();
  }, []);

  async function handleSearch(query: string) {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const result = await searchWithFallback(query.trim());
      if (result.success && result.items.length > 0) {
        setSearchResults(result.items);
      }
    } finally {
      setSearching(false);
    }
  }

  const tz = "Asia/Dhaka";
  const eng = now?.toLocaleDateString("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }) ?? "Friday 16 October 2026";
  const time = now?.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }) ?? "3:10 PM";
  const hijri = now ? new Intl.DateTimeFormat("bn-BD-u-ca-islamic", { timeZone: tz, day: "numeric", month: "long", year: "numeric" }).format(now).replace(/ যুগ.*$/, "") : "১৪ রবিউস সানি ১৪৪৮";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-6 px-5">
          <span className="flex items-center gap-2 text-[18px] font-bold tracking-[0.2em]">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" /> ORION
          </span>
          <label className="ml-auto hidden h-10 w-full max-w-[380px] items-center gap-2 rounded-full border border-border bg-card px-4 md:flex">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(q); }}
              placeholder="Search world intelligence..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border border-border px-1.5 text-[10px] text-muted-foreground">⌘K</kbd>
            {searching && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand" />}
            {!searching && q.trim() && searchResults.length > 0 && <button onClick={() => handleSearch(q)} className="text-xs text-brand underline">অনুসন্ধান করুন</button>}
          </label>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link to="/feed" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">Feed</Link>
            <button
              onClick={() => {
                setSettingsProvider(undefined);
                setSettingsOpen(true);
              }}
              className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-card transition-colors"
              title="নোটিফিকেশন ও অ্যালার্ট"
            >
              <Bell className="h-4 w-4" />
              {unreadAlerts.length > 0 && (
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
              )}
            </button>
            <button
              onClick={() => {
                setSettingsProvider(undefined);
                setSettingsOpen(true);
              }}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-card transition-colors"
              title="API কী ও রাউটার সেটিংস"
            >
              <Settings className="h-4 w-4" />
            </button>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-semibold text-ink-foreground">R</span>
          </div>
        </div>
      </header>

      {/* Global Quota Alerts Banner */}
      {unreadAlerts.length > 0 && (
        <section className="mx-auto max-w-[1160px] px-5 pt-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-center justify-between gap-3 text-xs text-foreground">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <span>{unreadAlerts[0]?.message}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs px-3"
                onClick={() => {
                  if (unreadAlerts[0]?.provider !== undefined) setSettingsProvider(unreadAlerts[0].provider);
                  setSettingsOpen(true);
                }}
              >
                নতুন কী যোগ করুন
              </Button>
              <button
                onClick={() => markAlertRead(unreadAlerts[0]?.id ?? "")}
                className="p-1 text-muted-foreground hover:text-foreground"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <section className="mx-auto max-w-[1160px] px-5 my-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">অনুসন্ধান ফলাফল</h2>
            <button onClick={() => setSearchResults([])} className="text-xs text-muted-foreground hover:text-foreground">
              মুছে ফেলুন ✕
            </button>
          </div>
          <div className="grid gap-3">
            {searchResults.map((r, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <a href={r.url} target="_blank" rel="noreferrer" className="text-brand font-medium hover:underline">{r.title}</a>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.snippet}</p>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground">{r.url}</a>
              </div>
            ))}
          </div>
        </section>
      )}

      <main className="mx-auto max-w-[1160px] px-5">
        {/* Hero card */}
        <section className="relative mt-6 overflow-hidden rounded-[28px] bg-ink px-6 py-14 text-ink-foreground md:px-14 md:py-20">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/40 blur-3xl" />
          <div className="relative grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-foreground/20 px-3 py-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Your personal intelligence
              </span>
              <h1 className="mt-6 font-display text-[52px] leading-[0.95] tracking-tight md:text-[84px]">
                The world, <em className="text-brand-soft">understood.</em>
              </h1>
              <p className="mt-5 max-w-md text-[15px] text-ink-foreground/70">Everything happening today — summarized, connected, and explained in seconds.</p>
              <label className="mt-8 flex h-14 max-w-[560px] items-center gap-3 rounded-2xl bg-ink-foreground px-5 text-ink">
                <Sparkles className="h-4 w-4 text-brand" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about today's world..." className="w-full bg-transparent text-[15px] outline-none placeholder:text-ink/50" />
                <Mic className="h-4 w-4 text-ink/60" />
                <button onClick={() => { setActive("Technology"); setChatOpen(true); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-ink-foreground"><ArrowRight className="h-4 w-4" /></button>
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                {["আজকের সবচেয়ে গুরুত্বপূর্ণ ৫টি খবর কী?", "Summarize today's Bangladesh politics.", "What moved the markets?"].map((c) => (
                  <button key={c} onClick={() => { setActive("Bangladesh"); setChatOpen(true); }} className="rounded-full border border-ink-foreground/20 px-3 py-1.5 text-xs text-ink-foreground/80 transition hover:bg-ink-foreground/10">{c}</button>
                ))}
              </div>
            </div>

            {/* Date & weather panel */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-foreground/15 bg-ink-foreground/15">
              {[
                ["English", eng],
                ["বাংলা", "১ কার্তিক ১৪৩৩"],
                ["Hijri", hijri],
                ["Dhaka time", time],
              ].map(([l, v]) => (
                <div key={l} className="bg-ink p-4">
                  <div className="text-[11px] uppercase tracking-widest text-ink-foreground/50">{l}</div>
                  <div className="mt-1.5 text-sm font-medium">{v}</div>
                </div>
              ))}
              <div className="col-span-2 flex items-center gap-4 bg-ink p-4">
                <Sun className="h-10 w-10 text-sun" />
                <div>
                  <div className="font-display text-3xl">31°C</div>
                  <div className="text-xs text-ink-foreground/70">Dhaka · Mostly Sunny · Air Quality: 118 Moderate</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Intelligence sectors */}
        <section className="mt-14">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Intelligence sectors</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pick a sector to talk with its specialized agent.</p>
            </div>
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> কাস্টম এজেন্ট
            </button>
          </div>

          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setNewName(""); setNewDesc(""); setNewDomains(""); setNewPrompt(""); } }}>
            <DialogContent className="max-w-lg">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand" />
                কাস্টম এজেন্ট তৈরি করুন
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                নিজের পছন্দের যেকোনো বিষয়ে ডেডিকেটেড ইন্টেলিজেন্স এজেন্ট তৈরি করুন।
              </DialogDescription>
              <div className="mt-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">এজেন্টের নাম <span className="text-destructive">*</span></label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="যেমন: AI Hardware, Cricket, Crypto"
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-brand/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">সংক্ষিপ্ত বিবরণ</label>
                  <input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="যেমন: GPUs, AI chips, semiconductors & tech news"
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-brand/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">টার্গেটেড সোর্স ডোমেইন (কমা দিয়ে আলাদা করুন)</label>
                  <input
                    value={newDomains}
                    onChange={(e) => setNewDomains(e.target.value)}
                    placeholder="যেমন: techcrunch.com, wired.com, bloomberg.com"
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-brand/60 font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">এই ডোমেইন থেকে রিয়েল-টাইম তথ্য ফিল্টার করা হবে।</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">কাস্টম সিস্টেম প্রম্পট (ঐচ্ছিক)</label>
                  <textarea
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="এজেন্টের পার্সোনা ও নির্দেশনা লিখুন…"
                    rows={3}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-brand/60 resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setAddOpen(false)} className="rounded-xl px-4 py-2 text-xs text-muted-foreground hover:bg-card">বাতিল</button>
                  <button
                    onClick={() => {
                      if (createAgent(newName, newDesc, newDomains, newPrompt)) {
                        setNewName(""); setNewDesc(""); setNewDomains(""); setNewPrompt("");
                        setAddOpen(false);
                      }
                    }}
                    disabled={!newName.trim()}
                    className="rounded-xl bg-ink px-5 py-2 text-xs font-semibold text-ink-foreground disabled:opacity-50"
                  >
                    এজেন্ট তৈরি করুন
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {visibleAgents.map((a) => {
              const Icon = a.icon;
              const isSelected = active === a.name;
              const isCustom = custom.some((c) => c.name === a.name);
              const isSuper = (a as any).isSuperAgent;
              return (
                <div
                  key={a.name}
                  onClick={() => { setActive(a.name); setChatOpen(true); }}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition ${
                    isSelected
                      ? isSuper ? "border-brand bg-brand/10" : "border-brand bg-tile-active"
                      : isSuper ? "border-brand/30 bg-card hover:border-brand/60" : "border-border bg-card hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`grid h-10 w-10 place-items-center rounded-xl ${isSuper ? "bg-brand-soft" : "bg-background"}`}>
                      <Icon className={`h-5 w-5 ${isSuper ? "text-brand" : "text-foreground"}`} />
                    </div>
                    {isCustom && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteAgent(a.name); }}
                        className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        title="এজেন্ট হাইড করুন (হিস্ট্রি অক্ষুণ্ণ থাকবে)"
                        aria-label="এজেন্ট হাইড করুন"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-6">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <span className="truncate">{a.name}</span>
                      {isSuper && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">
                          Omni
                        </span>
                      )}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{a.desc}</div>
                  </div>
                </div>
              );
            })}
            {/* + Create Agent card */}
            <div
              onClick={() => setAddOpen(true)}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-4 text-muted-foreground transition hover:border-brand/50 hover:text-brand gap-2 min-h-[120px]"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs font-medium text-center">কাস্টম এজেন্ট</span>
            </div>
          </div>
        </section>

        {/* Today's briefing */}
        <section className="mt-14 mb-16">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-bold tracking-tight">Today's briefing</h2>
            <span className="text-xs text-muted-foreground">Updated continuous</span>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-[1.6fr_1fr]">
            <article className="overflow-hidden rounded-2xl border border-border bg-card">
              <img src={news} alt="Lead story" className="h-64 w-full object-cover" />
              <div className="p-6">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">Business</span>
                  <span className="text-xs text-muted-foreground">3 min read</span>
                </div>
                <h3 className="mt-4 font-display text-[34px] leading-tight">Bangladesh achieves tech export milestone</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Software and IT services exports crossed a new record this year, driven by a fast-growing community of startups and freelancers.</p>
                <div className="mt-4 text-xs text-muted-foreground">Publisher · 12 hours ago</div>
              </div>
            </article>

            <div className="flex flex-col gap-6">
              <WatchlistCard watchlist={me.watchlist} onAdd={me.addTopic} onRemove={me.removeTopic} />
              <NotesCard notes={me.notes} onRemove={me.removeNote} />
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Important stories</span>
                  <a className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">See more <ArrowRight className="h-3 w-3" /></a>
                </div>
                <ol className="mt-3">
                  {stories.map(([t, m], i) => (
                    <li key={i} className="flex cursor-pointer items-baseline gap-4 border-b border-border py-3.5 last:border-0 hover:text-brand">
                      <span className="font-display text-2xl text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1 text-sm font-medium">{t}</span>
                      <span className="text-xs text-muted-foreground">{m}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-2xl bg-brand-soft p-6">
                <span className="text-sm font-semibold">Trending topics</span>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["#TechExports", "Industries", "Gaming", "Sports", "Cricket", "Climate", "Elections"].map((t) => (
                    <span key={t} className="cursor-pointer rounded-full bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-ink hover:text-ink-foreground">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <AgentChat
        agents={visibleAgents.length ? visibleAgents : defaultAgents}
        active={active}
        open={chatOpen}
        onOpenChange={setChatOpen}
        onAgentChange={setActive}
        watchlist={me.watchlist}
        onSaveNote={me.saveNote}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        {...(settingsProvider !== undefined ? { initialProvider: settingsProvider } : {})}
      />
    </div>
  );
}
