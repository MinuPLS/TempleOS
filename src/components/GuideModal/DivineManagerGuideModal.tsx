import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Rocket, Search, ShieldCheck, Flame, CalendarDays, Sparkles, Bot, Zap, Target } from 'lucide-react'
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
            <h3 className={styles.introTitle}>Divine Manager: HolyC’s automated burn + vault engine</h3>
            <p className={styles.introText}>
              <strong className={styles.tooltipIndigo}>HolyC</strong> is the fixed-supply main token,{' '}
              <strong className={styles.tooltipAmber}>JIT</strong> is the deflationary wrapper, and the Divine Compiler
              guarantees their 1:1 bond.
            </p>
            <p className={styles.introText}>
              The Divine Manager turns that HolyC ↔ JIT ↔ Compiler triangle into automatic burns and vault growth. The
              Arb Guardian lives off-chain, never holds funds, and only wakes the Divine Manager when math says “go.”
            </p>
          </div>

          <Section title="What the Divine Manager does" icon={<Sparkles size={20} />}>
            <p>
              The Divine Manager is the on-chain brain that makes HolyC’s dual-token design self-managing. You trade or
              hold HolyC while two invisible subsystems handle the grind.
            </p>
            <p>
              Off-chain, the Arb Guardian constantly simulates HolyC / JIT / WPLS routes. On-chain, the Divine Manager
              only runs when a fully modeled path is safely profitable. When it does, it:
            </p>
            <ul>
              <li>Runs the full arb loop fee-exempt.</li>
              <li>Keeps track of every “owed” fee internally.</li>
              <li>Restores those fees into extra HolyC instead of leaking value.</li>
              <li>Sends the HolyC straight to the burn address and the protocol vault.</li>
            </ul>
            <p>No manual button-clicking required.</p>
          </Section>

          <Section title="Mission #001 – first automated arb" icon={<Rocket size={20} />}>
            <p>🚀 First automated arb cleared on-chain. No humans had to push a button.</p>
            <p>
              Mission #001 proved the entire pipeline end-to-end: scan → call → profit → burn + vault. While you were
              watching the feed, the stack looped HolyC through JIT and back again.
            </p>
            <p>
              <strong>Mission #001 recap</strong>
            </p>
            <ul>
              <li>Route: HC → JIT → HC via pools + Compiler.</li>
              <li>Vault profit: +109k HolyC.</li>
              <li>Side capture: +44k JIT (restored into extra HolyC).</li>
              <li>Total burned: 126k HolyC once fees settled.</li>
            </ul>
            <div className={styles.tokenGrid}>
              <div className={`${styles.tokenCard} ${styles.holycCard}`}>
                <h5 className={styles.tokenTitle}>Vault profit</h5>
                <p className={styles.tokenDesc}>Added directly to protocol collateral.</p>
                <div className={styles.tokenStat}>
                  <span>HolyC gained</span>
                  <strong>+109k</strong>
                </div>
                <div className={styles.tokenStat}>
                  <span>Status</span>
                  <strong>Locked in vault</strong>
                </div>
              </div>
              <div className={`${styles.tokenCard} ${styles.jitCard}`}>
                <h5 className={styles.tokenTitle}>JIT assist</h5>
                <p className={styles.tokenDesc}>Transfer-burn value reclaimed mid-route.</p>
                <div className={styles.tokenStat}>
                  <span>JIT captured</span>
                  <strong>+44k</strong>
                </div>
                <div className={styles.tokenStat}>
                  <span>Usage</span>
                  <strong>Restored to HolyC</strong>
                </div>
              </div>
              <div className={styles.tokenCard} style={{ borderColor: 'var(--red-glow)' }}>
                <h5 className={styles.tokenTitle} style={{ color: 'var(--red-glow)' }}>
                  HolyC burned
                </h5>
                <p className={styles.tokenDesc}>Fees settled after profit, then sent to 0x000...0369.</p>
                <div className={styles.tokenStat}>
                  <span>HolyC burned</span>
                  <strong>-126k</strong>
                </div>
                <div className={styles.tokenStat}>
                  <span>Timing</span>
                  <strong>Same transaction</strong>
                </div>
              </div>
            </div>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <span>🔎 Arb Guardian scanned every relevant pool off-chain until a safe spread appeared.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <span>📝 It called the Divine Manager with the HC ↔ JIT ↔ WPLS path that cleared all checks.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <span>✅ The loop cleared compile + restore + transfer fees, gas, and slippage.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>4</div>
                <span>🔁 Owed JIT was restored back into additional HolyC instead of burning mid-route.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>5</div>
                <span>🔥 126k HolyC hit the burn address immediately after settlement.</span>
              </div>
            </div>
            <p>Vault balance up. Circulating HolyC down. Nobody had to do anything.</p>
          </Section>

          <Section title="How the Arb Guardian works" icon={<Search size={20} />}>
            <p>
              The Arb Guardian lives entirely off-chain. It never holds funds and it never touches the vault. Its only
              permission is to call the Divine Manager when a route is provably profitable after safety checks.
            </p>
            <p>
              <strong>What it watches:</strong>
            </p>
            <ul>
              <li>HolyC/WPLS pool.</li>
              <li>JIT/WPLS pool.</li>
              <li>Any HolyC/JIT liquidity plus compiler parity.</li>
              <li>The Divine Compiler&apos;s fixed compile / restore rate.</li>
            </ul>
            <p>
              <strong>What it simulates:</strong>
            </p>
            <ul>
              <li>Every useful HC ↔ JIT ↔ WPLS route (plus extra compiler hops).</li>
              <li>The full fee stack: 4% compile, 4% restore, 2% JIT transfer burn.</li>
              <li>Slippage + gas using live reserves and current network costs.</li>
            </ul>
            <p>Only if net HolyC/JIT stays positive after all that will it ping the Divine Manager.</p>
            <div className={styles.insightBox}>
              <Bot size={16} />
              <span>
                It scans on a regular cadence (around hourly depending on load), but arbs are irregular and only fire
                when spreads justify it.
              </span>
            </div>
          </Section>

          <Section title="How the Divine Manager executes" icon={<Zap size={20} />}>
            <p>
              Once the Arb Guardian gives it a route, the Divine Manager runs the on-chain side of the mission and keeps
              its own accounting straight.
            </p>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <span>
                  Executes the multi-leg loop fee-exempt: buy cheap pool, bridge via the Compiler, sell into the rich
                  pool.
                </span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <span>Tracks all “owed fees” internally instead of burning JIT mid-route.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <span>Settles at the end: restores owed JIT into HolyC, burns the HolyC, then deposits the profit.</span>
              </div>
            </div>
            <p>Every successful arb shrinks circulating HolyC and deepens the vault reserve.</p>
          </Section>

          <Section title="Why MEV and copycats can’t follow" icon={<ShieldCheck size={20} />}>
            <p>Frontrunners see the transaction, but the economics don’t work in their favor.</p>
            <ul>
              <li>Fee exemption: the Divine Manager is whitelisted; random wallets pay every tax in real time.</li>
              <li>Pre-simulated sizing: the Guardian already tuned the route for available liquidity and gas.</li>
              <li>Internal fee accounting: the protocol burns after the fact, while copy bots bleed mid-loop.</li>
            </ul>
            <p>The result: they can try to copy the calldata, but they can’t beat the price without donating edge.</p>
          </Section>

          <Section title="When and how burns happen" icon={<Flame size={20} />}>
            <p>Burns only happen after profit is secured, so holders aren’t diluted mid-execution.</p>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <span>The arb loop locks in vault profit.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <span>The owed compile + JIT fees get restored into fresh HolyC.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <span>
                  That HolyC is fired in one shot to <span className={styles.tooltipRed}>0x000...0369</span> — clean
                  accounting every time.
                </span>
              </div>
            </div>
          </Section>

          <Section title="Cadence & impact" icon={<CalendarDays size={20} />}>
            <p>
              Scan cadence is regular (roughly hourly), execution cadence is purely event-driven. Tight markets mean
              quiet feeds; chaotic degen swings mean more missions.
            </p>
            <ul>
              <li>Each mission reduces effective HolyC float via burns + permanently locked backing.</li>
              <li>Each mission grows the vault, giving more collateral for future utilities.</li>
              <li>The public execute feed shows every tx so you can verify burn + profit math.</li>
            </ul>
            <div className={styles.insightBox}>
              <Flame size={16} />
              <span>Every “Execute” event = lighter float and a heavier vault.</span>
            </div>
          </Section>

          <Section title="Current mode & future direction" icon={<Target size={20} />}>
            <p>
              Right now the Divine Manager is in accumulate mode: stack HolyC in the vault while continuously burning a
              portion of every profitable loop.
            </p>
            <p>
              <strong>Design goals (not guarantees):</strong>
            </p>
            <ul>
              <li>Route part of vault yield back to believers (e.g. pro-rata to HolyC holders / LPs / loyalty tiers).</li>
              <li>Deploy vault collateral to reinforce growth (LP incentives, liquidity depth, HolyC-linked utilities).</li>
              <li>Keep every burn + payout transparent through the Divine Manager execute feed.</li>
            </ul>
            <div className={styles.insightBox} style={{ borderColor: 'var(--green-glow)' }}>
              <Sparkles size={16} />
              <span>Design goal, not a guarantee. Exact mechanics may evolve as the vault grows.</span>
            </div>
          </Section>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DivineManagerGuideModal
