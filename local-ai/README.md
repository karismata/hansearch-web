# HanSearch Local AI (Mac mini)

This service is the Mac mini side of HanSearch AI search. It reads the existing
Supabase `info` table, creates local Ollama embeddings, and periodically replaces
its local snapshot only after a complete successful sync. Deleted Supabase rows
therefore disappear from the next successful snapshot. Image URLs are kept as
references; image files are not downloaded.

## Current stage

The local status/search server binds to `127.0.0.1` only. Website requests are
relayed through the HanSearch Cloudflare Worker; the Mac makes outbound HTTPS
requests and no home-router port is exposed. Query and compact search results
are held briefly in the Cloudflare Durable Object queue and expire after ten
minutes. Search and answer generation still run on the Mac mini.

## Run on the Mac mini

1. Install Python 3 if needed (`python3 --version`). No Python packages are required.
2. Copy `.env.example` to `.env` in this directory. Check the Supabase URL/key/table
   against HanSearch's Settings screen if you changed them there.
3. Set `AI_ACCESS_TOKEN` to the same random key configured as the Cloudflare Worker
   secret and entered in HanSearch's Settings screen. Use a random key of at least
   32 characters; never commit `.env`.
4. In Terminal, from this directory, run `python3 server.py`.
5. Open `http://127.0.0.1:8765/health` on the Mac mini. Initial sync starts
   automatically; later syncs run every five minutes.
6. A successful sync reports a count in Terminal and `/health`. The local snapshot
   is stored in `data/items.json` (ignored by Git).

To request an immediate sync from another Terminal window:

```sh
curl -X POST http://127.0.0.1:8765/sync
```

To try a local semantic search:

```sh
curl -X POST http://127.0.0.1:8765/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"단말기 인증이 실패해요"}'
```

The sync uses Supabase's public read key and requires the table's existing RLS
policy to allow reading. It does not write to Supabase. If a full read or embedding
operation fails, the prior local snapshot is retained. A later successful sync
reconciles additions, edits, and deletions. The Worker relay is available only
after its AIQueue Durable Object migration is deployed and the `AI_ACCESS_TOKEN`
Worker secret is configured.
