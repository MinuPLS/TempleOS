import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Anchor,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Coins,
  Droplets,
  ShieldCheck,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import HolyCLogo from '../../assets/TokenLogos/HolyC.png'
import JITLogo from '../../assets/TokenLogos/JIT.png'
import styles from './GuideModal.module.css'

export interface GuideModalProps {
  isOpen: boolean
  onClose: () => void
}

const Section: React.FC<{
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}> = ({ title, icon, children, className }) => (
  <section className={`${styles.section} ${className || ''}`}>
    <h3 className={styles.sectionTitle}>
      {icon}
      <span>{title}</span>
    </h3>
    <div className={styles.sectionContent}>{children}</div>
  </section>
)

const getFocusableElements = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('hidden'))

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = getFocusableElements(dialogRef.current)
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && (activeElement === first || !dialogRef.current.contains(activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const openDivineManagerGuide = () => {
    onClose()
    window.requestAnimationFrame(() => window.dispatchEvent(new Event('open-divine-manager-guide')))
  }

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 id={titleId}>
            <BookOpen className={styles.headerIcon} /> Tokenomics
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close Tokenomics guide"
          >
            <X size={24} />
          </button>
        </div>

        <div className={styles.modalBody} tabIndex={0} aria-label="Tokenomics guide content">
          <div className={styles.intro}>
            <div className={styles.introLogos}>
              <img src={HolyCLogo} alt="HolyC logo" className={styles.introLogo} />
              <ArrowLeftRight size={18} className={styles.introArrow} />
              <img src={JITLogo} alt="JIT logo" className={styles.introLogo} />
            </div>
            <h3 className={styles.introTitle}>TempleOS: HolyC &amp; JIT</h3>
            <p className={styles.introText}>
              <strong className={styles.tooltipIndigo}>HolyC</strong> is the first deflationary Pump.Tires
              token, powered by a pioneering tokenomic design from{' '}
              <strong className={styles.tooltipPurple}>@MinuPLS</strong>.
            </p>
            <p className={`${styles.introText} ${styles.introQuestion}`}>
              <span className={styles.keyword}>The puzzle:</span>{' '}
              <em>How do you shrink the available supply of a fixed-supply, zero-tax token?</em>
            </p>
            <p className={styles.introText}>
              The answer is the <span className={styles.glowText}>Divine Compiler</span>. Inspired by Terry
              Davis&apos;s Just-In-Time Compiler for TempleOS, it creates a HolyC-backed wrapper called{' '}
              <strong className={styles.tooltipAmber}>JIT</strong>. HolyC stays simple to hold and trade while
              JIT carries the burn mechanics behind the scenes.
            </p>
          </div>

          <Section title="2 Tokens, 1 Supply" icon={<Coins size={20} />}>
            <p>
              The ecosystem pairs a simple reserve asset with a high-friction utility wrapper. They are linked
              inside the Compiler, but their market prices can move independently.
            </p>
            <div className={styles.tokenGrid}>
              <div className={`${styles.tokenCard} ${styles.holycCard}`}>
                <div className={styles.tokenCardHeader}>
                  <img src={HolyCLogo} alt="HolyC logo" className={styles.tokenLogo} />
                  <div>
                    <h4 className={styles.tokenTitle}>HolyC</h4>
                    <span className={styles.tokenSubtitle}>The reserve asset</span>
                  </div>
                </div>
                <div className={styles.tokenBadges}>
                  <span className={`${styles.tokenBadge} ${styles.reserveBadge}`}>Reserve</span>
                  <span className={styles.tokenBadge}>Fixed supply</span>
                </div>
                <p className={styles.tokenDesc}>
                  <span className={styles.keyword}>Role:</span> The main asset people can buy, sell, or hold
                  without a transfer tax.
                </p>
                <div className={styles.tokenStat}>
                  <span>Initial supply</span>
                  <strong>1 billion</strong>
                </div>
                <div className={styles.tokenStat}>
                  <span>Transfer tax</span>
                  <strong>0%</strong>
                </div>
                <div className={styles.tokenStat}>
                  <span>User action</span>
                  <strong>Buy · Sell · Hold</strong>
                </div>
              </div>

              <div className={`${styles.tokenCard} ${styles.jitCard}`}>
                <div className={styles.tokenCardHeader}>
                  <img src={JITLogo} alt="JIT logo" className={styles.tokenLogo} />
                  <div>
                    <h4 className={styles.tokenTitle}>JIT</h4>
                    <span className={styles.tokenSubtitle}>The burn wrapper</span>
                  </div>
                </div>
                <div className={styles.tokenBadges}>
                  <span className={`${styles.tokenBadge} ${styles.wrapperBadge}`}>HolyC-backed</span>
                  <span className={styles.tokenBadge}>Deflationary</span>
                </div>
                <p className={styles.tokenDesc}>
                  <span className={styles.keyword}>Role:</span> The wrapper used by the Compiler, liquidity
                  pools, arbitrage routes, and automated burns.
                </p>
                <div className={styles.tokenStat}>
                  <span>Backing</span>
                  <strong>HolyC in Compiler</strong>
                </div>
                <div className={styles.tokenStat}>
                  <span>Standard transfer</span>
                  <strong>2% burn*</strong>
                </div>
                <div className={styles.tokenStat}>
                  <span>User action</span>
                  <strong>Optional</strong>
                </div>
              </div>
            </div>
          </Section>

          <Section title="The Divine Compiler: the internal anchor" icon={<Anchor size={20} />}>
            <p>
              The Compiler lets anyone turn HolyC into JIT (<span className={styles.keyword}>Compile</span>) or
              turn JIT back into HolyC (<span className={styles.keyword}>Restore</span>). Its internal accounting
              starts at exactly 1:1 before fees.
            </p>
            <div className={styles.parityFlow}>
              <div className={styles.parityRow}>
                <div className={styles.flowBlock}>
                  <img src={HolyCLogo} alt="" className={styles.flowTokenLogo} />
                  <div>
                    <strong>Compile</strong>
                    <span>Deposit 1 HolyC</span>
                  </div>
                </div>
                <ArrowRight size={18} aria-hidden="true" />
                <div className={styles.flowBlock}>
                  <img src={JITLogo} alt="" className={styles.flowTokenLogo} />
                  <div>
                    <strong>Receive 0.96 JIT</strong>
                    <small>0.04 HolyC goes to burn</small>
                  </div>
                </div>
              </div>
              <div className={styles.parityRow}>
                <div className={styles.flowBlock}>
                  <img src={JITLogo} alt="" className={styles.flowTokenLogo} />
                  <div>
                    <strong>Restore</strong>
                    <span>Burn 1 JIT</span>
                  </div>
                </div>
                <ArrowRight size={18} aria-hidden="true" />
                <div className={styles.flowBlock}>
                  <img src={HolyCLogo} alt="" className={styles.flowTokenLogo} />
                  <div>
                    <strong>Receive 0.96 HolyC</strong>
                    <small>0.04 HolyC goes to burn</small>
                  </div>
                </div>
              </div>
            </div>
            <p className={styles.caption}>
              Example shown at the documented 4% Compiler fee. The 4% Compiler fee and 2% standard JIT
              transfer burn are configurable; check the dApp for the live values before transacting. Approved
              addresses can also be exempt from JIT transfer fees.
            </p>
          </Section>

          <Section title="What actually becomes scarce" icon={<Zap size={20} />}>
            <p>TempleOS removes HolyC from practical circulation in more than one way:</p>
            <ul className={styles.calloutList}>
              <li>
                <span className={styles.tooltipRed}>Direct burn:</span> HolyC is sent to the permanent burn
                address.
              </li>
              <li>
                <span className={styles.tooltipAmber}>Locked backing:</span> HolyC sits inside the Compiler while
                matching JIT remains redeemable.
              </li>
              <li>
                <span className={styles.tooltipGreen}>Permanently trapped backing:</span> JIT&apos;s compile,
                restore, and transfer-burn mechanics mean that less JIT can ultimately be restored into HolyC
                over time. The resulting “excess” HolyC remains permanently locked inside the Compiler.
              </li>
              <li>
                <span className={styles.tooltipPurple}>Locked liquidity:</span> HolyC inside liquidity whose LP
                ownership was burned is tracked separately.
              </li>
            </ul>
            <div className={styles.insightBox}>
              <CheckCircle2 size={16} />
              <span>
                A direct HolyC burn and HolyC trapped through a JIT burn are different events, but both can
                reduce the amount of HolyC effectively available to the market.
              </span>
            </div>
          </Section>

          <Section title="How market gaps create opportunity" icon={<ArrowLeftRight size={20} />}>
            <p>
              The three original markets—HolyC/WPLS, JIT/WPLS, and HolyC/JIT—set their own prices on PulseX.
              They do not have to match the Compiler&apos;s internal 1:1 accounting.
            </p>
            <div className={styles.dualStatGrid}>
              <div className={styles.dualStat}>
                <h4>Market price</h4>
                <p>Moves with trading, liquidity, and pool depth.</p>
              </div>
              <div className={styles.dualStat}>
                <h4>Compiler anchor</h4>
                <p>Starts at 1 HolyC ↔ 1 JIT internally, before fees.</p>
              </div>
            </div>
            <p>
              When a market gap is wider than every fee, burn, gas cost, and price impact, a profitable route
              may exist. The current system can also use a wider set of approved pools, but these three remain
              the easiest way to understand the engine.
            </p>
          </Section>

          <Section title="The Divine Manager automates the hard part" icon={<Bot size={20} />}>
            <p>
              The Divine Manager is the project&apos;s guarded automation layer. An off-chain scanner watches
              the approved markets, simulates possible routes, and sends a tightly bounded ticket only when the
              full route clears its safety and profitability checks.
            </p>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <span>
                  <strong className={styles.stepTitle}>Find:</strong> Detect a usable price gap across approved
                  pools and the Compiler.
                </span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <span>
                  <strong className={styles.stepTitle}>Prove:</strong> Include burns, fees, gas, slippage, and
                  the complete before-and-after inventory.
                </span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <span>
                  <strong className={styles.stepTitle}>Execute:</strong> Let the on-chain Manager validate and
                  complete the approved route atomically.
                </span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>4</div>
                <span>
                  <strong className={styles.stepTitle}>Settle:</strong> Apply configured burn effects, retain
                  protocol inventory, and send configured allocations to partner buy-and-burn systems.
                </span>
              </div>
            </div>
            <p>
              The documented V2 setup includes Briah, CoinMafia, DUMB, and FUPA partner recipients. Exact
              routes and settlement settings are live configuration, not permanent token rules.
            </p>
          </Section>

          <Section title="Open mechanics, guarded automation" icon={<ShieldCheck size={20} />}>
            <ul>
              <li>The Compiler and JIT token remain open tools.</li>
              <li>Anyone can Compile, Restore, or look for a manual arbitrage route.</li>
              <li>The Divine Manager is different: its automated execution path is permissioned, policy-bound, and guarded.</li>
              <li>Successful Manager executions are recorded on-chain, and the dashboard links them to their source transactions.</li>
            </ul>
            <button type="button" className={styles.guideLinkButton} onClick={openDivineManagerGuide}>
              Read the beginner&apos;s Divine Manager guide <ArrowRight size={16} />
            </button>
          </Section>

          <Section title="What this means for a holder" icon={<TrendingUp size={20} />}>
            <p>
              You do not need to operate JIT, search for routes, or understand every contract to hold or trade
              HolyC. The wrapper and automation are designed to move that complexity behind the scenes.
            </p>
            <div className={styles.insightBox} style={{ borderColor: 'var(--green-glow)' }}>
              <CheckCircle2 size={16} />
              <span>
                Holding HolyC gives exposure to a system designed to turn market activity into burns, locked
                backing, protocol inventory, and partner activity. It is a mechanism—not a promise of profit or
                constant execution.
              </span>
            </div>
          </Section>

          <Section title="The engine still needs fuel" icon={<Droplets size={20} />} className={styles.finalSection}>
            <p>
              The Manager acts only when a real price gap survives liquidity, fees, burns, slippage, gas, and
              every safety check. Some blocks produce opportunities; many do not. Quiet periods are normal.
            </p>
            <p className={styles.freshnessNote}>
              Guide refreshed July 2026. Core mechanics are durable; live fees, eligible routes, and settlement
              settings can change.
            </p>
          </Section>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default GuideModal
