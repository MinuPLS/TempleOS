import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  Bot,
  ChefHat,
  CheckCircle2,
  Flame,
  Radar,
  Route,
  Server,
  ShieldCheck,
  Target,
  X,
  Zap,
} from 'lucide-react'
import styles from './GuideModal.module.css'

export interface DivineManagerGuideModalProps {
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

export const DivineManagerGuideModal: React.FC<DivineManagerGuideModalProps> = ({ isOpen, onClose }) => {
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

  const openTokenomicsGuide = () => {
    onClose()
    window.requestAnimationFrame(() => window.dispatchEvent(new Event('open-tokenomics-guide')))
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
            <ChefHat className={styles.headerIcon} aria-hidden="true" /> The Divine Manager
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close Divine Manager guide"
          >
            <X size={24} />
          </button>
        </div>

        <div className={styles.modalBody} tabIndex={0} aria-label="Divine Manager guide content">
          <div className={styles.intro}>
            <h3 className={styles.introTitle}>The “I’ll Do It For You” Layer</h3>
            <p className={styles.introText}>
              The Divine Manager automates qualifying market-gap trades and settles the result on-chain. It is
              the “I&apos;ll do it for you” layer built on top of HolyC and JIT.
            </p>
            <p className={styles.introText}>
              JIT is issued against HolyC locked in the Compiler, while both tokens trade independently in the
              market. Their prices can drift away from the Compiler&apos;s internal rate. At first, people still
              had to watch those gaps and close the profitable ones by hand.
            </p>
            <p className={styles.introText}>
              That is why I built the <span className={styles.glowText}>Divine Manager</span>. It watches the
              approved markets, waits for a clean route that clears every cost and safeguard, then handles the
              cycle and settlement. Holders do not need to track routes, operate the Compiler, or touch{' '}
              <strong className={styles.tooltipAmber}>JIT</strong>. They can hold or trade{' '}
              <strong className={styles.tooltipIndigo}>HolyC</strong> like a normal 0% tax token while the
              Manager handles the complicated work in the background.
            </p>
          </div>

          <Section title="How The Divine Manager Is Set Up" icon={<Bot size={20} />}>
            <p>Three parts work together as one guarded system:</p>
            <div className={styles.managerLayerGrid}>
              <div className={styles.managerLayerCard}>
                <div className={styles.managerLayerHeader}>
                  <span className={styles.managerLayerIcon}>
                    <Server size={17} aria-hidden="true" />
                  </span>
                  <h4>Off-Chain Brain</h4>
                </div>
                <p>
                  An off-chain scanner reads each validated new block, discovers possible routes, tests
                  different sizes, and submits only a strict execution plan with limits. It never holds
                  treasury funds.
                </p>
              </div>
              <div className={styles.managerLayerCard}>
                <div className={styles.managerLayerHeader}>
                  <span className={styles.managerLayerIcon}>
                    <ShieldCheck size={17} aria-hidden="true" />
                  </span>
                  <h4>On-Chain Manager</h4>
                </div>
                <p>
                  The Manager uses protocol inventory and checks the route, reserves, deadline, minimum output,
                  and policy again before anything moves. The full transaction succeeds or reverts.
                </p>
              </div>
              <div className={styles.managerLayerCard}>
                <div className={styles.managerLayerHeader}>
                  <span className={styles.managerLayerIcon}>
                    <Zap size={17} aria-hidden="true" />
                  </span>
                  <h4>Privileged Execution &amp; Burn Settlement</h4>
                </div>
                <p>
                  The Manager runs approved routes with privileged JIT fee handling, so burns do not interrupt
                  each trade. It tracks the burn fees owed and settles that debt with the required HolyC burn
                  after the route completes.
                </p>
              </div>
            </div>
            <p className={styles.caption}>
              The off-chain brain chooses a candidate. The on-chain contracts remain the final authority.
            </p>
          </Section>

          <Section title="Where The Market Gap Comes From" icon={<Radar size={20} />}>
            <p>
              The Compiler links HolyC and JIT at a fixed 1:1 internal rate before configurable fees. PulseX
              pools use live market prices instead, so they can move away from that internal anchor.
            </p>
            <div className={styles.dualStatGrid}>
              <div className={styles.dualStat}>
                <h4>The Original Markets</h4>
                <p>HolyC/WPLS, JIT/WPLS, and HolyC/JIT move independently with trading and liquidity.</p>
              </div>
              <div className={styles.dualStat}>
                <h4>The Wider Route Set</h4>
                <p>The current system can also use additional approved pools and mixed PulseX V1/V2 routes.</p>
              </div>
            </div>
            <p>
              A difference in price is not automatically an opportunity. The gap must survive any applicable
              Compiler fees and JIT burns, plus pool fees, slippage, price impact, gas, and every configured
              safety margin.
            </p>
          </Section>

          <Section title="From Market Gap To On-Chain Execution" icon={<Route size={20} />}>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <span>
                  <strong className={styles.stepTitle}>Reads The Market:</strong> The scanner reads approved
                  pools and the Compiler from the same confirmed block.
                </span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <span>
                  <strong className={styles.stepTitle}>Proves The Route:</strong> It tests different sizes and
                  its simulation must show that the complete route clears the required profit floor after
                  fees, burns, slippage, price impact, and gas.
                </span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <span>
                  <strong className={styles.stepTitle}>Executes On-Chain:</strong> The scanner submits one
                  bounded ticket. The Manager checks it again, then the full route completes atomically or
                  reverts.
                </span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>4</div>
                <span>
                  <strong className={styles.stepTitle}>Settles The Result:</strong> The contracts apply the
                  configured burn effects, retained treasury value, and partner allocations.
                </span>
              </div>
            </div>
            <div className={styles.insightBox}>
              <Radar size={16} aria-hidden="true" />
              <span>
                The scanner follows validated new blocks, but execution is opportunity-driven. Quiet periods
                are normal because the system does not execute unless the whole route passes every check.
              </span>
            </div>
          </Section>

          <Section title="Where The Value Goes" icon={<Flame size={20} />}>
            <div className={styles.managerLayerGrid}>
              <div className={styles.managerLayerCard}>
                <div className={styles.managerLayerHeader}>
                  <span className={styles.managerLayerIcon}>
                    <Flame size={17} aria-hidden="true" />
                  </span>
                  <h4>Burn &amp; Locked Backing</h4>
                </div>
                <p>
                  Direct HolyC burns go to <span className={styles.tooltipRed}>0x000...0369</span>. JIT burns
                  can also leave excess HolyC permanently locked inside the Compiler.
                </p>
              </div>
              <div className={styles.managerLayerCard}>
                <div className={styles.managerLayerHeader}>
                  <span className={styles.managerLayerIcon}>
                    <ShieldCheck size={17} aria-hidden="true" />
                  </span>
                  <h4>Protocol Treasury</h4>
                </div>
                <p>
                  Retained profit can remain as protocol inventory in HolyC, JIT, or WPLS for future routes
                  and operations.
                </p>
              </div>
              <div className={styles.managerLayerCard}>
                <div className={styles.managerLayerHeader}>
                  <span className={styles.managerLayerIcon}>
                    <Target size={17} aria-hidden="true" />
                  </span>
                  <h4>Partner Buy-And-Burn</h4>
                </div>
                <p>
                  Configured allocations fund partner systems. The documented July 2026 setup includes Briah,
                  CoinMafia, DUMB, and FUPA.
                </p>
              </div>
            </div>
            <div className={styles.partnerSettlement}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <strong>How The Documented Split Works</strong>
                <p>
                  After burns and the protected profit-and-gas floor, the documented July 2026 configuration
                  allocates 50% of the remaining shareable profit—not 50% of gross route value—using configured
                  partner weights. A partner&apos;s actual market buy-and-burn can happen in a later transaction.
                </p>
              </div>
            </div>
          </Section>

          <Section title="How To Verify It" icon={<ShieldCheck size={20} />}>
            <p>
              The website turns Manager activity into a readable feed. It includes current V2 and legacy
              history, transaction links, leg-by-leg <span className={styles.keyword}>View Flow</span> details,
              partner burn trackers, and Manager-routed liquidity.
            </p>
            <ul>
              <li>Open an execution in the Divine Manager activity feed.</li>
              <li>Use View Flow to understand the reconstructed route and settlement.</li>
              <li>Follow the Otterscan link to inspect the source transaction on-chain.</li>
              <li>Use each partner tracker to verify its downstream buy-and-burn activity.</li>
            </ul>
            <p>
              The website is the readable explanation layer. The on-chain transaction receipt and logs remain
              the source of truth. “Feeder Bot” is a historical operational label in the activity feed, not a
              second V2 Manager.
            </p>
            <button type="button" className={styles.guideLinkButton} onClick={openTokenomicsGuide}>
              Revisit The Tokenomics Guide <ArrowRight size={16} aria-hidden="true" />
            </button>
          </Section>

          <Section title="What This Means For Holders" icon={<Target size={20} />} className={styles.finalSection}>
            <p>
              HolyC remains a 0% tax token. You do not need to use JIT, operate the Compiler, or understand
              every route to hold or trade it.
            </p>
            <p>
              The Manager is designed to turn qualifying market gaps into burn effects, retained protocol
              value, and partner activity. It is a mechanism—not a promise of profit, constant execution, or
              any particular result.
            </p>
            <p className={styles.finalThought}>
              Hold or trade HolyC. Let the Divine Manager handle the complexity.
            </p>
            <p className={styles.freshnessNote}>
              Guide refreshed July 2026. Live routes, safeguards, recipients, and settlement settings can
              change.
            </p>
          </Section>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DivineManagerGuideModal
