## Divine Manager Feed – Developer Notes

_Last updated: 2026-07-23._

### Current scope

The `/dashboard` landing page now includes a live “Automated arbs” card that:

1. Queries the on-chain `TicketExecuted` event emitted by DivineManagerV2 at `0x50DF180Ea29a7872b54C5EC5241d4b889E4DEBF0` on PulseChain.
2. Fetches the full transaction receipts for the latest ~50 events and parses every ERC‑20 `Transfer`.
3. Reconstructs the compile / restore / swap sequence for each execution, including:
   - HolyC ↔ JIT compiler hops (4% fee surfaced as burn).
   - PulseX swaps against the 3 known pairs (HC/WPLS, JIT/WPLS, HC/JIT).
   - JIT transfer tax burns and compiler burns routed to `0x000…0000` / `0x000…0369`.
4. Produces renderable steps with icons, net deltas, burn totals, and estimated USD value.
5. Unwraps calls sent through Ahead-Of-Time Relayer V2 at `0x9E39d3c00A49AA244A62740f7209D4C133b5780c` before decoding the unchanged execution ticket.
6. Tracks the Briah, CoinMafia, DUMB, and FUPA partner buy-and-burn contracts in separate views.

### Key files

| File | Purpose |
| --- | --- |
| `src/hooks/useDivineManagerActivity.ts` | Fetches logs, receipts, parses transfer flows, classifies steps, filters out non-exec traffic. |
| `src/components/LandingPage/DivineManagerActivity.tsx` | UI for the feed: pagination, tooltip rendering, route/step/burn summaries. |
| `src/components/LandingPage/LandingPage.tsx` | Injects the feed component and wires price data & refresh controls. |
| `src/components/LandingPage/LandingPage.module.css` | Styles for the feed, tooltip, icons, burn badges, etc. |

### How the parser works

1. **Log fetch**: `useDivineManagerActivity` (hook) uses `getPublicClient` from wagmi to read logs for `TicketExecuted`. We limit to ~200k blocks and slice to 50 events.
2. **Relayer calldata**: V2 transactions target the relayer. The flow decoder extracts the ticket bytes from `executePlain`, `executeExempt`, and both funded variants.
3. **Receipts**: For each log we call `getTransactionReceipt` to inspect every ERC20 `Transfer`.
4. **Token detection**: We normalize addresses (HolyC, JIT, WPLS, PulseX pool addresses) and categorize transfers by direction:
   - `DivineManager → compiler (JIT contract)`: compile or restore.
   - `DivineManager ↔ pair` (HC/WPLS, JIT/WPLS, HC/JIT): swaps.
   - `→ burn` (0x0 / 0x369): permanent supply removal.
5. **Step queueing**:
   - When HolyC leaves manager and lands in JIT contract, we enqueue a `compile` step and match it to the following JIT mint.
   - When JIT leaves manager and hits zero address we enqueue a `restore`.
   - When manager interacts with a pair we create a `swap` step keyed by the pair address.
   - Each step object tracks token in/out amounts, pool metadata, and burn contributions.
6. **Filtering**: We drop logs where there’s no HolyC/JIT movement to keep policy events out of the feed.

### UI behavior

* The list is paginated (5 per page) with manual arrows and a refresh button.
* Each row shows:
  * `Execute` title + truncated hash.
  * HolyC and JIT burn stats (with flame icon).
  * Relative timestamp.
  * “Open on Otterscan” link.
* Hovering a row opens a tooltip showing:
  * Route headline (“HC→JIT via Compiler + JIT→HC via HC/JIT pool”).
  * Result headline summarizing net token delta and supply burns.
  * A timeline of each step with tokens, compiler, and pool icons.
  * Net outcome + burn impact + estimated USD (derived from Hero price feed).

### Outstanding work / ideas for next agent

1. **Accurate USD value**: currently we multiply burn amounts by spot prices. If you want “profit” in fiat, consider using net HolyC/JIT delta * price instead of burn-only.
2. **WPLS tracing**: we ignore WPLS flows; adding WPLS in/out helps reflect gas top-offs or pool movements.
3. **EOA caller context**: surfacing the caller (bot vs owner) or linking to their address can provide provenance.
4. **Route detection**: present compile/restore/swap sequences in natural language even when more than two steps occur (e.g., HC→JIT, JIT→HC/WPLS, swap to WPLS, restore).
5. **Trace-level verification**: We derive steps solely from transfers; optionally inspect `receipt.logs` for pair `Sync/Swap` events or use execution traces for better ordering.
6. **Persistent caching**: The hook re-fetches all receipts every minute. Introduce caching or indexing if RPC rate limits become a problem.
7. **Tooltips**: Evaluate accessibility / mobile (maybe convert to accordion).
8. **Icons**: We use the existing token logos and a basic compiler chip. If design provides new assets (e.g., dedicated compiler/pool icons) slot them into the tooltip.

### Quick start for future edits

```bash
cd "TempleOSfrontend  COPY /templeos-frontend"
npm install
npm run dev
# Feed files of interest:
vim src/hooks/useDivineManagerActivity.ts
vim src/components/LandingPage/DivineManagerActivity.tsx
vim src/components/LandingPage/LandingPage.module.css
```

### Testing

* `npm run build` (already clean) – ensures new parser doesn’t break Vite build.
* Consider adding unit tests around the step parser (e.g., fixture receipts parsed to specific route strings) if we iterate further.

Feel free to expand this doc as new requirements emerge.
