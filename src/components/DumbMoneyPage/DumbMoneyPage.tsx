'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import DumbLogo from '../../assets/TokenLogos/Dumb.png'
import DampLogo from '../../assets/TokenLogos/Damb.png'
import styles from './DumbMoneyPage.module.css'

type IconKey = 'coin' | 'flame' | 'tax' | 'sparkle' | 'cycle' | 'burn'

const ICONS: Record<IconKey, React.ReactElement> = {
  coin: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="#fbbf24" strokeWidth="1.4" />
      <path d="M8 4.5v7M5.5 6.5h4a1 1 0 010 2H5.5" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  flame: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2C8 2 5.5 5 5.5 7.5c0 .9.3 1.6.8 2.1C6 8.5 6.2 7.2 7 6.8c0 2.2 1.2 2.8 1.2 4.2a1.8 1.8 0 003.6 0C11.8 8.5 10 7 10 4.5c.5 1 .5 2-.3 2.7.4-.9.3-2-.7-3-.3 1-.8 1.2-1 1.3C8.5 4.5 8 2 8 2Z"
        fill="#f97316"
      />
    </svg>
  ),
  tax: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="1.6" fill="#a78bfa" />
      <circle cx="11" cy="11" r="1.6" fill="#a78bfa" />
      <line x1="3.5" y1="12.5" x2="12.5" y2="3.5" stroke="#a78bfa" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  sparkle: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1L9.5 6.5H15L10.3 9.8L12 15.5L8 12L4 15.5L5.7 9.8L1 6.5H6.5L8 1Z" fill="#38bdf8" />
    </svg>
  ),
  cycle: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13.5 8A5.5 5.5 0 113.2 4.5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 2v3h3" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  burn: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2C8 2 5.5 5 5.5 7.5c0 .9.3 1.6.8 2.1C6 8.5 6.2 7.2 7 6.8c0 2.2 1.2 2.8 1.2 4.2a1.8 1.8 0 003.6 0C11.8 8.5 10 7 10 4.5c.5 1 .5 2-.3 2.7.4-.9.3-2-.7-3-.3 1-.8 1.2-1 1.3C8.5 4.5 8 2 8 2Z"
        fill="#f87171"
      />
    </svg>
  ),
}

// ── Live stats SVG icons ──────────────────────────────────────────────────────
const STAT_ICONS = {
  price: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <polyline points="1,12 5,7 8,9 12,4 15,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  liquidity: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M13.5 8A5.5 5.5 0 113.2 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  burned: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2C8 2 5.5 5 5.5 7.5c0 .9.3 1.6.8 2.1C6 8.5 6.2 7.2 7 6.8c0 2.2 1.2 2.8 1.2 4.2a1.8 1.8 0 003.6 0C11.8 8.5 10 7 10 4.5c.5 1 .5 2-.3 2.7.4-.9.3-2-.7-3-.3 1-.8 1.2-1 1.3C8.5 4.5 8 2 8 2Z"
        fill="currentColor"
      />
    </svg>
  ),
  marketcap: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1" y="10" width="3" height="5" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="6" y="6" width="3" height="9" rx="1" fill="currentColor" opacity="0.85" />
      <rect x="11" y="2" width="3" height="13" rx="1" fill="currentColor" />
    </svg>
  ),
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PULSECHAIN_RPC = 'https://rpc.pulsechain.com'
const DEAD_STANDARD = '0x000000000000000000000000000000000000dEaD'
const DEAD_PULSE    = '0x0000000000000000000000000000000000000369'
const DUMB_CA = '0xe65112d2f120c8cb23ADC80D8E8122c0c8b7fF8D'
const DAMP_CA = '0x8357aA9070dc7d8d154Da74561CEc58cA30c41C3'

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function rpcCall(to: string, data: string): Promise<string> {
  const res = await fetch(PULSECHAIN_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
      id: 1,
    }),
  })
  const json = await res.json()
  return json.result && json.result !== '0x' ? json.result : '0x0'
}

function balanceOfCalldata(holder: string): string {
  return '0x70a08231' + holder.toLowerCase().replace('0x', '').padStart(64, '0')
}

function formatTokenAmount(raw: bigint, decimals = 18): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = Number(raw / divisor)
  if (whole >= 1e9) return (whole / 1e9).toFixed(2) + 'B'
  if (whole >= 1e6) return (whole / 1e6).toFixed(2) + 'M'
  if (whole >= 1e3) return (whole / 1e3).toFixed(2) + 'K'
  return whole.toLocaleString()
}

function formatUSD(n: number): string {
  if (!n || n <= 0) return '$0'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + Math.round(n / 1e3).toLocaleString() + 'K'
  return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatPrice(p: number): string {
  if (!p || p <= 0) return '—'
  if (p >= 1)      return '$' + p.toFixed(4)
  if (p >= 0.01)   return '$' + p.toFixed(6)
  if (p >= 0.0001) return '$' + p.toFixed(8)
  // Very small prices — strip trailing zeros
  const s = p.toFixed(12)
  const trimmed = s.replace(/0+$/, '').replace(/\.$/, '')
  return '$' + trimmed
}

function getBurnBalanceHolders(tokenAddress: string): string[] {
  const holders = [DEAD_STANDARD, DEAD_PULSE]
  if (tokenAddress.toLowerCase() === DUMB_CA.toLowerCase()) {
    // $DUMB parked inside the token contract is treated as permanently removed.
    holders.push(DUMB_CA)
  }
  return holders
}

async function getBurnedForToken(tokenAddress: string): Promise<string> {
  const ticker = tokenAddress.toLowerCase() === DUMB_CA.toLowerCase() ? '$DUMB' : '$DAMP'
  const burnBalances = await Promise.all(
    getBurnBalanceHolders(tokenAddress).map((holder) => rpcCall(tokenAddress, balanceOfCalldata(holder))),
  )
  const total = burnBalances.reduce((sum, balance) => sum + BigInt(balance), 0n)
  return formatTokenAmount(total) + ' ' + ticker
}

async function fetchDexStats(address: string): Promise<{ price: string; liquidity: string; marketCap: string }> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
  const json = await res.json()
  const pairs: any[] = (json.pairs || []).filter((p: any) => p.chainId === 'pulsechain')
  if (!pairs.length) return { price: '—', liquidity: '—', marketCap: '—' }

  // Aggregate liquidity across every PulseChain pool for this token.
  const totalLiquidityUsd = pairs.reduce((sum, pair) => sum + (Number(pair.liquidity?.usd) || 0), 0)

  // Keep price/market-cap from the deepest pool to avoid noisy tiny pools.
  const best = pairs.reduce((currentBest, pair) => {
    const currentLiq = Number(currentBest.liquidity?.usd) || 0
    const pairLiq = Number(pair.liquidity?.usd) || 0
    return pairLiq > currentLiq ? pair : currentBest
  }, pairs[0])

  return {
    price:      formatPrice(parseFloat(best.priceUsd ?? '0')),
    liquidity:  formatUSD(totalLiquidityUsd),
    marketCap:  formatUSD(best.fdv ?? best.marketCap ?? 0),
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface LiveStats {
  price: string
  liquidity: string
  burned: string
  marketCap: string
}

// ── TempleOS Info Modal ───────────────────────────────────────────────────────
function TempleOSInfoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTerminalDot} />
          <span className={styles.modalTerminalDot} />
          <span className={styles.modalTerminalDot} />
          <span className={styles.modalTitle}>// TempleOS :: Transmission</span>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.modalGreeting}>Greetings, Traveler.</p>

          <p className={styles.modalText}>
            You have reached the <span className={styles.modalHighlightBlue}>Dumbmoney Dashboard</span>, currently
            being hosted within the <span className={styles.modalHighlightPurple}>TempleOS ecosystem</span>.
          </p>

          <div className={styles.modalSection}>
            <h4 className={styles.modalSectionTitle}>
              <span className={styles.modalPrompt}>&gt;_</span> Why is this here?
            </h4>
            <p className={styles.modalText}>
              The original Dumbmoney scrolls (website) were lost to the void. As a gesture of goodwill and to
              facilitate our upcoming partnership, I have rebuilt this interface and hosted it here to ensure the
              community retains access to their data and live on-chain stats.
            </p>
          </div>

          <div className={styles.modalSection}>
            <h4 className={styles.modalSectionTitle}>
              <span className={styles.modalPrompt}>&gt;_</span> The Fine Print:
            </h4>
            <ul className={styles.modalList}>
              <li>I am <span className={styles.modalHighlightPink}>NOT</span> a developer or team member of Dumbmoney.</li>
              <li>This is a voluntary contribution to help a fellow niche project.</li>
              <li>
                Hosting this page is a win-win: they get a home, and you get to see what
                we're building here at <span className={styles.modalHighlightPurple}>TempleOS</span>.
              </li>
            </ul>
          </div>

          <p className={styles.modalClosingLine}>
            Enjoy the stats. Stay focused.{' '}
            <span className={styles.modalHighlightGreen}>God bless the chain.</span>
          </p>
        </div>

        <div className={styles.modalFooter}>
          <a href="/" className={styles.modalBtnPrimary}>
            TempleOS
          </a>
          <button className={styles.modalBtnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
const dumbTokenomics: { icon: IconKey; label: string; value: string; note?: string }[] = [
  { icon: 'coin', label: 'Total Supply', value: '28 Billion' },
  { icon: 'flame', label: 'Initial Burn', value: '14 Billion' },
  { icon: 'tax', label: 'Tax', value: '6%', note: 'Buys, Sells & Transfers' },
  { icon: 'sparkle', label: 'Reflections', value: '1%', note: 'Rewarding holders' },
  { icon: 'cycle', label: 'Liquidity', value: '2%', note: 'Pool support / LP growth' },
  { icon: 'burn', label: 'Burn Paths $DUMB', value: '3%', note: '2% buy & burn + 1% direct burn' },
]

const dampTokenomics: { icon: IconKey; label: string; value: string; note?: string }[] = [
  { icon: 'coin', label: 'Total Supply', value: '1 Billion' },
  { icon: 'flame', label: 'Initial Burn', value: '300 Million' },
  { icon: 'tax', label: 'Tax', value: '3%', note: 'Buys, Sells & Transfers' },
  { icon: 'sparkle', label: 'Reflection', value: '1%', note: 'Rewarding holders' },
  { icon: 'cycle', label: 'Buy & Burn $DUMB', value: '1%', note: 'Cross-token deflation support' },
  { icon: 'burn', label: 'Burn $DAMP', value: '1%', note: 'Direct $DAMP supply reduction' },
]

function StatRow({
  icon,
  label,
  value,
  note,
  accent,
}: {
  icon: IconKey
  label: string
  value: string
  note?: string
  accent: 'green' | 'pink'
}) {
  return (
    <div className={styles.statRow}>
      <div className={styles.statLeft}>
        <span className={styles.statIcon}>{ICONS[icon]}</span>
        <span className={styles.statLabel}>
          {label}
          {note && <span className={styles.statNote}> — {note}</span>}
        </span>
      </div>
      <span className={accent === 'green' ? styles.statValueGreen : styles.statValuePink}>{value}</span>
    </div>
  )
}

function CopyAddress({ label, address, theme }: { label: string; address: string; theme: 'green' | 'pink' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback silent fail
    }
  }

  return (
    <div
      className={`${styles.addressBlock} ${theme === 'green' ? styles.addressBlockDumb : styles.addressBlockDamp}`}
      onClick={handleCopy}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCopy()}
    >
      <div className={styles.addressTopRow}>
        <span className={styles.addressLabel}>{label}</span>
        {copied && (
          <span className={theme === 'green' ? styles.copiedGreen : styles.copiedPink}>✓ Copied!</span>
        )}
      </div>
      <span className={styles.addressText}>{address}</span>
    </div>
  )
}

function LiveStatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactElement
  label: string
  value: string
  accent: 'green' | 'pink'
}) {
  return (
    <div className={`${styles.liveStatCard} ${accent === 'green' ? styles.liveStatCardGreen : styles.liveStatCardPink}`}>
      <div className={styles.liveStatTop}>
        <span className={`${styles.liveStatIcon} ${accent === 'green' ? styles.liveStatIconGreen : styles.liveStatIconPink}`}>
          {icon}
        </span>
        <span className={styles.liveStatLabel}>{label}</span>
      </div>
      <span className={accent === 'green' ? styles.liveStatValueGreen : styles.liveStatValuePink}>
        {value}
      </span>
    </div>
  )
}

const SKELETON = '···'

function LiveStatsColumn({
  title,
  accent,
  stats,
  loading,
}: {
  title: string
  accent: 'green' | 'pink'
  stats: LiveStats | null
  loading: boolean
}) {
  const ph = loading ? SKELETON : '—'
  return (
    <div className={styles.liveStatsCol}>
      <h3 className={`${styles.liveStatsTitle} ${accent === 'green' ? styles.liveTitleGreen : styles.liveTitlePink}`}>
        {title}
      </h3>
      <div className={styles.liveStatGrid}>
        <LiveStatCard icon={STAT_ICONS.price}     label="Price"      value={stats?.price      ?? ph} accent={accent} />
        <LiveStatCard icon={STAT_ICONS.liquidity}  label="Liquidity"  value={stats?.liquidity  ?? ph} accent={accent} />
        <LiveStatCard icon={STAT_ICONS.burned}     label="Burned"     value={stats?.burned     ?? ph} accent={accent} />
        <LiveStatCard icon={STAT_ICONS.marketcap}  label="Market Cap" value={stats?.marketCap  ?? ph} accent={accent} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
function DumbMoneyPage() {
  const [dumbStats, setDumbStats] = useState<LiveStats | null>(null)
  const [dampStats, setDampStats] = useState<LiveStats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [infoOpen, setInfoOpen]   = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      try {
        const [dumbDex, dampDex, dumbBurned, dampBurned] = await Promise.all([
          fetchDexStats(DUMB_CA),
          fetchDexStats(DAMP_CA),
          getBurnedForToken(DUMB_CA),
          getBurnedForToken(DAMP_CA),
        ])
        if (!cancelled) {
          setDumbStats({ ...dumbDex, burned: dumbBurned })
          setDampStats({ ...dampDex, burned: dampBurned })
        }
      } catch {
        // fail silently — values stay null, UI shows '—'
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadStats()
    return () => { cancelled = true }
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.bgGlowOne} />
      <div className={styles.bgGlowTwo} />
      <div className={styles.bgGlowThree} />

      <main className={styles.shell}>
        {/* ── Hero ── */}
        <section className={`${styles.panel} ${styles.heroPanel}`}>
          <p className={styles.logoBadge}>DumbMoney.win</p>
          <h1 className={styles.heroTitle}>
            Welcome to{' '}
            <span className={styles.titleDumb}>Dumb</span>
            <span className={styles.titleMoney}>Money</span>
            <span className={styles.titleWin}>.win</span>
          </h1>
          <p className={styles.heroLead}>
            DumbMoney.win is a fully decentralized token ecosystem that operates with zero human intervention—just you
            and the code. Built for true decentralization, it has no owner and no admin keys, ensuring that it runs
            purely on immutable smart contracts that cannot be altered.
          </p>

          <div className={styles.heroBtnRow}>
            <button className={styles.heroBtnTempleOS} onClick={() => setInfoOpen(true)}>
              About this Page
            </button>
            <a
              href="https://t.me/dumbmoneydotwin"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.heroBtnTelegram}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 13.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z" />
              </svg>
              Telegram
            </a>
          </div>

          {infoOpen && <TempleOSInfoModal onClose={() => setInfoOpen(false)} />}
        </section>

        {/* ── Token Grid ── */}
        <div className={styles.tokenGrid}>

          {/* ── $DUMB ── */}
          <article className={`${styles.panel} ${styles.tokenPanel} ${styles.panelDumb}`}>
            <div className={styles.tokenTitleRow}>
              <img src={DumbLogo} alt="$DUMB" className={`${styles.tokenLogo} ${styles.tokenLogoDumb}`} />
              <h2 className={styles.tokenTitleDumb}>$DUMB — Smartest Dumb Money</h2>
            </div>

            <div className={styles.tokenDesc}>
              <p className={styles.tokenLine}>
                A fully decentralized token ecosystem that operates with zero human intervention—just you and the code.
                $DUMB — The Smartest Dumb Money
              </p>
              <p className={styles.tokenLine}>They called it dumb money—so we made it unstoppable. 💰</p>
              <p className={styles.tokenLine}>
                $DUMB is a fully decentralized, self-running token with no admin keys, no rug risks, and all LPs burnt.
              </p>
              <p className={styles.tokenLine}>
                Every trade fuels the ecosystem with reflections, liquidity boosts, and an automated buy &amp; burn.
                It&apos;s dumb, but it&apos;s built different.
              </p>
            </div>

            <CopyAddress label="DumbMoney — $Dumb" address="0xe65112d2f120c8cb23ADC80D8E8122c0c8b7fF8D" theme="green" />

            <div className={`${styles.tokenomicsCard} ${styles.tokenomicsCardDumb}`}>
              <h3 className={styles.tokenomicsTitle}>
                <span className={styles.tokenomicsDotGreen}>◆</span> $DUMB Tokenomics
              </h3>
              <div className={styles.statList}>
                {dumbTokenomics.map((item, i) => (
                  <StatRow key={i} icon={item.icon} label={item.label} value={item.value} note={item.note} accent="green" />
                ))}
              </div>
            </div>
          </article>

          {/* ── $DAMP ── */}
          <article className={`${styles.panel} ${styles.tokenPanel} ${styles.panelDamp}`}>
            <div className={styles.tokenTitleRow}>
              <img src={DampLogo} alt="$DAMP" className={`${styles.tokenLogo} ${styles.tokenLogoDamp}`} />
              <h2 className={styles.tokenTitleDamp}>$DAMP — Amplify the Dumbness</h2>
            </div>

            <div className={styles.tokenDesc}>
              <p className={styles.tokenLine}>What&apos;s better than dumb money? A dumb amplifier. 📢🚀</p>
              <p className={styles.tokenLine}>
                $DAMP Token serves as a powerful amplifier within the Dumbmoney.win ecosystem. Engineered for impact,
                it enhances bot activity and boosts token volume for both itself and $DUMB.
              </p>
              <p className={styles.tokenLine}>
                $DAMP exists to supercharge $DUMB with volume, burns, and reflections.
              </p>
              <p className={styles.tokenLine}>
                With every transaction, it pumps both itself and $DUMB, making sure the ecosystem never stops moving.
                More trades, more burns, more dumb fun.
              </p>
            </div>

            <CopyAddress label="Dumb Amplifier — $Damb" address="0x8357aA9070dc7d8d154Da74561CEc58cA30c41C3" theme="pink" />

            <div className={`${styles.tokenomicsCard} ${styles.tokenomicsCardDamp}`}>
              <h3 className={styles.tokenomicsTitle}>
                <span className={styles.tokenomicsDotPink}>◆</span> $DAMP Tokenomics
              </h3>
              <div className={styles.statList}>
                {dampTokenomics.map((item, i) => (
                  <StatRow key={i} icon={item.icon} label={item.label} value={item.value} note={item.note} accent="pink" />
                ))}
              </div>
            </div>
          </article>

        </div>

        {/* ── Live Token Stats ── */}
        <section className={`${styles.panel} ${styles.liveStatsPanel}`}>
          <div className={styles.liveStatsRow}>
            <LiveStatsColumn title="$DUMB Statistics" accent="green" stats={dumbStats} loading={loading} />
            <div className={styles.liveStatsDivider} />
            <LiveStatsColumn title="$DAMP Statistics" accent="pink"  stats={dampStats} loading={loading} />
          </div>
          <p className={styles.liveStatsFootnote}>
            Live data fetched on page load · Burned = dead address + PulseChain dead address (0x…0369) + $DUMB held in the $DUMB contract
          </p>
        </section>

      </main>
    </div>
  )
}

export default DumbMoneyPage
