# TempleOS shared archive Worker

This is the source-controlled extension for the existing Divine Manager Worker.
The original working Worker source and configuration are preserved verbatim in
[`upstream/divine-manager-feed-worker`](./upstream/divine-manager-feed-worker/).
The active `src/index.js` delegates its public API and minute indexer to that
source, then runs the additive archive publisher once an hour. Browser requests
never hit the Worker for archive data.

## One-time setup

1. Confirm the checked-in D1 binding is still the production Divine Manager
   database, then apply `schema.sql`. It changes no existing table or decoder.
2. Create the `templeos-public-archives` R2 bucket and bind it as shown in the
   configuration. Attach `data.holyc.app` as its custom domain; do not use
   `r2.dev` in production.
3. Configure R2 CORS with public read-only `GET`/`HEAD` access:

   ```json
   {"rules":[{"allowed":{"origins":["*"],"methods":["GET","HEAD"],"headers":[]},"exposeHeaders":[],"maxAgeSeconds":86400}]}
   ```

   Add a Cache Rule for `data.holyc.app/*`. The Worker writes
   `v2/manifest.json` with a five-minute cache lifetime and every other object
   with `public, max-age=31536000, immutable`; the Cache Rule is what makes the
   custom-domain JSON responses edge-cacheable.
4. Set `PUBLISH_TOKEN` and `PULSECHAIN_RPC_URL` as Worker secrets. The latter
   is never sent to the browser.
5. Deploy, then run `ARCHIVE_PUBLISHER_URL=... PUBLISH_TOKEN=... node
   scripts/seed-from-current.mjs` once. This uploads the five verified current
   snapshots plus the intentionally empty Feeder base, writes the cutover
   cursor, and immediately produces the first reserve/burn publication.

   The Feeder did not have a historical snapshot in the old workflow. Initialize
   it with `POST /archive/admin/feeder/initialize`, then call
   `POST /archive/admin/feeder/backfill` repeatedly. Each call scans exactly
   2,500 historical blocks, saves its durable cursor, and can safely be stopped
   and resumed. The hourly publisher only scans its 128-block reorg overlap and
   new blocks; it never performs this backfill.

   To seed the newest committed snapshot without changing the working tree,
   fetch it and add `ARCHIVE_SNAPSHOT_REF=origin/main` to that command.

The seed script calls protected routes under `/archive/admin/*`; set
`PUBLISH_TOKEN` (and preferably `PULSECHAIN_RPC_URL`) with `wrangler secret put`.
Existing `/divine-manager/*` routes and `SYNC_SECRET` behavior remain unchanged.

## Public contract

`v2/manifest.json` is written last. It declares `schemaVersion: 2`, generation
time, chain/through-block metadata, a V1 base object, immutable 25-record
chunks, a mutable versioned open chunk for each archive, and current pool/JIT
object keys. Every chunk has `resource`, `fromBlock`, `throughBlock`, and
normalized `items`. Superseded open chunks are retained for seven days.

## Release sequence

Validate the freshly seeded R2 records against the existing static files, then
set `VITE_DATA_MANIFEST_URL=https://data.holyc.app/v2/manifest.json` for the
Pages preview. The included comparison workflow can still be enabled with
`SHARED_ARCHIVE_VALIDATION_ENABLED=true` and
`SHARED_ARCHIVE_MANIFEST_URL=https://data.holyc.app/v2/manifest.json`; a
mismatch fails the check. Once the Pages preview is accepted, disable the
GitHub snapshot workflow.

After the validation window, create the Pages project from `main` (root
directory `templeos-frontend`, build `npm run build`, output `dist`) with
`VITE_PROJECT_ID` and `VITE_DATA_MANIFEST_URL` configured for Production and
Preview. Keep Vercel as rollback for seven days after the custom-domain switch.

`runPublish` intentionally performs only incremental scans. It derives pool
identity and volume from at most four newly indexed Manager receipts per hourly
run, then writes current reserves for every known Manager pool. The pre-cutover
pool and volume history is seeded from the verified snapshots.
