export type YouTubeChannel = {
  id: string;
  name: string;
  isCustom?: boolean;
};

export type YouTubeVideo = {
  id: string;
  channelId: string;
  channelName: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
};

export type VideoEssay = {
  summary: string;
  takeaways: string[];
  introduction: string;
  sections: { heading: string; body: string }[];
  keyQuotes: string[];
  actions: string[];
  transcript: string | null;
};

export const DEFAULT_YOUTUBE_CHANNELS: YouTubeChannel[] = [
  { id: "UCb-d2dCbEt_T-d3qf3oMICw", name: "খালিদ ফারহান" },
  { id: "UC3CjpLYrGnKVvBUBXRe81dA", name: "আইমান সাদিক" },
  { id: "UCE6hrW3g0K_sj3XLvBxIC0g", name: "Backbenchers University" },
  { id: "UCzwCEE_PchiBULMnAJqhGVg", name: "রাজ সামানি" },
];

type ChannelInput = { kind: "id"; id: string } | { kind: "handle"; handle: string };

const CHANNEL_ID_PATTERN = /^UC[a-zA-Z0-9_-]{22}$/;
const OBSERVANCES = [
  { month: 2, day: 21, name: "আন্তর্জাতিক মাতৃভাষা দিবস" },
  { month: 3, day: 26, name: "বাংলাদেশের স্বাধীনতা দিবস" },
  { month: 4, day: 14, name: "বাংলা নববর্ষ" },
  { month: 5, day: 1, name: "আন্তর্জাতিক শ্রমিক দিবস" },
  { month: 6, day: 5, name: "বিশ্ব পরিবেশ দিবস" },
  { month: 9, day: 21, name: "আন্তর্জাতিক শান্তি দিবস" },
  { month: 12, day: 10, name: "বিশ্ব মানবাধিকার দিবস" },
  { month: 12, day: 16, name: "বাংলাদেশের বিজয় দিবস" },
  { month: 12, day: 25, name: "বড়দিন" },
];

const DAILY_QUOTES = [
  "জ্ঞান তখনই শক্তি হয়, যখন তা কাজে লাগে।",
  "প্রতিদিনের ছোট শেখাই বড় পরিবর্তনের শুরু।",
  "ভালো প্রশ্নই নতুন পথের দরজা খুলে দেয়।",
  "মনোযোগ দিয়ে শোনা, শেখার প্রথম ধাপ।",
  "যে কৌতূহল ধরে রাখে, সে এগিয়ে যাওয়ার পথ খুঁজে পায়।",
];

export function parseYouTubeChannelInput(input: string): ChannelInput | null {
  const value = input.trim();
  if (CHANNEL_ID_PATTERN.test(value)) return { kind: "id", id: value };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname !== "youtube.com" && hostname !== "m.youtube.com") return null;

  const feedId = url.searchParams.get("channel_id");
  if (feedId && CHANNEL_ID_PATTERN.test(feedId)) return { kind: "id", id: feedId };

  const channelMatch = url.pathname.match(/^\/channel\/(UC[a-zA-Z0-9_-]{22})\/?$/);
  if (channelMatch?.[1]) return { kind: "id", id: channelMatch[1] };

  const handleMatch = url.pathname.match(/^\/@([a-zA-Z0-9._-]{3,30})\/?$/);
  if (handleMatch?.[1]) return { kind: "handle", handle: `@${handleMatch[1]}` };

  return null;
}

export function parseYouTubeFeed(xml: string, channel: YouTubeChannel): YouTubeVideo[] {
  if (typeof DOMParser === "undefined") return [];

  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) return [];

  return Array.from(document.getElementsByTagName("entry")).flatMap((entry) => {
    const videoId = entry.getElementsByTagName("yt:videoId")[0]?.textContent?.trim();
    if (!videoId) return [];

    const title = entry.getElementsByTagName("title")[0]?.textContent?.trim() ?? "";
    const publishedAt = entry.getElementsByTagName("published")[0]?.textContent?.trim() ?? "";
    const author = entry.getElementsByTagName("author")[0];
    const channelName = author?.getElementsByTagName("name")[0]?.textContent?.trim() || channel.name;
    const mediaGroup = entry.getElementsByTagName("media:group")[0];
    const description = mediaGroup?.getElementsByTagName("media:description")[0]?.textContent?.trim() ?? "";
    const thumbnail = mediaGroup?.getElementsByTagName("media:thumbnail")[0]?.getAttribute("url") ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return [{
      id: videoId,
      channelId: channel.id,
      channelName,
      title: title || "শিরোনাম পাওয়া যায়নি",
      description,
      publishedAt,
      thumbnail,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    }];
  });
}

export function parseVideoEssay(raw: string): VideoEssay | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as Partial<VideoEssay>;
    if (typeof data.summary !== "string" || typeof data.introduction !== "string") return null;
    return {
      summary: data.summary,
      introduction: data.introduction,
      takeaways: Array.isArray(data.takeaways) ? data.takeaways.filter((item): item is string => typeof item === "string") : [],
      sections: Array.isArray(data.sections)
        ? data.sections.flatMap((section) =>
            section && typeof section.heading === "string" && typeof section.body === "string"
              ? [{ heading: section.heading, body: section.body }]
              : [],
          )
        : [],
      keyQuotes: Array.isArray(data.keyQuotes) ? data.keyQuotes.filter((item): item is string => typeof item === "string") : [],
      actions: Array.isArray(data.actions) ? data.actions.filter((item): item is string => typeof item === "string") : [],
      transcript: typeof data.transcript === "string" ? data.transcript : null,
    };
  } catch {
    return null;
  }
}

export function buildVideoEssayPrompt(video: YouTubeVideo, sourceText: string): string {
  return `ভিডিওটির জন্য বাংলায় একটি নির্ভুল পাঠযোগ্য প্রবন্ধ তৈরি করুন। আপনি পুরো ভিডিও বা ট্রান্সক্রিপ্ট দেখেননি—শুধু নিচের শিরোনাম, প্রকাশিত বিবরণ ও সার্চ-উদ্ধৃতিগুলো ব্যবহার করুন। কোনো অনুপস্থিত তথ্য, ঘটনা, উদ্ধৃতি বা ট্রান্সক্রিপ্ট বানাবেন না।

শিরোনাম: ${video.title}
চ্যানেল: ${video.channelName}
প্রকাশিত বিবরণ: ${video.description || "প্রকাশিত বিবরণ নেই।"}
ভিডিও লিংক: ${video.url}

সার্চে পাওয়া তথ্য:
${sourceText || "অতিরিক্ত সার্চ-তথ্য পাওয়া যায়নি।"}

শুধু বৈধ JSON ফেরত দিন, এই গঠন অনুসারে:
{"summary":"২-৩ বাক্যের সতর্ক সারাংশ","takeaways":["৩-৫টি মূল শিক্ষা"],"introduction":"প্রেক্ষাপট ও সীমাবদ্ধতা উল্লেখ করে ভূমিকা","sections":[{"heading":"মূল বিষয়","body":"উৎসে থাকা তথ্যের ব্যাখ্যা"}],"keyQuotes":[],"actions":["প্রযোজ্য করণীয়"],"transcript":null}

উদ্ধৃতি কেবল উৎসে হুবহু থাকলে দিন। ভিডিওর বিবরণ বা সার্চ-তথ্য থেকে বোঝা না গেলে সেটি স্পষ্টভাবে বলুন; ট্রান্সক্রिप্ট সবসময় null রাখুন।`;
}

export function getDhakaObservances(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  const today = OBSERVANCES.find((item) => item.month === month && item.day === day)?.name ?? null;
  const currentOrdinal = Date.UTC(year, month - 1, day);
  const upcoming = OBSERVANCES.map((item) => {
    let eventYear = year;
    let ordinal = Date.UTC(eventYear, item.month - 1, item.day);
    if (ordinal <= currentOrdinal) {
      eventYear += 1;
      ordinal = Date.UTC(eventYear, item.month - 1, item.day);
    }
    return { name: item.name, days: Math.round((ordinal - currentOrdinal) / 86_400_000) };
  }).sort((first, second) => first.days - second.days)[0] ?? null;

  return { today, upcoming };
}

export function getDailyQuote(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const key = parts.filter((part) => ["year", "month", "day"].includes(part.type)).map((part) => part.value).join("");
  const index = Number(key) % DAILY_QUOTES.length;
  return DAILY_QUOTES[index] ?? DAILY_QUOTES[0] ?? "আজ নতুন কিছু শেখার দিন।";
}

export function formatVideoAge(publishedAt: string, now = Date.now()): string {
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return "সময় অজানা";

  const elapsedMinutes = Math.max(1, Math.floor((now - timestamp) / 60_000));
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 525_600],
    ["month", 43_200],
    ["day", 1_440],
    ["hour", 60],
    ["minute", 1],
  ];
  const [unit, minutesPerUnit] = units.find(([, minutes]) => elapsedMinutes >= minutes) ?? ["minute", 1];
  const value = Math.floor(elapsedMinutes / minutesPerUnit);
  return new Intl.RelativeTimeFormat("bn", { numeric: "auto" }).format(-value, unit);
}

export function videoEssayAsText(video: YouTubeVideo, essay: VideoEssay): string {
  return [
    video.title,
    video.channelName,
    "",
    "সংক্ষিপ্তসার",
    essay.summary,
    "",
    "মূল শিক্ষা",
    ...essay.takeaways.map((item) => `• ${item}`),
    "",
    essay.introduction,
    ...essay.sections.flatMap((section) => ["", section.heading, section.body]),
    "",
    "করণীয়",
    ...essay.actions.map((item) => `• ${item}`),
    "",
    video.url,
  ].join("\n");
}