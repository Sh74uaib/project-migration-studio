import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CHANNEL_ID_PATTERN = /^UC[a-zA-Z0-9_-]{22}$/;
const MAX_RSS_SIZE = 1_000_000;

export const getYouTubeFeed = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ channelId: z.string().regex(CHANNEL_ID_PATTERN) }).parse(data))
  .handler(async ({ data }) => {
    try {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(data.channelId)}`;
      const response = await fetch(url, {
        headers: { Accept: "application/atom+xml, application/xml, text/xml" },
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) return { xml: "", error: "YouTube-এর RSS ফিড এখন পাওয়া যাচ্ছে না।" };

      const xml = await response.text();
      if (xml.length > MAX_RSS_SIZE) return { xml: "", error: "YouTube-এর RSS ফিডটি প্রত্যাশার চেয়ে বড়।" };
      return { xml, error: null };
    } catch {
      return { xml: "", error: "YouTube-এর RSS ফিডে এখন সংযোগ করা যাচ্ছে না।" };
    }
  });

export const resolveYouTubeHandle = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ handle: z.string().regex(/^@[a-zA-Z0-9._-]{3,30}$/) }).parse(data))
  .handler(async ({ data }) => {
    try {
      const response = await fetch(`https://www.youtube.com/${data.handle}`, {
        headers: { Accept: "text/html" },
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) return { channelId: null, error: "এই YouTube চ্যানেলটি খুঁজে পাওয়া যায়নি।" };

      const html = (await response.text()).slice(0, 4_000_000);
      const match = html.match(/(?:channelId|externalId|browseId)["\\s:]+"?(UC[a-zA-Z0-9_-]{22})/);
      if (!match?.[1]) return { channelId: null, error: "এই চ্যানেলের পরিচয় YouTube থেকে পাওয়া যায়নি।" };
      return { channelId: match[1], error: null };
    } catch {
      return { channelId: null, error: "YouTube চ্যানেলের তথ্য এখন পাওয়া যাচ্ছে না।" };
    }
  });