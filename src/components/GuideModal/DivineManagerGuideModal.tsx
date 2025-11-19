import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Rocket, Sparkles, Activity, Search, Bot, Zap, ShieldCheck, Flame, Target } from 'lucide-react'
import styles from './GuideModal.module.css'

export interface DivineManagerGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <div className={styles.section}>
    <h4 className={styles.sectionTitle}>
      {icon}
      <span>{title}</span>
    </h4>
    <div className={styles.sectionContent}>{children}</div>
  </div>
)

export const DivineManagerGuideModal: React.FC<DivineManagerGuideModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>
            <Rocket className={styles.headerIcon} /> Divine Manager Mission Log
          </h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close guide">
            <X size={24} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.intro}>
            <h3 className={styles.introTitle}>Divine Manager: automated arb for HolyC</h3>
            <p className={styles.introText}>
              When I shipped the Divine Compiler, the idea was simple: use a second token (
              <strong className={styles.tooltipAmber}>JIT</strong>) to make a non-burning{' '}
              <strong className={styles.tooltipIndigo}>HolyC</strong> coin actually deflationary. The trade-off? Someone
              still had to run the loop manually — watch the pools, calculate the spread, compile / restore, then click
              through the trades.
            </p>
            <p className={styles.introText}>
              The Divine Manager is the “I’ll do it for you” layer on top of that design. It watches HolyC ↔ JIT ↔
              Compiler flows, waits for clean price gaps, and only steps in when every fee, burn, and gas check is
              cleared.
            </p>
            <p className={styles.introText}>
              When it fires, it runs the entire cycle on-chain: captures the spread, converts owed fees into extra{' '}
              <strong className={styles.tooltipIndigo}>HolyC</strong>, sends the burn, and stacks profit as protocol
              treasury. You don’t need to touch <strong className={styles.tooltipAmber}>JIT</strong>, the Compiler, or
              the routes — you simply hold or trade HolyC like a normal 0% tax coin while the engine quietly harvests
              the depeg.
            </p>
          </div>

          <Section title="1. What the Divine Manager actually does" icon={<Sparkles size={20} />}>
            <p>
              The Divine Manager is a smart contract that lives on top of the HolyC ↔ JIT ↔ Compiler triangle and turns
              volatility into protocol-owned value. When the route is safe, it:
            </p>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <span>
                  Turns <span className={styles.tooltipIndigo}>HolyC</span> ↔ <span className={styles.tooltipAmber}>JIT</span>{' '}
                  ↔ <span className={styles.tooltipGreen}>PLS</span> price gaps into profit.
                </span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <span>Pays every owed compile / restore / transfer fee in HolyC at the end of the loop.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <span>Burns that HolyC and sends the remainder to the protocol vault.</span>
              </div>
            </div>
            <p>
              It doesn’t hold funds in advance, it doesn’t need a manual confirmation, and it doesn’t change HolyC’s 0%
              tax. It simply monetizes the volatility that already exists between:
            </p>
            <ul>
              <li>HolyC / WPLS</li>
              <li>JIT / WPLS</li>
              <li>HolyC / JIT</li>
              <li>The fixed Divine Compiler rate</li>
            </ul>
          </Section>

          <Section title="2. Why there is an opportunity at all" icon={<Activity size={20} />}>
            <p>
              The system is built around two different “views” of price: the market price inside PulseX pools and the
              compiler price that stays fixed at 1:1 (minus 4% compile / 4% restore) no matter what. Because{' '}
              <strong className={styles.tooltipAmber}>JIT</strong> burns 2% on every transfer and each token has its own
              WPLS pool, the two drift apart while the Compiler stubbornly sits in the middle. That gap is where the{' '}
              <span className={styles.tooltipGreen}>profit</span> and <span className={styles.tooltipRed}>burns</span>{' '}
              come from.
            </p>
            <p>
              Originally, you could do it manually: buy the cheap pool, use the Compiler to bypass AMM pricing, then sell
              into the rich pool and pocket the difference. It works — but it’s work. Timing, gas, slippage, fees…it was
              easy to mess up.
            </p>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <span>Buy the discounted side in the pools.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <span>Compile / restore at the fixed rate to flip the discount.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <span>Sell back into the richer pool and hope gas + slippage didn’t erase the spread.</span>
              </div>
            </div>
            <p>The Divine Manager turns that “manual depeg harvest” into a background process.</p>
          </Section>

          <Section title="3. Arb Guardian – the off-chain brain" icon={<Search size={20} />}>
            <p>
              The Arb Guardian is an off-chain bot. It never holds funds and never touches the vault. Its entire job is
              to call the Divine Manager with a route when it is clearly profitable after every safety check.
            </p>
            <p>It continuously simulates routes across:</p>
            <ul>
              <li>HolyC / WPLS</li>
              <li>JIT / WPLS</li>
              <li>HolyC / JIT</li>
              <li>The Divine Compiler (compile + restore)</li>
            </ul>
            <p>For each candidate loop it includes:</p>
            <ul>
              <li>4% compile + 4% restore</li>
              <li>Every 2% JIT transfer burn in the route</li>
              <li>Slippage and gas using live reserves</li>
            </ul>
            <p>
              If net HolyC + net JIT is still positive after all that, the Guardian greenlights the transaction and
              calls the Divine Manager.
            </p>
            <div className={styles.insightBox}>
              <Bot size={16} />
              <span>
                Scan cadence: roughly hourly (configurable). Execution cadence: event-driven — some hours fire multiple
                missions, some hours stay quiet and that’s normal.
              </span>
            </div>
          </Section>

          <Section title="4. How the Divine Manager executes a loop" icon={<Zap size={20} />}>
            <p>Once the Arb Guardian passes a route, the Divine Manager takes over on-chain.</p>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <span>
                  Runs the multi-leg swap fee-exempt: buy the cheap pool, bridge via HolyC ↔ JIT or the Compiler, then
                  sell into the richer pool.
                </span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <span>Keeps track of every owed fee internally instead of burning mid-route.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <span>
                  Restores the owed JIT into HolyC, sends that HolyC to the burn, and ships the remaining HolyC profit to
                  the vault.
                </span>
              </div>
            </div>
            <div className={styles.tokenGrid}>
              <div className={`${styles.tokenCard} ${styles.holycCard}`}>
                <h5 className={styles.tokenTitle}>Circulating HolyC</h5>
                <p className={styles.tokenDesc}>Burned directly plus indirectly locked through compiler backing.</p>
                <div className={styles.tokenStat}>
                  <span>Result</span>
                  <strong>- supply</strong>
                </div>
                <div className={styles.tokenStat}>
                  <span>Why</span>
                  <strong>Burn + trapped backing</strong>
                </div>
              </div>
              <div className={`${styles.tokenCard} ${styles.jitCard}`}>
                <h5 className={styles.tokenTitle}>Protocol vault</h5>
                <p className={styles.tokenDesc}>Keeps the HolyC profit as protocol-owned collateral.</p>
                <div className={styles.tokenStat}>
                  <span>Result</span>
                  <strong>+ HolyC</strong>
                </div>
                <div className={styles.tokenStat}>
                  <span>Usage</span>
                  <strong>Treasury growth</strong>
                </div>
              </div>
            </div>
            <p>
              You can verify every step through the live “Divine Manager Executes” feed — each mission is transparent and
              on-chain.
            </p>
          </Section>

          <Section title="5. Why MEV and copycats can’t simply steal it" icon={<ShieldCheck size={20} />}>
            <p>MEV bots see the same transaction, but they don’t get the same economics.</p>
            <ul>
              <li>
                <strong>Fee exemption:</strong> The Divine Manager is whitelisted and runs fee-exempt. Copycats pay JIT
                tax and slippage in real time.
              </li>
              <li>
                <strong>Pre-sized routes:</strong> The Arb Guardian already simulates the exact size that fits available
                liquidity + gas.
              </li>
              <li>
                <strong>Internal fee accounting:</strong> The protocol restores JIT into HolyC and burns after the loop;
                copy bots bleed value mid-route as each transfer taxes them.
              </li>
            </ul>
            <p>They can mimic the calldata, but they can’t copy the math edge.</p>
          </Section>

          <Section title="6. When burns happen and what gets burned" icon={<Flame size={20} />}>
            <p>Burns only happen after profit is locked in.</p>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <span>The arb loop completes and the vault profit is secured.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <span>The Manager tallies everything that should have burned (compile + restore + JIT transfer fees).</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <span>The corresponding JIT is restored back into extra HolyC.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>4</div>
                <span>
                  That HolyC is sent in a single shot to <span className={styles.tooltipRed}>0x000...0369</span>.
                </span>
              </div>
            </div>
            <div className={styles.insightBox}>
              <Flame size={16} />
              <span>
                HolyC supply drops directly through burns and indirectly through JIT burns that trap HolyC in the
                Compiler forever.
              </span>
            </div>
          </Section>

          <Section title="7. Current mode & what you do as a holder" icon={<Target size={20} />}>
            <p>
              Mode: accumulate + burn. Each profitable arb burns part of the haul in HolyC and stacks the rest inside a
              HolyC vault controlled by the protocol.
            </p>
            <p>Design goals (not promises):</p>
            <ul>
              <li>Use vault HolyC in the future for holder rewards, LP incentives, or ecosystem utilities.</li>
              <li>Keep every burn and payout transparent through the execute feed.</li>
              <li>Grow protocol-owned HolyC as permanent backing for HolyC liquidity.</li>
            </ul>
            <p>As a HolyC holder your role is simple:</p>
            <ul>
              <li>HolyC stays 0% tax.</li>
              <li>You never have to touch JIT, the Compiler, or the Manager.</li>
              <li>You just hold or trade HolyC while the system turns volatility into a lighter float and a deeper vault.</li>
            </ul>
            <p className={styles.finalThought}>
              <strong>Hold HolyC. Let the Manager do the work.</strong>
            </p>
          </Section>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DivineManagerGuideModal
