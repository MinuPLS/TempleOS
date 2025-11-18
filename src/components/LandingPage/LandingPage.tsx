import { useState, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import styles from './LandingPage.module.css'
import { DivineManagerActivity } from './DivineManagerActivity'
import { usePoolData } from '../UniswapPools/hooks/usePoolData'
import { useTokenStats } from '../StatsDashboard/hooks/useTokenStats'
import { useDivineManagerActivity } from '@/hooks/useDivineManagerActivity'
import { formatBigIntTokenAmount } from '@/lib/utils'
import HolyCLogo from '../../assets/TokenLogos/HolyC.png'
import JITLogo from '../../assets/TokenLogos/JIT.png'
import PulseXLogo from '../../assets/TokenLogos/PulseX.png'

type TokenStatAccent = 'holyc' | 'jit' | 'locked' | 'burned' | 'lp'

export function LandingPage() {
  const { tokenPrices } = usePoolData()
  const { tokenStats } = useTokenStats()
  const {
    executions: divineExecutions,
    isLoading: isDivineLoading,
    error: divineError,
    lastUpdated: divineLastUpdated,
    refresh: refreshDivine,
  } = useDivineManagerActivity()

  const [openStatId, setOpenStatId] = useState<string | null>(null)
  const [openHowCards, setOpenHowCards] = useState<Record<string, boolean>>({})
  const howBodyRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const keyTokenStats: {
    id: string
    label: string
    value: string
    description: string
    accent: TokenStatAccent
  }[] = [
    {
      id: 'circulating-holyc',
      label: 'HolyC circulating',
      value: `${formatBigIntTokenAmount(tokenStats.circulatingHolyC, 0)} HOLYC`,
      description:
        'All available HolyC held in wallets and contracts, including the portion in the Compiler that can still be redeemed by restoring JIT.',
      accent: 'holyc',
    },
    {
      id: 'jit-supply',
      label: 'JIT supply',
      value: `${formatBigIntTokenAmount(tokenStats.jitCirculating, 0)} JIT`,
      description:
        'JIT compiled from HolyC – the tradable, deflationary wrapper. Backed 1:1 by HolyC, but compile/restore/transfer fees mean you always get slightly less back.',
      accent: 'jit',
    },
    {
      id: 'locked-holyc',
      label: 'Locked HolyC',
      value: `${formatBigIntTokenAmount(tokenStats.permanentlyLockedHolyC, 0)} HOLYC`,
      description:
        'HolyC permanently trapped in the Compiler by JIT transfer burns and fees. It can never be withdrawn or redeemed, because there is not enough JIT in circulation to restore it.',
      accent: 'locked',
    },
    {
      id: 'burned-holyc',
      label: 'Burned HolyC',
      value: `${formatBigIntTokenAmount(tokenStats.holycFeesBurned, 0)} HOLYC`,
      description:
        'HolyC sent to the burn address from compile/restore fees or manual burns – permanently removed from supply.',
      accent: 'burned',
    },
    {
      id: 'burned-lp',
      label: 'Burned LP',
      value: `${formatBigIntTokenAmount(tokenStats.holycLockedAsLP, 0)} HOLYC`,
      description:
        'HolyC currently deposited as liquidity on the DEX. The LP tokens were burned, so liquidity cannot be withdrawn; the HolyC stays in the pool for trading and moves into circulating supply as it is bought.',
      accent: 'lp',
    },
  ]

  const handleToggleStat = (id: string) => {
    setOpenStatId((prev) => (prev === id ? null : id))
  }

  const toggleHowCard = (id: string) => {
    setOpenHowCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleHowKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleHowCard(id)
    }
  }

  const getHowBodyHeight = (id: string) => howBodyRefs.current[id]?.scrollHeight ?? 0

  const heroLinks = [
    {
      href: 'https://dexscreener.com/pulsechain/0x28be4ad6d58ab4aacea3cb42bde457b7da251bac',
      label: 'Dexscreener',
    },
    {
      href: 'https://x.com/HolyCpls',
      label: 'X (Twitter)',
    },
    {
      href: 'https://t.me/HolyCPulse',
      label: 'Telegram',
    },
  ]

  const howCards: {
    id: string
    title: string
    summary: ReactNode
    body: ReactNode
    cardClass: string
  }[] = [
    {
      id: 'anchor',
      title: 'Two markets, one anchor',
      cardClass: styles.howCardAnchor,
      summary: (
        <>
          <p>
            <span className={styles.textHolyc}>HolyC</span> trades in{' '}
            <span className={styles.textHolyc}>HolyC</span>/<span className={styles.textPls}>PLS</span>,{' '}
            <span className={styles.textJit}>JIT</span> trades in{' '}
            <span className={styles.textJit}>JIT</span>/<span className={styles.textPls}>PLS</span>.
          </p>
          <p>
            The <span className={styles.textAnchor}>Divine Compiler</span> sits in the middle with a fixed{' '}
            <span className={styles.textHolyc}>HolyC</span> ↔ <span className={styles.textJit}>JIT</span> rate.
          </p>
        </>
      ),
      body: (
        <>
          <p>
            When either pool wanders too far from that rate, a price gap appears. Normal AMM{' '}
            <span className={styles.textArb}>arb bots</span> then bounce through the triangle (
            <span className={styles.textHolyc}>HolyC</span>/<span className={styles.textPls}>PLS</span> →{' '}
            <span className={styles.textHolyc}>HolyC</span>/<span className={styles.textJit}>JIT</span> →{' '}
            <span className={styles.textJit}>JIT</span>/<span className={styles.textPls}>PLS</span> or the other way around) to
            close the pool prices and take their spread.
          </p>
          <p>
            That anchor lives outside AMM pricing, so pools are constantly catching up to the{' '}
            <span className={styles.textAnchor}>Compiler</span> whenever the market drifts too far.
          </p>
        </>
      ),
    },
    {
      id: 'burn',
      title: 'Where the burn actually comes from',
      cardClass: styles.howCardBurn,
      summary: (
        <>
          <p>
            Every compile/restore charges a <span className={styles.textBurn}>4% HolyC fee</span>. Every{' '}
            <span className={styles.textJit}>JIT</span> transfer burns <span className={styles.textBurn}>2%</span> of the{' '}
            <span className={styles.textJit}>JIT</span> amount. <span className={styles.textHolyc}>HolyC</span> and{' '}
            <span className={styles.textJit}>JIT</span> share the same system supply: JIT only exists while{' '}
            <span className={styles.textHolyc}>HolyC</span> is locked in the{' '}
            <span className={styles.textAnchor}>Compiler</span>.
          </p>
        </>
      ),
      body: (
        <>
          <p>
            Volume moving between <span className={styles.textHolyc}>HolyC</span>/
            <span className={styles.textJit}>JIT</span> and the two <span className={styles.textPls}>PLS</span> pools keeps{' '}
            <span className={styles.textJit}>JIT</span> transferring – and burning – over time.
          </p>
          <p>
            Because less and less <span className={styles.textJit}>JIT</span> exists, there isn’t enough left to restore every
            locked <span className={styles.textHolyc}>HolyC</span>. That “orphaned” <span className={styles.textHolyc}>HolyC</span>{' '}
            stays trapped in the <span className={styles.textAnchor}>Compiler</span> forever.
          </p>
          <p>
            Every <span className={styles.textJit}>JIT</span> burn is effectively an indirect{' '}
            <span className={styles.textHolyc}>HolyC</span> burn, slowly deleting circulating supply even though HolyC stays
            tax-free.
          </p>
        </>
      ),
    },
    {
      id: 'automation',
      title: 'What’s automated for you',
      cardClass: styles.howCardAutomation,
      summary: (
        <>
          <p>
            As a holder you don’t need to touch any of this; you just trade or hold{' '}
            <span className={styles.textHolyc}>HolyC</span> while complexity is automated for you in the background.
          </p>
        </>
      ),
      body: (
        <>
          <p>
            Timing each <span className={styles.textArb}>arb</span>, sizing it, and routing around fees, slippage and gas is
            messy.
          </p>
          <p>
            The engine runs on an automated combo of <span className={styles.textArb}>Arb Guardian</span> (off-chain) and{' '}
            <span className={styles.textAnchor}>Divine Manager</span> (on-chain) – it closes safe arbs, builds the{' '}
            <span className={styles.textHolyc}>HolyC</span> vault, and burns supply whenever a route is actually profitable.
          </p>
          <p>Some days it fires a few times, some days not at all – that’s normal.</p>
        </>
      ),
    },
  ]

  const handleOpenDivineGuide = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('open-divine-manager-guide'))
    }
  }

  return (
    <div className={styles.landingPage}>
      <div className={styles.glowAccents}>
        <span className={`${styles.glowAccent} ${styles.glowPink}`} />
        <span className={`${styles.glowAccent} ${styles.glowBlue}`} />
        <span className={`${styles.glowAccent} ${styles.glowCyan}`} />
      </div>

      <div className={styles.pageShell}>
        <section className={styles.heroSection}>
          <div className={styles.heroLayout}>
            <div className={styles.heroTextColumn}>
              <h1 className={styles.heroTitle}>
                Fixed supply.
                <span className={styles.heroHighlight}>Market-driven burn.</span>
                Zero tax on HolyC.
              </h1>

              <p className={styles.heroLead}>
                Dual-token burn engine on PulseChain. HolyC stays the pump.tires main character while JIT handles burns
                behind the scenes.
              </p>

              <div className={styles.heroActions}>
                {heroLinks.map(({ href, label }) => (
                  <a key={href} href={href} className={styles.heroButton} target="_blank" rel="noopener noreferrer">
                    {label}
                  </a>
                ))}
              </div>

            </div>

            <div className={styles.heroVisual}>
              <div className={styles.flowCard}>
                <div className={styles.flowGrid}>
                  <div className={`${styles.flowBlock} ${styles.flowHolyc}`}>
                    <div className={styles.flowTokenHeader}>
                      <div className={styles.flowTokenBadge}>
                        <img src={HolyCLogo} alt="HolyC" className={styles.flowBlockIcon} />
                      </div>
                      <div className={styles.flowTokenMeta}>
                        <p className={styles.flowTokenTicker}>HolyC token</p>
                        <h3 className={styles.flowTokenTitle}>Pump.tires original</h3>
                      </div>
                    </div>
                    <p className={styles.flowDescription}>
                      The foundational, tax-free asset with a fixed supply. As a holder of the fixed-supply HolyC token, you
                      benefit passively from the entire ecosystem without ever needing to interact with it directly.
                    </p>
                    <div className={styles.flowFooter}>
                      <span className={styles.flowChip}>Hold / Trade</span>
                    </div>
                  </div>

                  <div className={`${styles.flowBlock} ${styles.flowBridge}`}>
                    <div className={styles.flowBridgeHeader}>
                      <p>HolyC ↔ JIT</p>
                      <h3>Divine Compiler</h3>
                    </div>
                    <p className={`${styles.flowDescription} ${styles.flowBridgeDescription}`}>
                      A smart contract where HolyC is locked to mint JIT and JIT is burned to restore HolyC. It enforces a fixed
                      1:1 conversion with a 4% burn, creating a hard anchor outside the market. That ratio stays the same no
                      matter what the pools do, so price gaps (and arbs) naturally appear.
                    </p>
                    <div className={styles.flowBridgeFooter}>
                      <span>HolyC</span>
                      <div className={styles.flowDoubleArrow} aria-hidden="true" />
                      <span>JIT</span>
                    </div>
                  </div>

                  <div className={`${styles.flowBlock} ${styles.flowJit}`}>
                    <div className={styles.flowTokenHeader}>
                      <div className={styles.flowTokenBadge}>
                        <img src={JITLogo} alt="JIT" className={styles.flowBlockIcon} />
                      </div>
                      <div className={styles.flowTokenMeta}>
                        <p className={styles.flowTokenTicker}>JIT token</p>
                        <h3 className={styles.flowTokenTitle}>Utility wrapper</h3>
                      </div>
                    </div>
                    <p className={styles.flowDescription}>
                      Backed by locked HolyC. Trades in its own JIT/WPLS pool with a 2% transfer burn, so its price can drift
                      away from HolyC until arbs close the gap.
                    </p>
                    <div className={styles.flowFooter}>
                      <span className={styles.flowChip}>Utility / Bots</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className={styles.howSection}>
          <div className={styles.howHeader}>
            <h2>How TempleOS Works</h2>
            <p>
              Two tokens, two markets, one compiler. HolyC and JIT each have their own PulseX pool; when those prices drift
              away from the Compiler rate, the market gets paid to burn the supply for you.
            </p>
          </div>

          <div className={styles.howGrid}>
            {howCards.map(({ id, title, summary, body, cardClass }) => {
              const isOpen = !!openHowCards[id]
              const bodyId = `how-card-${id}`
              return (
                <div className={`${styles.howCard} ${cardClass} ${isOpen ? styles.howCardOpen : ''}`} key={id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className={styles.howToggle}
                    onClick={() => toggleHowCard(id)}
                    onKeyDown={(event) => handleHowKeyDown(event, id)}
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                  >
                    <div className={styles.howToggleHeader}>
                      <h3>{title}</h3>
                      <span className={styles.howCardArrow} aria-hidden="true" />
                    </div>
                    <div className={styles.howSummary}>{summary}</div>
                  </div>
                  <div
                    id={bodyId}
                    className={styles.howBody}
                    style={{ maxHeight: isOpen ? `${getHowBodyHeight(id)}px` : 0 }}
                    aria-hidden={!isOpen}
                  >
                    <div
                      className={styles.howBodyInner}
                      ref={(el) => {
                        howBodyRefs.current[id] = el
                      }}
                    >
                      {body}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className={`${styles.divineActivitySection} ${styles.bottomSection}`}>
          <div className={styles.divineLayout}>
            <aside className={styles.divineSideColumn}>
              <div className={`${styles.sideCard} ${styles.divineSummaryCard}`}>
                <h3 className={styles.sideSectionTitle}>Divine Manager, summarized</h3>
                <p className={styles.sideSectionDescription}>
                  The off-chain Arb Guardian watches HolyC/JIT markets and only wakes the Divine Manager when a route is
                  safely profitable. Each execute turns price gaps into HolyC burns and vault growth – the feed is its
                  mission log.
                </p>
                <button
                  type="button"
                  className={styles.divineSummaryButton}
                  onClick={handleOpenDivineGuide}
                >
                  Open Divine Manager guide
                </button>
              </div>

              <div className={styles.sideCard}>
                <h3 className={styles.sideSectionTitle}>Token stats</h3>
                <p className={styles.sideSectionDescription}>
                  Supply-side HolyC + JIT metrics with quick, plain-English notes.
                </p>
                <ul className={styles.tokenStatsList}>
                  {keyTokenStats.map((stat) => {
                    const isOpen = openStatId === stat.id

                    let valueClass = ''
                    if (stat.accent === 'holyc') valueClass = styles.tokenStatValueHolyc
                    else if (stat.accent === 'jit') valueClass = styles.tokenStatValueJit
                    else if (stat.accent === 'locked') valueClass = styles.tokenStatValueLocked
                    else if (stat.accent === 'lp') valueClass = styles.tokenStatValueLp
                    else if (stat.accent === 'burned') valueClass = styles.tokenStatValueBurned

                    let icon
                    if (stat.accent === 'holyc') {
                      icon = <img src={HolyCLogo} alt="HolyC" className={styles.tokenStatIcon} />
                    } else if (stat.accent === 'jit') {
                      icon = <img src={JITLogo} alt="JIT" className={styles.tokenStatIcon} />
                    } else if (stat.accent === 'lp') {
                      icon = <img src={PulseXLogo} alt="PulseX" className={styles.tokenStatIcon} />
                    } else if (stat.accent === 'locked') {
                      icon = (
                        <div className={styles.tokenStatEmoji} aria-hidden="true">
                          🔒
                        </div>
                      )
                    } else {
                      icon = (
                        <div className={styles.tokenStatEmoji} aria-hidden="true">
                          🔥
                        </div>
                      )
                    }

                    return (
                      <li key={stat.id} className={styles.tokenStatRow}>
                        <button
                          type="button"
                          className={styles.tokenStatHeader}
                          onClick={() => handleToggleStat(stat.id)}
                        >
                          <div className={styles.tokenStatMain}>
                            <div className={styles.tokenStatLabelGroup}>
                              {icon}
                              <span className={styles.tokenStatLabel}>{stat.label}</span>
                            </div>
                            <span className={`${styles.tokenStatValue} ${valueClass}`}>{stat.value}</span>
                          </div>
                          <span
                            className={`${styles.tokenStatToggle} ${
                              isOpen ? styles.tokenStatToggleOpen : ''
                            }`}
                          >
                            ▾
                          </span>
                        </button>
                        <div
                          className={`${styles.tokenStatBody} ${
                            isOpen ? styles.tokenStatBodyOpen : ''
                          }`}
                        >
                          <p className={styles.tokenStatBodyText}>{stat.description}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </aside>
            <div className={styles.divineFeedColumn}>
              <DivineManagerActivity
                executions={divineExecutions}
                isLoading={isDivineLoading}
                error={divineError}
                lastUpdated={divineLastUpdated}
                onRefresh={refreshDivine}
                tokenPrices={tokenPrices}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default LandingPage
