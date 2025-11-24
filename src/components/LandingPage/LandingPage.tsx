import styles from './LandingPage.module.css'
import { DivineManagerActivity } from './DivineManagerActivity'
import { ArrowRight, Flame, BookOpen, Bot } from 'lucide-react'
import { usePoolData } from '../UniswapPools/hooks/usePoolData'
import { useDivineManagerActivity } from '@/hooks/useDivineManagerActivity'
import StatsDashboard from '../StatsDashboard/StatsDashboard'
import HolyCLogo from '../../assets/TokenLogos/HolyC.png'
import JITLogo from '../../assets/TokenLogos/JIT.png'
import PulseXLogo from '../../assets/TokenLogos/PulseX.png'

export function LandingPage() {
  const { tokenPrices } = usePoolData()
  const {
    executions: divineExecutions,
    isLoading: isDivineLoading,
    isLoadingMore: isDivineLoadingMore,
    hasMore: hasMoreDivine,
    error: divineError,
    lastUpdated: divineLastUpdated,
    refresh: refreshDivine,
    loadMore: loadMoreDivine,
  } = useDivineManagerActivity()

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


  const handleOpenDivineGuide = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('open-divine-manager-guide'))
    }
  }

  const handleOpenTokenomicsGuide = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('open-tokenomics-guide'))
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
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>2 Tokens, 1 Supply</h2>
                  <p className={styles.cardDescription}>
                    Holding HolyC gives you passive exposure to the whole engine. You never need to touch JIT to benefit.
                  </p>
                  <button
                    onClick={handleOpenTokenomicsGuide}
                    className={styles.tokenomicsButton}
                  >
                    <BookOpen size={16} />
                    <span>Tokenomics</span>
                  </button>
                </div>
                
                <div className={styles.flowGrid}>
                  <div className={`${styles.flowBlock} ${styles.flowHolyc}`}>
                    <div className={styles.flowTokenHeader}>
                      <img src={HolyCLogo} alt="HolyC" className={styles.flowBlockIcon} />
                      <div className={styles.flowTokenMeta}>
                        <h3 className={styles.flowTokenTitle}>The Asset</h3>
                        <p className={styles.flowTokenTicker}>Fixed Supply. 0% Tax.</p>
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.flowBlock} ${styles.flowBridge}`}>
                    <div className={styles.flowBridgeHeader}>
                      <div className={styles.anchorVisual}>
                         {/* Connection beams - visual only - extended width */}
                        <div className={`${styles.connectorLine} ${styles.connectorLeft}`} />
                        <div className={`${styles.connectorLine} ${styles.connectorRight}`} />

                        <svg viewBox="0 0 200 200" className={styles.mergeSvg} preserveAspectRatio="xMidYMid meet">
                          <defs>
                            {/* HolyC Blue Gradient - Matches App Theme */}
                            <radialGradient id="fluidBlue" cx="30%" cy="30%" r="70%">
                              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.6" />
                              <stop offset="100%" stopColor="#1e40af" stopOpacity="0.2" />
                            </radialGradient>

                            {/* JIT Orange Gradient - Matches App Theme */}
                            <radialGradient id="fluidOrange" cx="70%" cy="70%" r="70%">
                              <stop offset="0%" stopColor="#fb923c" stopOpacity="0.9" />
                              <stop offset="50%" stopColor="#f97316" stopOpacity="0.6" />
                              <stop offset="100%" stopColor="#c2410c" stopOpacity="0.2" />
                            </radialGradient>

                            <filter id="fluidGlow" x="-50%" y="-50%" width="200%" height="200%">
                              <feGaussianBlur stdDeviation="12" result="coloredBlur" />
                              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
                              <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
                            </filter>
                          </defs>
                          
                          <g filter="url(#fluidGlow)">
                             {/* HolyC Fluid (Blue) - Morphing Blob */}
                             <path className={styles.fluidShape} fill="url(#fluidBlue)">
                               <animate
                                 attributeName="d"
                                 dur="8s"
                                 repeatCount="indefinite"
                                 values="
                                   M100,100 m-50,-40 c30,-20 70,-20 100,0 c20,20 20,60 0,80 c-30,20 -70,20 -100,0 c-20,-20 -20,-60 0,-80;
                                   M100,100 m-40,-50 c40,-10 80,10 90,40 c10,30 -10,70 -40,80 c-40,10 -80,-10 -90,-40 c-10,-30 10,-70 40,-80;
                                   M100,100 m-60,-30 c20,-30 80,-10 100,20 c20,30 0,80 -40,90 c-30,10 -90,-10 -100,-40 c-10,-30 10,-80 40,-70;
                                   M100,100 m-50,-40 c30,-20 70,-20 100,0 c20,20 20,60 0,80 c-30,20 -70,20 -100,0 c-20,-20 -20,-60 0,-80
                                 "
                               />
                             </path>
 
                             {/* JIT Fluid (Orange) - Morphing Blob, swirling opposite */}
                             <path className={styles.fluidShape} fill="url(#fluidOrange)" style={{ mixBlendMode: 'screen' }}>
                               <animate
                                 attributeName="d"
                                 dur="9s"
                                 repeatCount="indefinite"
                                 values="
                                   M100,100 m50,40 c-30,20 -70,20 -100,0 c-20,-20 -20,-60 0,-80 c30,-20 70,-20 100,0 c20,20 20,60 0,80;
                                   M100,100 m60,30 c-20,30 -80,10 -100,-20 c-20,-30 0,-80 40,-90 c30,-10 90,10 100,40 c10,30 -10,80 -40,70;
                                   M100,100 m40,50 c-40,10 -80,-10 -90,-40 c-10,-30 10,-70 40,-80 c40,-10 80,10 90,40 c10,30 -10,70 -40,80;
                                   M100,100 m50,40 c-30,20 -70,20 -100,0 c-20,-20 -20,-60 0,-80 c30,-20 70,-20 100,0 c20,20 20,60 0,80
                                 "
                               />
                             </path>
                          </g>
                        </svg>
                      </div>
                      <div className={styles.flowTokenMeta}>
                        <h3 className={styles.flowTokenTitle}>The Anchor</h3>
                        <p className={styles.flowTokenTicker}>Enforces the bridge that creates profit.</p>
                      </div>
                    </div>
                  </div>

                  <div className={`${styles.flowBlock} ${styles.flowJit}`}>
                    <div className={styles.flowTokenHeader}>
                      <img src={JITLogo} alt="JIT" className={styles.flowBlockIcon} />
                      <div className={styles.flowTokenMeta}>
                        <h3 className={styles.flowTokenTitle}>The Engine</h3>
                        <p className={styles.flowTokenTicker}>2% Burn. High Friction.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.howSection}>
          <div className={styles.managerCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>The Divine Manager</h2>
              <p className={styles.cardDescription}>
                As a HolyC holder, your job is easy: just buy, sell, or hold. The system turns volatility into a lighter float and a deeper vault.
              </p>
              <button
                type="button"
                className={styles.divineGuideButton}
                onClick={handleOpenDivineGuide}
              >
                <Bot size={16} />
                <span>Divine Manager</span>
              </button>
            </div>

            <div className={styles.automationSteps}>
              {/* Step 1: The Gap (SVG Split + Central PulseX) */}
              <div className={styles.automationStep}>
                <div className={styles.gapVisualSvg}>
                  <svg viewBox="0 0 160 180" className={styles.gapSvg} preserveAspectRatio="xMidYMid meet">
                    {/* PulseX Branding (Larger: 48px, Centered Vertically at y=90) */}
                    {/* y = 90 - 24 = 66 */}
                    <foreignObject x="5" y="66" width="48" height="48">
                       <img src={PulseXLogo} alt="PulseX" className={styles.svgPulseX} />
                    </foreignObject>

                    {/* Top Branch (HolyC - Blue) - Starts FROM PulseX Center/Right */}
                    {/* Start x ~ 5+48=53. Let's say 52 for overlap. */}
                    <path d="M52,90 C82,90 82,40 110,40" fill="none" stroke="url(#gradHolyC)" strokeWidth="2" />
                    
                    {/* Bottom Branch (JIT - Red) - Starts FROM PulseX Center/Right */}
                    <path d="M52,90 C82,90 82,140 110,140" fill="none" stroke="url(#gradJIT)" strokeWidth="2" />

                    {/* Gradients */}
                    <defs>
                      <linearGradient id="gradHolyC" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#a5b4fc" />
                      </linearGradient>
                      <linearGradient id="gradJIT" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#fb7185" />
                      </linearGradient>
                    </defs>

                    {/* Token Logos (Larger: 48px, Centered at Tips) */}
                    {/* HolyC at y=40 -> y = 40-24=16 */}
                    <foreignObject x="110" y="16" width="48" height="48">
                      <img src={HolyCLogo} alt="HolyC" className={styles.svgLogo} />
                    </foreignObject>
                    
                    {/* JIT at y=140 -> y = 140-24=116 */}
                    <foreignObject x="110" y="116" width="48" height="48">
                      <img src={JITLogo} alt="JIT" className={styles.svgLogo} />
                    </foreignObject>
                  </svg>
                </div>
                <p className={styles.stepDesc}>Prices depeg.</p>
              </div>
              
              <div className={styles.stepConnector}>
                <ArrowRight className={styles.connectorIcon} />
              </div>

              {/* Step 2: The Capture (Radar/Scanner) */}
              <div className={styles.automationStep}>
                <div className={styles.captureVisualAbstract}>
                  <div className={styles.scannerRadar}>
                    <div className={styles.scannerSweep} />
                    <div className={styles.scannerTarget} />
                  </div>
                </div>
                <p className={styles.stepDesc}>Manager executes the loop.</p>
              </div>

              <div className={styles.stepConnector}>
                <ArrowRight className={styles.connectorIcon} />
              </div>

              {/* Step 3: The Result (Static: +Tokens & Burn) */}
              <div className={styles.automationStep}>
                <div className={styles.resultVisualStatic}>
                  <div className={styles.resultLeft}>
                    <div className={styles.resultPlus}>+</div>
                    <div className={styles.resultLogos}>
                      <img src={HolyCLogo} alt="HolyC" className={styles.resultLogoLeft} />
                      <img src={JITLogo} alt="JIT" className={styles.resultLogoRight} />
                    </div>
                  </div>
                  <div className={styles.resultDivider} />
                  <div className={styles.resultRight}>
                    <Flame className={styles.resultBurnStatic} />
                  </div>
                </div>
                <p className={styles.stepDesc}>Supply Burned + Vault Filled.</p>
              </div>
            </div>
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
              </div>

              <div className={styles.tokenStatsWrapper}>
                <StatsDashboard showHeader={false} />
              </div>
            </aside>
            <div className={styles.divineFeedColumn}>
              <DivineManagerActivity
                executions={divineExecutions}
                isLoading={isDivineLoading}
                isLoadingMore={isDivineLoadingMore}
                error={divineError}
                lastUpdated={divineLastUpdated}
                onRefresh={refreshDivine}
                onLoadMore={loadMoreDivine}
                hasMore={hasMoreDivine}
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
