# Telegram -> X Arb Automation Handoff

## Purpose
This documents the automation added on March 6, 2026 that posts to X immediately after a Telegram arb update is successfully posted.

## Files Added/Changed
- `scripts/x-arb-poster.mjs` (new): Handles X post text building, OAuth 1.0a signing, media upload, and status creation.
- `scripts/telegram-arb-bot.mjs` (updated): Calls X posting right after `sendTelegramArbUpdate(message)` succeeds.
- `.github/workflows/telegram-arb-bot.yml` (updated): Passes X-related env vars and secrets into the bot run step.

## End-to-End Flow
1. `telegram-arb-bot.mjs` builds the arb message (`buildArbMessage`).
2. In normal mode, it posts to Telegram with `sendTelegramArbUpdate(message)`.
3. It then calls:
   - `maybePostArbUpdateToX({ telegramHtmlMessage: message, mediaPath: ARB_MEDIA_PATH, dryRun: DRY_RUN })`
4. `x-arb-poster.mjs`:
   - Converts Telegram HTML caption into X-friendly text.
   - Uploads media to X (INIT -> APPEND chunk(s) -> FINALIZE -> STATUS polling).
   - Posts the tweet/status with uploaded media ID.

Important: X posting errors are caught and logged in `telegram-arb-bot.mjs`, and do not stop Telegram posting/state updates.
Important: `FORCE_X_POST=true` runs an X-only forced latest-arb post (skips Telegram arb send, skips daily post, and does not mutate state).

## Toggle + Required Secrets
X posting is disabled unless:
- `POST_X_ARB_UPDATES=true`

Required secrets/env when enabled:
- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`

Configured in workflow:
- `.github/workflows/telegram-arb-bot.yml` in the `Run Telegram bot` step env block.
- `workflow_dispatch` now includes `force_x_post` for forcing a latest X arb post only.

## Message Formatting Rules
`buildXPostTextFromTelegramMessage()` attempts to extract:
- `Gained:`
- `Value:`
- `HolyC Burned:`
- Partner burn lines (Briah/CoinMafia/DumbMoney) and their USD values
- TX link (`<a ...>TX</a>`)

It then produces:
- Header: `New On-Chain Arb Executed!`
- Gains line without label (from Telegram `Gained:` value only), e.g. `+17.21K HolyC | -281.20 JIT`
- `Value:` line
- `Burned:` line (mapped from Telegram `HolyC Burned:`)
- `Partner Buy&Burn: BRIAH ... | COINMAFIA ... | DUMB ...` (always present; missing values shown as `—`)
- Blank line, then:
  - `TX: https://...`
  - `Website: https://holycpls.vercel.app/`

If parsing fails, it falls back to stripped plain text and truncates to 280 chars.

## Media Upload Behavior
- Uses X v1.1 upload endpoint: `https://upload.twitter.com/1.1/media/upload.json`
- Uses X v2 create tweet endpoint first: `https://api.twitter.com/2/tweets`
- Falls back to v1.1 status update endpoint if needed: `https://api.twitter.com/1.1/statuses/update.json`
- MIME detection by file extension (`.mp4`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`)
- Video category: `tweet_video`
- Chunk size: 4 MB per APPEND segment
- Polls STATUS until `succeeded` (or times out/fails)

Current arb media path passed from Telegram bot:
- `scripts/NewArbitrageAndParter.png`

## DRY_RUN Behavior
When `DRY_RUN=true`:
- Telegram code prints messages instead of posting.
- X module logs the post text and media path and returns success without requiring X credentials.

## Error Handling
- If `POST_X_ARB_UPDATES` is not `true`, function exits early (no-op).
- Missing credentials throw a clear error (only when posting is enabled and not dry-run).
- Media upload/posting errors throw and are caught by Telegram bot wrapper:
  - Log: `Failed to post arb update on X: ...`
  - Bot continues.

## Local Test Commands
- Syntax checks:
  - `node --check scripts/x-arb-poster.mjs`
  - `node --check scripts/telegram-arb-bot.mjs`
- Optional text transform quick test:
  - `node -e 'import("./scripts/x-arb-poster.mjs").then(m=>console.log(m.buildXPostTextFromTelegramMessage("<b>Divine Manager Activity</b>...")))'`

## Implementation Notes For Next Agent
- This uses OAuth 1.0a signed requests (HMAC-SHA1), not OAuth2 bearer tokens.
- APPEND responses may be empty; parser allows empty success responses for APPEND.
- Hook point is intentionally after Telegram success to satisfy "fires after telegram arb update is posted."

## Suggested Next Improvements
- Add optional dedupe state for X post IDs in case future retry logic is added.
- Add feature flag to choose different media per channel (Telegram vs X).
- Add unit tests around `buildXPostTextFromTelegramMessage()`.
- Add fallback to post without media if media upload fails (currently it fails whole X post attempt).
