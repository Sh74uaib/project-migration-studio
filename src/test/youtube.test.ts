import { describe, expect, it } from "vitest";
import { DEFAULT_YOUTUBE_CHANNELS, parseYouTubeChannelInput } from "@/lib/youtube";

describe("YT Agent channel definitions", () => {
  it("uses the four channel IDs supplied for the default feed", () => {
    expect(DEFAULT_YOUTUBE_CHANNELS.map((channel) => channel.id)).toEqual([
      "UCb-d2dCbEt_T-d3qf3oMICw",
      "UC3CjpLYrGnKVvBUBXRe81dA",
      "UCE6hrW3g0K_sj3XLvBxIC0g",
      "UCzwCEE_PchiBULMnAJqhGVg",
    ]);
  });

  it("accepts a channel ID and a standard YouTube channel URL", () => {
    expect(parseYouTubeChannelInput("UC3CjpLYrGnKVvBUBXRe81dA")).toEqual({
      kind: "id",
      id: "UC3CjpLYrGnKVvBUBXRe81dA",
    });
    expect(parseYouTubeChannelInput("https://www.youtube.com/channel/UC3CjpLYrGnKVvBUBXRe81dA")).toEqual({
      kind: "id",
      id: "UC3CjpLYrGnKVvBUBXRe81dA",
    });
  });

  it("accepts a YouTube handle and rejects unrelated websites", () => {
    expect(parseYouTubeChannelInput("youtube.com/@example.creator")).toEqual({
      kind: "handle",
      handle: "@example.creator",
    });
    expect(parseYouTubeChannelInput("https://example.com/channel/UC3CjpLYrGnKVvBUBXRe81dA")).toBeNull();
  });
});