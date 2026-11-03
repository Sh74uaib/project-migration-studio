import { useEffect, useState } from "react";
import { BookmarkCheck, Eye, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type Note = { id: string; sector: string; text: string; savedAt: number };

export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setValue(JSON.parse(raw)); } catch { /* ignore */ }
    setLoaded(true);
  }, [key]);
  useEffect(() => { if (loaded) localStorage.setItem(key, JSON.stringify(value)); }, [key, value, loaded]);
  return [value, setValue] as const;
}

export function usePersonalData() {
  const [watchlist, setWatchlist] = usePersisted<string[]>("orion.watchlist", ["AI", "Bangladesh Banking", "Global Economy"]);
  const [notes, setNotes] = usePersisted<Note[]>("orion.notes", []);
  return {
    watchlist,
    addTopic: (t: string) => { const v = t.trim(); if (v && !watchlist.includes(v)) setWatchlist([...watchlist, v]); },
    removeTopic: (t: string) => setWatchlist(watchlist.filter((x) => x !== t)),
    notes,
    saveNote: (sector: string, text: string) => setNotes((n) => [{ id: crypto.randomUUID(), sector, text, savedAt: Date.now() }, ...n]),
    removeNote: (id: string) => setNotes((n) => n.filter((x) => x.id !== id)),
  };
}

const digestSections = [
  { sector: "Bangladesh", points: ["Tech exports crossed a new yearly record.", "Dhaka metro opened two new stations."] },
  { sector: "World", points: ["Global leaders meet on climate finance this week."] },
  { sector: "Technology", points: ["New AI chip launches push hardware stocks up."] },
  { sector: "Business", points: ["Garment exports rose 8% in the third quarter."] },
];

export function DailyDigest({ open, onOpenChange, hour, watchlist }: { open: boolean; onOpenChange: (o: boolean) => void; hour: number; watchlist: string[] }) {
  const morning = hour < 12, evening = hour >= 17;
  const greeting = morning ? "সুপ্রভাত! আজকের দিনের শুরুর জন্য জরুরি বিষয়গুলো" : evening ? "শুভ সন্ধ্যা! সারাদিনের গুরুত্বপূর্ণ সারসংক্ষেপ" : "দুপুরের দ্রুত আপডেট";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-[560px]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-brand"><Sparkles className="size-3.5" /> 3-minute briefing</div>
        <DialogTitle className="font-display text-3xl">{greeting}</DialogTitle>
        <DialogDescription>Sample briefing — live news not connected yet.</DialogDescription>
        {watchlist.length > 0 && (
          <div className="rounded-xl bg-brand-soft p-4 text-sm">
            <div className="mb-1 font-semibold">আপনার Watchlist</div>
            <p className="text-muted-foreground">আজ {watchlist.join(", ")} নিয়ে নজর রাখা হচ্ছে।</p>
          </div>
        )}
        <div className="space-y-5">
          {digestSections.map((s) => (
            <div key={s.sector}>
              <div className="text-sm font-semibold">{s.sector}</div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WatchlistCard({ watchlist, onAdd, onRemove }: { watchlist: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-sm font-semibold"><Eye className="size-4 text-brand" /> My watchlist</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {watchlist.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-medium">
            {t}<button aria-label={`Remove ${t}`} onClick={() => onRemove(t)} className="opacity-60 hover:opacity-100"><X className="size-3" /></button>
          </span>
        ))}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); onAdd(draft); setDraft(""); }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a topic…" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
        <Button type="submit" size="icon" variant="outline" aria-label="Add topic" disabled={!draft.trim()}><Plus /></Button>
      </form>
    </div>
  );
}

export function NotesCard({ notes, onRemove }: { notes: Note[]; onRemove: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-sm font-semibold"><BookmarkCheck className="size-4 text-brand" /> Second brain <span className="font-normal text-muted-foreground">· {notes.length}</span></div>
      {notes.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">এজেন্টের উত্তরে "Save" চাপলে এখানে জমা হবে।</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-semibold text-brand">{n.sector}</span>
                <button aria-label="Delete note" onClick={() => onRemove(n.id)} className="opacity-50 hover:opacity-100"><Trash2 className="size-3.5" /></button>
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
