import { useEffect, useRef, useState } from "react";
import { usePersisted } from "@/components/personal-tools";
import { useApiRouter, type ChatMessage, type SearchResultItem } from "@/hooks/use-api-router";
import {
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
  Settings,
  ExternalLink,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SettingsDialog } from "@/components/settings-dialog";
import { findAgentConfig, type CustomAgentItem } from "@/lib/sources";

type Agent = { name: string; desc: string; icon: LucideIcon };
type Message = {
  role: "user" | "agent";
  text: string;
  citations?: SearchResultItem[];
  sourcesUsed?: string[];
};

type Props = {
  agents: Agent[];
  active: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentChange: (name: string) => void;
  watchlist: string[];
  onSaveNote: (sector: string, text: string) => void;
};

export function AgentChat({
  agents,
  active,
  open,
  onOpenChange,
  onAgentChange,
  watchlist,
  onSaveNote,
}: Props) {
  const [customAgents] = usePersisted<CustomAgentItem[]>("orion.customAgents", []);
  const [histories, setHistories] = usePersisted<Record<string, Message[]>>("orion.histories", {});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Retrieve rich agent configuration (system prompt, targeted domains, suggested prompts)
  const agentConfig = findAgentConfig(active, customAgents);
  const agent = agents.find((item) => item.name === active) ?? {
    name: agentConfig.name,
    desc: agentConfig.desc,
    icon: agentConfig.icon,
  };
  const messages = histories[active] ?? [];

  const { chatWithFallback, isRotating } = useApiRouter();

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "auto" }); }, [messages, pending, open]);
  useEffect(() => { setDraft(""); }, [active]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onOpenChange]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    const sector = active;
    setHistories((previous) => ({
      ...previous,
      [sector]: [...(previous[sector] ?? []), { role: "user", text: question }],
    }));
    setDraft("");
    setPending(sector);

    const chatMessages: ChatMessage[] = [
      { role: "system", content: agentConfig.systemPrompt },
      ...messages.slice(-10).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
      { role: "user", content: question },
    ];

    try {
      const result = await chatWithFallback({
        messages: chatMessages,
        domains: agentConfig.domains,
        grounded: true,
        preferredModel: agentConfig.preferredModel,
        agentName: active,
      });

      setLastProvider(result.provider);

      if (result.success && result.content) {
        setHistories((previous) => ({
          ...previous,
          [sector]: [
            ...(previous[sector] ?? []),
            {
              role: "agent",
              text: result.content,
              citations: result.citations,
              sourcesUsed: agentConfig.domains,
            },
          ],
        }));
      } else {
        const bengali = /[\u0980-\u09FF]/.test(question);
        const fallback = bengali
          ? `ক্ষমা করুন, সমস্ত AI প্রোভাইডারের কোটা এই মুহুর্তে শেষ হয়েছে। সেটিংস প্যানেলে গিয়ে নতুন API কী যোগ করুন।\n\nআপনার প্রশ্ন: “${question}”`
          : `Sorry, all LLM provider quotas are currently exhausted. Please add new API keys from the Settings panel.\n\nYour question: “${question}”`;
        setHistories((previous) => ({
          ...previous,
          [sector]: [...(previous[sector] ?? []), { role: "agent", text: fallback }],
        }));
      }
    } catch (err: any) {
      setHistories((previous) => ({
        ...previous,
        [sector]: [...(previous[sector] ?? []), { role: "agent", text: `ত্রুটি: ${err.message}` }],
      }));
    } finally {
      setPending(null);
      timer.current = null;
    }
  }

  if (!open || !agent) return null;
  const Icon = agent.icon;
  const suggestedPrompts = agentConfig.prompts && agentConfig.prompts.length > 0
    ? agentConfig.prompts
    : ["আজকের মূল খবরগুলো বলো", "কেন এটা গুরুত্বপূর্ণ?", "Give me a quick briefing"];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`${active} agent conversation`}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-soft/70 to-transparent" />

      {/* Header */}
      <header className="relative border-b border-border bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[860px] items-center gap-4 px-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold flex items-center gap-2">
              <span>{agentConfig.name}</span>
              {agentConfig.isSuperAgent && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">
                  Omni Brain
                </span>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground flex items-center gap-2">
              <span>{agentConfig.desc}</span>
              {lastProvider && <span className="text-foreground/70">· via {lastProvider}</span>}
            </div>
          </div>
          <select
            aria-label="Switch sector"
            value={active}
            onChange={(e) => onAgentChange(e.target.value)}
            className="ml-auto h-9 max-w-[170px] rounded-full border border-border bg-card px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
          >
            {agents.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            title="New conversation"
            aria-label="New conversation"
            disabled={pending !== null || messages.length === 0}
            onClick={() => {
              setHistories((previous) => ({ ...previous, [active]: [] }));
              setSaved({});
            }}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="API কী ও রাউটার সেটিংস"
            aria-label="API Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            title="Back to home"
            aria-label="Back to home"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Targeted sources domain strip */}
        {agentConfig.domains && agentConfig.domains.length > 0 && (
          <div className="border-t border-border/50 bg-card/30 px-5 py-1.5 text-[11px] text-muted-foreground">
            <div className="mx-auto max-w-[860px] flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="shrink-0 flex items-center gap-1 font-medium text-foreground/80">
                <Globe className="size-3 text-brand" /> সোর্স ফিল্টার:
              </span>
              <div className="flex items-center gap-1.5 flex-nowrap">
                {agentConfig.domains.map((domain) => (
                  <span
                    key={domain}
                    className="shrink-0 rounded-md border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground font-mono"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Conversation */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[860px] px-5 py-10">
          {messages.length === 0 ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
              <span className="grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Icon className="size-8" strokeWidth={1.5} />
              </span>
              <h2 className="mt-6 font-display text-4xl leading-tight md:text-5xl">
                Let’s catch up<br />on <em className="text-brand">{active}.</em>
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                আমি আপনার {agentConfig.name}। আসল AI মডেল এবং ভেরিফাইড সোর্স ফিল্টারিংয়ের সাথে সংযুক্ত। খবর ও তথ্য নিয়ে প্রশ্ন করুন।
              </p>
              {watchlist.length > 0 && (
                <div className="mt-5 max-w-md rounded-xl bg-brand-soft p-3 text-xs leading-relaxed text-foreground">
                  Watchlist: {watchlist.join(", ")} — এসব নিয়ে আপডেট থাকলে আমি গুরুত্ব দেব।
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                {suggestedPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outline"
                    className="h-auto rounded-full px-4 py-2.5 text-xs"
                    disabled={pending !== null}
                    onClick={() => send(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8" aria-live="polite" role="log" aria-label={`${active} conversation`}>
              {messages.map((message, index) => (
                <div key={index} className={message.role === "user" ? "flex justify-end" : "flex gap-3"}>
                  {message.role === "agent" && (
                    <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <Icon className="size-4" />
                    </span>
                  )}
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[75%] rounded-2xl rounded-br-md bg-ink px-5 py-3.5 text-ink-foreground"
                        : "min-w-0 flex-1"
                    }
                  >
                    <div
                      className={`mb-1.5 text-xs font-semibold ${
                        message.role === "user" ? "text-ink-foreground/60" : "text-brand"
                      }`}
                    >
                      {message.role === "user" ? "You" : `${agentConfig.name}`}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.text}
                    </p>

                    {/* Citations and Sources Badges */}
                    {message.role === "agent" && (
                      <div className="mt-4 border-t border-border/40 pt-3 space-y-2">
                        {message.citations && message.citations.length > 0 ? (
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                              <ShieldCheck className="size-3.5 text-emerald-500" />
                              <span>প্রামাণ্য সোর্স ও সাইটেশন ({message.citations.length}):</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {message.citations.map((c, cIdx) => (
                                <a
                                  key={cIdx}
                                  href={c.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`${c.title} — ${c.url}`}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-brand/70 hover:text-brand hover:bg-brand-soft/40 shadow-xs max-w-[280px] truncate"
                                >
                                  <ExternalLink className="size-3 shrink-0 text-brand" />
                                  <span className="font-semibold shrink-0 text-foreground/80">
                                    {c.source || "Source"}:
                                  </span>
                                  <span className="truncate">{c.title}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(agentConfig.domains || []).slice(0, 4).map((dom) => (
                              <a
                                key={dom}
                                href={`https://${dom}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-brand hover:text-brand"
                              >
                                <ShieldCheck className="size-3 text-emerald-500" />
                                {dom}
                              </a>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => {
                              onSaveNote(active, message.text);
                              setSaved((p) => ({ ...p, [`${active}-${index}`]: true }));
                            }}
                            disabled={saved[`${active}-${index}`]}
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-brand hover:bg-brand-soft disabled:opacity-60"
                          >
                            {saved[`${active}-${index}`] ? (
                              <>
                                <BookmarkCheck className="size-3" /> Saved to Notes
                              </>
                            ) : (
                              <>
                                <Bookmark className="size-3" /> Save Note
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {pending === active && (
                <div role="status" className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Sparkles className="size-4 animate-spin" />
                  </span>
                  <span>
                    {isRotating
                      ? "স্মার্ট রাউটার কী শিফট করছে…"
                      : `${agentConfig.name} (${agentConfig.domains.slice(0, 2).join(", ")}) থেকে রিয়েল-টাইম তথ্য বিশ্লেষণ করছে…`}
                  </span>
                </div>
              )}
              <div ref={bottom} />
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="relative shrink-0 border-t border-border bg-background/70 backdrop-blur"
      >
        <div className="mx-auto max-w-[860px] px-5 pb-6 pt-4">
          <div className="flex items-end gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm focus-within:border-brand/50">
            <Textarea
              aria-label="Message your agent"
              placeholder={`${agentConfig.name}-কে প্রশ্ন করুন (যেমন: আজকের সর্বশেষ পরিস্থিতি কী?)…`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              className="max-h-40 min-h-12 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              className="size-10 shrink-0 rounded-xl bg-brand text-ink-foreground hover:bg-brand/90"
              aria-label="Send message"
              title="Send message"
              disabled={!draft.trim() || pending !== null}
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
            Live AI Connected · Domain-filtered Real-Time Intelligence · Esc to close
          </p>
        </div>
      </form>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

