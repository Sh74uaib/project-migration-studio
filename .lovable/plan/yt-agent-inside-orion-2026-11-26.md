# YT Agent inside Orion

## Outcome

Add a dedicated YT Agent workspace under Orion and an entry on the existing agent grid. Keep the current homepage, palette, typography, and component style unchanged. The new workspace will include the four requested channels, live video cards, channel filters and search, channel management, an AI article reader, and video-specific chat.

## Implementation

1. Add the YT Agent to the existing agent catalog as a special destination, keep it out of generic sector chat, and create a dedicated `/yt-agent` page with unique page metadata.
2. Build the new page using the existing Orion design tokens and controls. Include a compact Bengali/English date and time display, curated observance/countdown, and a daily Bengali quote within this workspace rather than replacing the homepage.
3. Load channel items from YouTube’s public RSS through a browser-accessible RSS converter; seed the exact four channel IDs supplied in the prompt. Allow channel URLs/IDs to be added and removed, and keep custom channels and summaries in local storage.
4. Reuse Orion’s existing AI providers for Bengali article generation and video-aware chat. Only present transcript text or exact quotes when an accessible source supplies them; otherwise identify the summary as based on available video details and search excerpts.
5. Add tests for the four default channel IDs and channel URL parsing, then verify the feed, reader, chat entry, mobile layout, page metadata, and preview build.

## Technical details

- Preserve the project’s browser-only data model and existing API-key storage.
- Do not alter the existing homepage design or add a database.
- RSS-converter availability and external AI-provider quotas remain external dependencies.
- Full video transcription/speech-to-text is not included in the browser-only implementation; add it only if the user opts into server processing.