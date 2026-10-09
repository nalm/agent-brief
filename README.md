# x-data branch

Data-only orphan branch for the agent-brief webapp. It holds **only** `x-items.json`
(X posts gathered by hand/browser twice a day; no X API). Render deploys `master` only,
so pushing here never triggers a redeploy. The live app fetches this file at collect time:

    https://raw.githubusercontent.com/nalm/agent-brief/x-data/x-items.json

Do not edit by hand if you can avoid it — use `scripts/push-x-items.sh <file.json>` on master
(it validates, merges, dedupes and pushes here via a separate worktree).

## Schema

```jsonc
{
  "updatedAt": "2026-10-09T02:00:00.000Z",   // ISO string or null (set by the helper)
  "items": [
    {
      "id": "1844000000000000000",            // X post id (digits, string)
      "product": "grok",                       // "grok" | "dots" | "muse"
      "url": "https://x.com/xai/status/1844000000000000000", // https://x.com/<handle>/status/<id>
      "author": "xai",                         // handle, no "@"
      "authorName": "xAI",                     // display name
      "text": "Original post text…",           // original (untranslated) text
      "postedAt": "2026-10-09T01:23:45.000Z",  // ISO 8601
      "metrics": { "replies": 1, "reposts": 2, "likes": 3, "views": 4 }, // optional, numbers
      "topic": "launch"                        // optional: launch|pricing|partnership|reviews|regulation
    }
  ]
}
```

Rules enforced by the helper: `id` must match the id in `url`, `author` must match the
handle in `url` (case-insensitive), items are deduped by `id` (newer input wins), items older
than 14 days are dropped, and at most 150 newest items are kept.

The app maps each item to: source `X`, sourceType `sns`, title = first line of text (~80 chars),
summary = text, publishedAt = postedAt; topic is classified automatically when not given, and
English text is translated to Korean like every other source.
