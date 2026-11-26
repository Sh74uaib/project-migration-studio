import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpenText,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Video,
  Youtube,
  X,
} from "lucide-react";
import { YTVideoChat } from "@/components/yt-video-chat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useApiRouter, type SearchResultItem } from "@/hooks/use-api-router";
import { seedDefaultKeys } from "@/lib/api-key-store";
import { buildVideoEssayPrompt, DEFAULT_YOUTUBE_CHANNELS, formatVideoAge, getDailyQuote, getDhakaObservances, parseVideoEssay, parseYouTubeChannelInput, parseYouTubeFeed, videoEssayAsText, type VideoEssay, type YouTubeChannel, type YouTubeVideo } from "@/lib/youtube";
import { getYouTubeFeed, resolveYouTubeHandle } from "@/lib/youtube.functions";

export const Route = createFileRoute("/yt-agent")({
  head: () => ({
    meta: [
      { title: "ORION YT Agent — Video Intelligence" },
      { name: "description", content: "ইউটিউব ভিডিওর পরিষ্কার বাংলা প্রবন্ধ, সারাংশ ও AI সহকারী।" },
      { property: "og:title", content: "ORION YT Agent — Video Intelligence" },
      { property: "og:description", content: "চ্যানেলভিত্তিক ভিডিও, বাংলা প্রবন্ধ ও ভিডিও সহকারী।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: YTAgentPage,
});

type CachedEssay = { day: string; essay: VideoEssay; sources: SearchResultItem[] };

function YTAgentPage() {
  const [now, setNow] = useState<Date | null>(null);
  const [channels, setChannels] = useState<YouTubeChannel[]>(DEFAULT_YOUTUBE_CHANNELS);
  const [channelsReady, setChannelsReady] = useState(false);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [activeChannelId, setActiveChannelId] = useState("all");
  const [query, setQuery] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [channelInput, setChannelInput] = useState("");
  const [channelLabel, setChannelLabel] = useState("");
  const [channelError, setChannelError] = useState("");
  const [savingChannel, setSavingChannel] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState("");
  const [articleNotice, setArticleNotice] = useState("");
  const [articles, setArticles] = useState<Record<string, CachedEssay>>({});
  const [articlesReady, setArticlesReady] = useState(false);
  const feedRequestId = useRef(0);
  const articleRequestId = useRef(0);
  const getFeed = useServerFn(getYouTubeFeed);
  const resolveHandle = useServerFn(resolveYouTubeHandle);
  const { searchWithFallback, chatWithFallback } = useApiRouter();

  const dhakaDay = now?.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) ?? "";
  const currentArticle = selectedVideo ? articles[selectedVideo.id] : undefined;
  const currentArticleIsFresh = Boolean(currentArticle && currentArticle.day === dhakaDay);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    seedDefaultKeys();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("orion.ytAgent.channels");
      if (raw) {
        const value: unknown = JSON.parse(raw);
        if (Array.isArray(value)) {
          const valid = value.filter((item): item is YouTubeChannel =>
            item !== null && typeof item === "object" &&
            "id" in item && typeof item.id === "string" && /^UC[a-zA-Z0-9_-]{22}$/.test(item.id) &&
            "name" in item && typeof item.name === "string" &&
            (!("isCustom" in item) || typeof item.isCustom === "boolean"),
          );
          setChannels(valid);
        }
      }
    } catch {
      setChannels(DEFAULT_YOUTUBE_CHANNELS);
    } finally {
      setChannelsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!channelsReady) return;
    localStorage.setItem("orion.ytAgent.channels", JSON.stringify(channels));
  }, [channels, channelsReady]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("orion.ytAgent.articles");
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          setArticles(parsed as Record<string, CachedEssay>);
        }
      }
    } catch {
      setArticles({});
    } finally {
      setArticlesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!articlesReady) return;
    localStorage.setItem("orion.ytAgent.articles", JSON.stringify(articles));
  }, [articles, articlesReady]);

  const refreshFeeds = useCallback(async () => {
    if (!channelsReady) return;
    const requestId = ++feedRequestId.current;
    setLoading(true);
    setFeedError("");

    const results = await Promise.all(channels.map(async (channel) => {
      try {
        const response = await getFeed({ data: { channelId: channel.id } });
        if (response.error) return { videos: [] as YouTubeVideo[], error: channel.name };
        return { videos: parseYouTubeFeed(response.xml, channel), error: "" };
      } catch {
        return { videos: [] as YouTubeVideo[], error: channel.name };
      }
    }));

    if (requestId !== feedRequestId.current) return;
    const combined = results.flatMap((result) => result.videos).sort((first, second) => {
      const firstTime = Date.parse(first.publishedAt) || 0;
      const secondTime = Date.parse(second.publishedAt) || 0;
      return secondTime - firstTime;
    });
    setVideos(combined);
    const unavailable = results.flatMap((result) => result.error ? [result.error] : []);
    setFeedError(unavailable.length > 0 ? `এই চ্যানেলগুলোর ভিডিও পাওয়া যায়নি: ${unavailable.join(", ")}` : "");
    setLoading(false);
  }, [channels, channelsReady, getFeed]);

  useEffect(() => {
    void refreshFeeds();
  }, [refreshFeeds]);

  const filteredVideos = useMemo(() => videos.filter((video) => {
    const matchesChannel = activeChannelId === "all" || video.channelId === activeChannelId;
    const term = query.trim().toLocaleLowerCase();
    const matchesQuery = !term || `${video.title} ${video.channelName} ${video.description}`.toLocaleLowerCase().includes(term);
    return matchesChannel && matchesQuery;
  }), [activeChannelId, query, videos]);

  async function generateArticle(video: YouTubeVideo) {
    const requestId = ++articleRequestId.current;
    setArticleLoading(true);
    setArticleError("");
    setArticleNotice("");
    try {
      const search = await searchWithFallback(`"${video.title}" ${video.channelName} video`, ["youtube.com"]);
      const sources = search.success ? search.items.slice(0, 5) : [];
      const sourceText = sources.map((item, index) =>
        `[${index + 1}] ${item.title}\n${item.url}\n${item.snippet}`,
      ).join("\n\n");
      if (!video.description.trim() && sources.length === 0) {
        throw new Error("ভিডিওর বিবরণ বা যাচাইযোগ্য সার্চ-তথ্য পাওয়া যায়নি।");
      }

      const response = await chatWithFallback({
        messages: [
          { role: "system", content: "আপনি ORION-এর বাংলা ভিডিও সম্পাদক। তথ্য ও উদ্ধৃতি কখনো বানাবেন না; সীমাবদ্ধতা স্পষ্ট করে লিখবেন।" },
          { role: "user", content: buildVideoEssayPrompt(video, sourceText) },
        ],
        preferredProvider: "Gemini",
        maxTokens: 2600,
        grounded: false,
      });
      if (!response.success || !response.content) throw new Error("AI থেকে প্রবন্ধ পাওয়া যায়নি।");
      const parsed = parseVideoEssay(response.content);
      if (!parsed) throw new Error("AI প্রবন্ধটি পড়া যায়নি। আবার চেষ্টা করুন।");
      if (requestId !== articleRequestId.current) return;

      setArticles((current) => ({
        ...current,
        [video.id]: {
          day: dhakaDay || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
          essay: { ...parsed, transcript: null },
          sources,
        },
      }));
    } catch (error) {
      if (requestId === articleRequestId.current) {
        setArticleError(error instanceof Error ? error.message : "AI প্রবন্ধ তৈরি করা যায়নি।");
      }
    } finally {
      if (requestId === articleRequestId.current) setArticleLoading(false);
    }
  }

  function openReader(video: YouTubeVideo) {
    setSelectedVideo(video);
    setTranscriptOpen(false);
    setArticleError("");
    setArticleNotice("");
    setReaderOpen(true);
    const cached = articles[video.id];
    if (!cached || cached.day !== dhakaDay) void generateArticle(video);
  }

  async function addChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChannelError("");
    const parsed = parseYouTubeChannelInput(channelInput);
    if (!parsed) {
      setChannelError("একটি বৈধ YouTube চ্যানেল লিংক, @হ্যান্ডেল অথবা চ্যানেল আইডি দিন।");
      return;
    }

    setSavingChannel(true);
    try {
      let channelId = parsed.kind === "id" ? parsed.id : "";
      if (parsed.kind === "handle") {
        const resolved = await resolveHandle({ data: { handle: parsed.handle } });
        if (!resolved.channelId) throw new Error(resolved.error ?? "YouTube চ্যানেলটি খুঁজে পাওয়া যায়নি।");
        channelId = resolved.channelId;
      }

      if (channels.some((channel) => channel.id === channelId)) {
        throw new Error("এই চ্যানেলটি তালিকায় আগে থেকেই আছে।");
      }

      const fallbackName = parsed.kind === "handle" ? parsed.handle : "YouTube চ্যানেল";
      const provisional: YouTubeChannel = { id: channelId, name: channelLabel.trim() || fallbackName, isCustom: true };
      const feed = await getFeed({ data: { channelId } });
      if (feed.error) throw new Error(feed.error);
      const firstVideo = parseYouTubeFeed(feed.xml, provisional)[0];
      const nextChannel: YouTubeChannel = {
        ...provisional,
        name: channelLabel.trim() || firstVideo?.channelName || fallbackName,
      };
      setChannels((current) => [...current, nextChannel]);
      setActiveChannelId(channelId);
      setChannelInput("");
      setChannelLabel("");
      setManagerOpen(false);
    } catch (error) {
      setChannelError(error instanceof Error ? error.message : "চ্যানেলটি যোগ করা যায়নি।");
    } finally {
      setSavingChannel(false);
    }
  }

  function removeChannel(channelId: string) {
    setChannels((current) => current.filter((channel) => channel.id !== channelId));
    setVideos((current) => current.filter((video) => video.channelId !== channelId));
    setActiveChannelId((current) => current === channelId ? "all" : current);
  }

  function restoreDefaultChannels() {
    setChannels(DEFAULT_YOUTUBE_CHANNELS);
    setActiveChannelId("all");
  }

  async function copyArticle() {
    if (!selectedVideo || !currentArticleIsFresh || !currentArticle) return;
    try {
      await navigator.clipboard.writeText(videoEssayAsText(selectedVideo, currentArticle.essay));
      setArticleNotice("প্রবন্ধ কপি হয়েছে।");
    } catch {
      setArticleNotice("কপি করা যায়নি; ব্রাউজারের অনুমতি পরীক্ষা করুন।");
    }
  }

  function downloadArticle() {
    if (!selectedVideo || !currentArticleIsFresh || !currentArticle) return;
    const content = videoEssayAsText(selectedVideo, currentArticle.essay);
    const file = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedVideo.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60) || "orion-video-essay"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setArticleNotice("প্রবন্ধের টেক্সট ফাইল ডাউনলোড হয়েছে।");
  }

  const observances = now ? getDhakaObservances(now) : null;
  const englishDate = now?.toLocaleDateString("en-GB", {
    timeZone: "Asia/Dhaka",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const bengaliDate = now?.toLocaleDateString("bn-BD", {
    timeZone: "Asia/Dhaka",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dhakaTime = now?.toLocaleTimeString("bn-BD", {
    timeZone: "Asia/Dhaka",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-4 px-5">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-[18px] font-bold tracking-[0.2em]">
            <span className="size-2.5 rounded-full bg-brand" /> ORION
          </Link>
          <span className="hidden items-center gap-2 border-l border-border pl-4 text-sm text-muted-foreground sm:flex">
            <Youtube className="size-4 text-brand" /> YT Agent
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/feed" className="rounded-md border border-border px-3 py-2 text-xs font-medium transition hover:bg-muted">Feed</Link>
            <Link to="/" className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <ArrowLeft className="size-3.5" /> হোম
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-border bg-brand-soft/35">
          <div className="mx-auto max-w-[1160px] px-5 py-8 md:py-10">
            <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-card/70 px-3 py-1 text-xs font-medium text-brand">
                  <Video className="size-3.5" /> Orion Video Intelligence
                </div>
                <h1 className="mt-4 font-display text-5xl leading-none">YT Agent</h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  আপনার পছন্দের চ্যানেলের নতুন ভিডিও পড়ুন, মূল ধারণা বুঝুন, আর ভিডিও সহকারীকে প্রশ্ন করুন।
                </p>
                <div className="mt-5 flex items-start gap-2 text-sm text-foreground/80">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
                  <p className="font-display text-xl leading-snug">“{now ? getDailyQuote(now) : "আজ নতুন কিছু শেখার দিন।"}”</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
                <div className="bg-card p-3.5">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">বাংলা তারিখ</span>
                  <p className="mt-1 text-sm font-medium">{bengaliDate ?? "তারিখ আসছে…"}</p>
                </div>
                <div className="bg-card p-3.5">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">Dhaka · English</span>
                  <p className="mt-1 text-sm font-medium">{englishDate ?? "Date loading…"}</p>
                </div>
                <div className="bg-card p-3.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground"><Clock3 className="size-3" /> এখন</span>
                  <p className="mt-1 text-sm font-medium">{dhakaTime ?? "--:--"}</p>
                </div>
                <div className="bg-card p-3.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground"><CalendarDays className="size-3" /> দিবস</span>
                  <p className="mt-1 text-sm font-medium">{observances?.today ?? "আজ কোনো নির্ধারিত দিবস নেই"}</p>
                  {observances?.upcoming && <p className="mt-1 text-xs text-muted-foreground">পরেরটি: {observances.upcoming.name} · {observances.upcoming.days} দিন</p>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1160px] px-5 py-8 md:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-brand">ভিডিও লাইব্রেরি</p>
              <h2 className="mt-1 font-display text-3xl">সর্বশেষ ভিডিও</h2>
              <p className="mt-1 text-sm text-muted-foreground">{videos.length}টি ভিডিও · YouTube-এর সর্বশেষ চ্যানেল আপলোড</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setManagerOpen(true)}>
                <Plus className="size-4" /> চ্যানেল যোগ
              </Button>
              <Button variant="outline" size="icon" aria-label="ভিডিও রিফ্রেশ" title="ভিডিও রিফ্রেশ" onClick={() => void refreshFeeds()} disabled={loading}>
                <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="চ্যানেল বাছাই">
              <Button type="button" variant={activeChannelId === "all" ? "default" : "outline"} size="sm" className={activeChannelId === "all" ? "bg-ink text-ink-foreground hover:bg-ink/90" : "shrink-0"} onClick={() => setActiveChannelId("all")}>সব</Button>
              {channels.map((channel) => (
                <Button
                  key={channel.id}
                  type="button"
                  variant={activeChannelId === channel.id ? "default" : "outline"}
                  size="sm"
                  className={`shrink-0 ${activeChannelId === channel.id ? "bg-ink text-ink-foreground hover:bg-ink/90" : ""}`}
                  onClick={() => setActiveChannelId(channel.id)}
                >
                  {channel.name}
                </Button>
              ))}
            </nav>
            <label className="relative block w-full lg:max-w-[320px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ভিডিও বা চ্যানেল খুঁজুন" className="h-10 pl-9" aria-label="ভিডিও খুঁজুন" />
            </label>
          </div>

          {feedError && (
            <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-destructive px-4 py-3 text-sm">
              <p className="text-muted-foreground">{feedError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refreshFeeds()}>আবার চেষ্টা করুন</Button>
            </div>
          )}

          {loading && videos.length === 0 && (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="ভিডিও লোড হচ্ছে">
              {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="overflow-hidden rounded-lg border border-border bg-card"><div className="aspect-video animate-pulse bg-muted" /><div className="space-y-3 p-4"><div className="h-3 w-1/3 animate-pulse bg-muted" /><div className="h-5 w-4/5 animate-pulse bg-muted" /><div className="h-3 w-2/3 animate-pulse bg-muted" /></div></div>)}
            </div>
          )}

          {!loading && filteredVideos.length > 0 && (
            <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
              {filteredVideos.map((video) => (
                <article key={`${video.channelId}-${video.id}`} className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-brand/40">
                  <button type="button" onClick={() => openReader(video)} aria-label={`${video.title} প্রবন্ধ খুলুন`} className="relative block aspect-video w-full overflow-hidden bg-muted text-left">
                    <img src={video.thumbnail} alt={`${video.channelName} — ${video.title}`} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                    <span className="absolute bottom-2 right-2 rounded bg-ink/90 px-2 py-1 text-[10px] font-medium text-ink-foreground">প্রবন্ধ পড়ুন</span>
                  </button>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[9px] font-bold text-brand">{video.channelName.slice(0, 2)}</span>
                        <span className="truncate font-semibold text-foreground">{video.channelName}</span>
                      </span>
                      <span className="shrink-0">{formatVideoAge(video.publishedAt)}</span>
                    </div>
                    <h3 className="mt-3 min-h-[3.5rem] text-base font-semibold leading-snug">
                      <button type="button" onClick={() => openReader(video)} className="text-left transition hover:text-brand">{video.title}</button>
                    </h3>
                    {video.description && <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">{video.description}</p>}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <Button asChild variant="outline" size="sm" className="h-8 px-2.5 text-[11px]">
                        <a href={video.url} target="_blank" rel="noreferrer"><ArrowUpRight className="size-3.5" /> YouTube-এ দেখুন</a>
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-[11px]" onClick={() => openReader(video)}>
                        <BookOpenText className="size-3.5" /> প্রবন্ধ
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-[11px]" onClick={() => { setSelectedVideo(video); setChatOpen(true); }}>
                        <Sparkles className="size-3.5" /> AI চ্যাট
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && videos.length > 0 && filteredVideos.length === 0 && (
            <div className="py-16 text-center">
              <Search className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">এই খোঁজে কোনো ভিডিও নেই</p>
              <p className="mt-1 text-xs text-muted-foreground">অন্য শব্দ বা চ্যানেল বেছে নিন।</p>
            </div>
          )}

          {!loading && videos.length === 0 && !feedError && channelsReady && (
            <div className="py-16 text-center">
              <Video className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">এখনো ভিডিও পাওয়া যায়নি</p>
              <p className="mt-1 text-xs text-muted-foreground">চ্যানেল ফিড আবার চেষ্টা করুন।</p>
            </div>
          )}
        </section>
      </main>

      <Dialog open={managerOpen} onOpenChange={(open) => { setManagerOpen(open); if (!open) setChannelError(""); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-[520px]">
          <DialogTitle className="flex items-center gap-2 font-display text-2xl"><Youtube className="size-5 text-brand" /> চ্যানেল ম্যানেজার</DialogTitle>
          <DialogDescription>ইউটিউব চ্যানেলের লিংক, @হ্যান্ডেল অথবা চ্যানেল আইডি যোগ করুন।</DialogDescription>
          <form onSubmit={(event) => void addChannel(event)} className="space-y-3">
            <label className="block text-xs font-semibold" htmlFor="yt-channel-link">চ্যানেল লিংক বা আইডি</label>
            <Input id="yt-channel-link" value={channelInput} onChange={(event) => setChannelInput(event.target.value)} placeholder="youtube.com/@channel অথবা UC…" autoComplete="url" />
            <label className="block text-xs font-semibold" htmlFor="yt-channel-name">দেখানোর নাম <span className="font-normal text-muted-foreground">(ঐচ্ছিক)</span></label>
            <Input id="yt-channel-name" value={channelLabel} onChange={(event) => setChannelLabel(event.target.value)} placeholder="চ্যানেলের নাম" />
            {channelError && <p role="alert" className="text-sm text-destructive">{channelError}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={!channelInput.trim() || savingChannel}>
                {savingChannel ? <RefreshCw className="size-4 animate-spin" /> : <Plus className="size-4" />}
                চ্যানেল যোগ করুন
              </Button>
            </div>
          </form>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">আপনার চ্যানেল · {channels.length}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={restoreDefaultChannels}>ডিফল্ট ফিরিয়ে আনুন</Button>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {channels.map((channel) => (
                <li key={channel.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{channel.name}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{channel.id}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`${channel.name} সরান`} title="চ্যানেল সরান" onClick={() => removeChannel(channel.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      {readerOpen && selectedVideo && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-background" role="dialog" aria-modal="true" aria-label={`${selectedVideo.title} প্রবন্ধ`}>
          <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex min-h-16 max-w-[1120px] flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
              <Button type="button" variant="ghost" size="icon" aria-label="প্রবন্ধ বন্ধ করুন" onClick={() => setReaderOpen(false)}><X className="size-4" /></Button>
              <span className="hidden text-xs font-semibold uppercase text-brand sm:block">YT Agent · প্রবন্ধ</span>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => void copyArticle()} disabled={!currentArticleIsFresh || !currentArticle}>
                  {articleNotice.includes("কপি") ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} কপি
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={downloadArticle} disabled={!currentArticleIsFresh || !currentArticle}>
                  <Download className="size-3.5" /> TXT
                </Button>
                <Button type="button" size="sm" onClick={() => setChatOpen(true)}><Sparkles className="size-3.5" /> AI চ্যাট</Button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8 sm:py-12">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-brand">{selectedVideo.channelName}</span>
              <span>·</span>
              <span>{formatVideoAge(selectedVideo.publishedAt)}</span>
              <span>·</span>
              <a href={selectedVideo.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand">মূল ভিডিও <ExternalLink className="size-3" /></a>
            </div>
            <h1 className="max-w-4xl font-display text-4xl leading-tight sm:text-5xl">{selectedVideo.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              এই প্রবন্ধটি ভিডিওর প্রকাশিত বিবরণ ও পাওয়া সার্চ-তথ্য থেকে AI তৈরি করেছে; পূর্ণ ভিডিও ট্রান্সক্রিপ্ট এখানে পাওয়া যায়নি।
            </p>

            {articleNotice && <p role="status" className="mt-4 text-sm text-brand">{articleNotice}</p>}
            {articleLoading && (
              <div className="mt-8 flex items-center gap-3 border-y border-border py-5 text-sm text-muted-foreground" role="status">
                <Sparkles className="size-4 animate-pulse text-brand" /> ভিডিওর তথ্য খুঁজে প্রবন্ধ সাজানো হচ্ছে…
              </div>
            )}
            {articleError && !articleLoading && (
              <div role="alert" className="mt-8 border-y border-destructive/40 py-5 text-sm">
                <p>{articleError}</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void generateArticle(selectedVideo)}>আবার চেষ্টা করুন</Button>
              </div>
            )}

            {currentArticleIsFresh && currentArticle && !articleLoading && (
              <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                <article className="min-w-0">
                  <section className="border-l-2 border-brand bg-brand-soft/50 px-5 py-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-brand"><BookOpenText className="size-4" /> ২ মিনিটে মূল শিক্ষা</div>
                    <p className="mt-3 text-base font-medium leading-relaxed">{currentArticle.essay.summary}</p>
                    {currentArticle.essay.takeaways.length > 0 && (
                      <ul className="mt-4 space-y-2 text-sm leading-relaxed">
                        {currentArticle.essay.takeaways.map((item, index) => <li key={`${index}-${item}`} className="flex gap-2"><span className="font-semibold text-brand">{index + 1}.</span><span>{item}</span></li>)}
                      </ul>
                    )}
                  </section>

                  <section className="mt-8">
                    <h2 className="font-display text-3xl">প্রেক্ষাপট</h2>
                    <p className="mt-3 text-[16px] leading-8 text-foreground/85">{currentArticle.essay.introduction}</p>
                  </section>

                  {currentArticle.essay.sections.map((section, index) => (
                    <section key={`${index}-${section.heading}`} className="mt-8 border-t border-border pt-6">
                      <h2 className="font-display text-2xl">{section.heading}</h2>
                      <p className="mt-3 text-[16px] leading-8 text-foreground/85">{section.body}</p>
                    </section>
                  ))}

                  {currentArticle.essay.keyQuotes.length > 0 && (
                    <section className="mt-8 border-t border-border pt-6">
                      <h2 className="font-display text-2xl">ভিডিওর উদ্ধৃতি</h2>
                      <div className="mt-4 space-y-3">
                        {currentArticle.essay.keyQuotes.map((quote) => <blockquote key={quote} className="border-l-2 border-brand px-4 py-3 font-display text-xl leading-relaxed">“{quote}”</blockquote>)}
                      </div>
                    </section>
                  )}

                  {currentArticle.essay.actions.length > 0 && (
                    <section className="mt-8 border-t border-border pt-6">
                      <h2 className="font-display text-2xl">এখন কী করা যায়</h2>
                      <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                        {currentArticle.essay.actions.map((action) => <li key={action} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" />{action}</li>)}
                      </ul>
                    </section>
                  )}

                  {currentArticle.sources.length > 0 && (
                    <section className="mt-8 border-t border-border pt-6">
                      <h2 className="text-sm font-semibold">যে তথ্যসূত্র পাওয়া গেছে</h2>
                      <ul className="mt-3 space-y-2">
                        {currentArticle.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 text-sm text-brand hover:underline"><ExternalLink className="size-3.5 shrink-0" /><span className="truncate">{source.title}</span></a></li>)}
                      </ul>
                    </section>
                  )}
                </article>

                <aside className="lg:sticky lg:top-24 lg:self-start">
                  <div className="border-t border-border py-4">
                    <p className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-brand" /> Տեսանելի তথ্য</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">প্রবন্ধে ভিডিওর বিবরণ ও সার্চ-উদ্ধৃতি ব্যবহার করা হয়েছে। পূর্ণ ট্রান্সক্রিপ্ট বা হুবহু উদ্ধৃতি নিশ্চিত নয়।</p>
                    <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => setTranscriptOpen((current) => !current)} aria-expanded={transcriptOpen}>
                      {transcriptOpen ? "ট্রান্সক্রিপ্ট বন্ধ করুন" : "ট্রান্সক্রিপ্ট দেখুন"}
                    </Button>
                  </div>
                  <div className="mt-4 border-t border-border py-4">
                    <p className="text-xs font-semibold text-muted-foreground">চ্যানেল</p>
                    <p className="mt-1 text-sm font-medium">{selectedVideo.channelName}</p>
                    <a href={selectedVideo.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand hover:underline">YouTube-এ খুলুন <ExternalLink className="size-3" /></a>
                  </div>
                </aside>
              </div>
            )}

            {transcriptOpen && (
              <section className="mt-8 border-y border-border py-5" aria-label="ভিডিও ট্রান্সক্রিপ্ট">
                <h2 className="text-sm font-semibold">মূল ট্রান্সক্রিপ্ট</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">এই ব্রাউজারভিত্তিক সংস্করণে YouTube-এর পূর্ণ ট্রান্সক্রিপ্ট সংগ্রহ করা হয় না। ভিডিওর বিবরণ ও সার্চ-তথ্য ছাড়া কোনো কথোপকথন বা টাইমস্ট্যাম্প দেখানো হচ্ছে না।</p>
              </section>
            )}
          </main>
        </div>
      )}

      <YTVideoChat video={selectedVideo} open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}