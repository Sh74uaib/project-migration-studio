import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useApiRouter, type ChatMessage } from "@/hooks/use-api-router";
import type { YouTubeVideo } from "@/lib/youtube";

type ConversationLine = { role: "user" | "assistant"; content: string };

type Props = {
  video: YouTubeVideo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const QUICK_PROMPTS = ["মূল শিক্ষাগুলো বলো", "বাস্তব উদাহরণ কী ছিল?", "ছোট করে সারসংক্ষেপ দাও"];

export function YTVideoChat({ video, open, onOpenChange }: Props) {
  const [conversations, setConversations] = useState<Record<string, ConversationLine[]>>({});
  const [draft, setDraft] = useState("");
  const [pendingVideoId, setPendingVideoId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { chatWithFallback } = useApiRouter();
  const conversation = video ? conversations[video.id] ?? [] : [];

  useEffect(() => {
    setDraft("");
  }, [video?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, pendingVideoId]);

  async function send(questionText: string) {
    if (!video || pendingVideoId) return;
    const question = questionText.trim();
    if (!question) return;

    const videoId = video.id;
    const prior = conversations[videoId] ?? [];
    setConversations((current) => ({
      ...current,
      [videoId]: [...prior, { role: "user", content: question }],
    }));
    setDraft("");
    setPendingVideoId(videoId);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `আপনি ORION-এর ভিডিও-সহকারী। আপনি পুরো ভিডিও বা ট্রান্সক্রিপ্ট দেখেননি। কেবল এই তথ্য ব্যবহার করুন: শিরোনাম: ${video.title}; চ্যানেল: ${video.channelName}; প্রকাশিত বিবরণ: ${video.description || "নেই"}; URL: ${video.url}. ব্যবহারকারী যা জানতে চাইছেন তার উত্তর বাংলায় দিন। ভিডিওর মধ্যে কী বলা হয়েছে তা নিশ্চিত না হলে অনুমান না করে সীমাবদ্ধতা জানান।`,
      },
      ...prior.slice(-10).map((message): ChatMessage => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user", content: `${video.title} ভিডিও সম্পর্কে প্রশ্ন: ${question}` },
    ];

    try {
      const result = await chatWithFallback({
        messages,
        grounded: true,
        domains: ["youtube.com"],
        preferredProvider: "Gemini",
        maxTokens: 1200,
      });
      const answer = result.success && result.content
        ? result.content
        : "এখন AI থেকে উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন বা সেটিংসে AI সেবা দেখুন।";
      setConversations((current) => ({
        ...current,
        [videoId]: [...(current[videoId] ?? []), { role: "assistant", content: answer }],
      }));
    } catch {
      setConversations((current) => ({
        ...current,
        [videoId]: [
          ...(current[videoId] ?? []),
          { role: "assistant", content: "এখন উত্তর আনা যায়নি। একটু পরে আবার চেষ্টা করুন।" },
        ],
      }));
    } finally {
      setPendingVideoId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-5 py-5 pr-14 text-left">
          <div className="flex items-center gap-2 text-brand">
            <MessageCircle className="size-4" />
            <span className="text-xs font-semibold">ভিডিও সহকারী</span>
          </div>
          <SheetTitle className="line-clamp-2 text-base">{video?.title ?? "ভিডিও সম্পর্কে জিজ্ঞেস করুন"}</SheetTitle>
          <SheetDescription>{video?.channelName ?? "আপনার প্রশ্নের উত্তর বাংলায় দেওয়া হবে।"}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          {conversation.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
              <span className="grid size-12 place-items-center rounded-lg bg-brand-soft text-brand">
                <Sparkles className="size-6" />
              </span>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                ভিডিওর প্রকাশিত বিবরণ ও পাওয়া তথ্যের ভিত্তিতে উত্তর দেব। পুরো ট্রান্সক্রিপ্ট না থাকলে তা স্পষ্ট করে জানাব।
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <Button key={prompt} type="button" variant="outline" size="sm" onClick={() => void send(prompt)} disabled={!video || pendingVideoId !== null}>
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6" role="log" aria-live="polite" aria-label="ভিডিও সহকারীর কথোপকথন">
              {conversation.map((message, index) => (
                <div key={`${video?.id ?? "video"}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex gap-3"}>
                  {message.role === "assistant" && (
                    <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <Sparkles className="size-4" />
                    </span>
                  )}
                  <div className={message.role === "user" ? "max-w-[85%] rounded-lg bg-ink px-4 py-3 text-ink-foreground" : "min-w-0 flex-1"}>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              {pendingVideoId === video?.id && (
                <p role="status" className="text-sm text-muted-foreground">ভিডিও-সম্পর্কিত তথ্য মিলিয়ে উত্তর তৈরি হচ্ছে…</p>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form
          className="border-t border-border px-4 pb-5 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-2 focus-within:border-brand/50">
            <Textarea
              aria-label="ভিডিও সম্পর্কে প্রশ্ন"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              placeholder="ভিডিও সম্পর্কে প্রশ্ন লিখুন…"
              className="max-h-32 min-h-10 resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
            />
            <Button type="submit" size="icon" aria-label="প্রশ্ন পাঠান" disabled={!draft.trim() || pendingVideoId !== null}>
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}