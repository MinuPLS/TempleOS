# Divine Manager feed Worker

This is a separate Worker from `jit-burn-tracker`. It indexes only successful
`TicketExecuted` transactions from both Divine Manager deployments, recreates
the exact transfer-derived fields consumed by the dashboard, and stores one
compact JSON document per execution in D1. Failed transactions and raw receipt
logs are intentionally not stored.

## First deployment

```sh
cd "/Users/fotis/Documents/Crypto Projects/TempleOS/JIT Burn Tracker - Cloudflare Worker/divine-manager-feed-worker"
wrangler login
wrangler d1 create divine-manager-feed
# Paste the returned database_id into wrangler.toml.
wrangler d1 migrations apply divine-manager-feed --remote
wrangler secret put SYNC_SECRET # optional but recommended for the manual sync endpoint
wrangler deploy
```

The first scheduled run backfills the complete event history in batches of 25
executions, then the Worker follows the chain tip every minute with an eight
block reorg overlap. Check progress at `/divine-manager/status`. A manual
`POST /divine-manager/sync` is available after deployment (and requires the
`X-Sync-Secret` header when `SYNC_SECRET` is set).

The frontend consumes:

```
GET https://<worker-subdomain>/divine-manager/activity?limit=35&cursor=<optional>
```

Set its `VITE_DIVINE_MANAGER_FEED_URL` to the Worker origin and rebuild/redeploy
the frontend. The response is intentionally CORS-enabled and cached briefly at
the edge; the scheduler still remains the source of truth.
