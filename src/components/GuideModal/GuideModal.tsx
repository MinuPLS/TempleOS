import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, BookOpen, Coins, ArrowRight, ArrowLeftRight, CheckCircle2, 
  Anchor, ShieldCheck, Zap, Bot, TrendingUp, Droplets
} from 'lucide-react';
import HolyCLogo from '../../assets/TokenLogos/HolyC.png';
import JITLogo from '../../assets/TokenLogos/JIT.png';
import styles from './GuideModal.module.css';

export interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, children, className }) => (
  <div className={`${styles.section} ${className || ''}`}>
    <h4 className={styles.sectionTitle}>
      {icon}
      <span>{title}</span>
    </h4>
    <div className={styles.sectionContent}>
      {children}
    </div>
  </div>
);

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2><BookOpen className={styles.headerIcon} /> Tokenomics</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close guide">
            <X size={24} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.intro}>
            <div className={styles.introLogos}>
              <img src={HolyCLogo} alt="HolyC logo" className={styles.introLogo} />
              <ArrowLeftRight size={18} className={styles.introArrow} />
              <img src={JITLogo} alt="JIT logo" className={styles.introLogo} />
            </div>
            <h3 className={styles.introTitle}>TempleOS: HolyC &amp; JIT</h3>
            <p className={styles.introText}>
              <strong className={styles.tooltipIndigo}>HolyC</strong> is the first deflationary Pump.Tires token, powered by a pioneering tokenomic design from <strong className={styles.tooltipPurple}>@MinuPLS</strong>.
            </p>
            <p className={`${styles.introText} ${styles.introQuestion}`}>
              <span className={styles.keyword}>Paradox:</span> <em>How do you burn the supply of a fixed-supply, zero-tax token?</em>
            </p>
            <p className={styles.introText}>
              The answer is the <span className={styles.glowText}>Divine Compiler</span>. Inspired by Terry Davis’s Just-In-Time Compiler for TempleOS, it creates a shadow state called <strong className={styles.tooltipAmber}>JIT</strong> so <span className={styles.tooltipIndigo}>HolyC</span> can remain safe and tax-free while its wrapped counterpart constantly burns behind the scenes.
            </p>
          </div>

          <Section title="The Dual-Token Architecture" icon={<Coins size={20} />}>
            <p>The ecosystem pairs one main asset with one utility wrapper. They are mathematically linked but free to trade independently.</p>
            <div className={styles.tokenGrid}>
              <div className={`${styles.tokenCard} ${styles.holycCard}`}>
                <div className={styles.tokenCardHeader}>
                  <img src={HolyCLogo} alt="HolyC logo" className={styles.tokenLogo} />
                  <div>
                    <h5 className={styles.tokenTitle}>HolyC</h5>
                    <span className={styles.tokenSubtitle}>The Asset</span>
                  </div>
                </div>
                <div className={styles.tokenBadges}>
                  <span className={`${styles.tokenBadge} ${styles.reserveBadge}`}>Reserve</span>
                  <span className={styles.tokenBadge}>Fixed</span>
                </div>
                <p className={styles.tokenDesc}><span className={styles.keyword}>Role:</span> The foundational reserve currency.</p>
                <div className={styles.tokenStat}><span>Properties</span><strong>Fixed Supply · 1B</strong></div>
                <div className={styles.tokenStat}><span>Tax</span><strong>0% · Renounced</strong></div>
                <div className={styles.tokenStat}><span>User Action</span><strong>Buy &amp; Hold</strong></div>
              </div>
              <div className={`${styles.tokenCard} ${styles.jitCard}`}>
                <div className={styles.tokenCardHeader}>
                  <img src={JITLogo} alt="JIT logo" className={styles.tokenLogo} />
                  <div>
                    <h5 className={styles.tokenTitle}>JIT</h5>
                    <span className={styles.tokenSubtitle}>The Wrapper</span>
                  </div>
                </div>
                <div className={styles.tokenBadges}>
                  <span className={`${styles.tokenBadge} ${styles.wrapperBadge}`}>Wrapper</span>
                  <span className={styles.tokenBadge}>Deflationary</span>
                </div>
                <p className={styles.tokenDesc}><span className={styles.keyword}>Role:</span> Utility wrapper backed 100% by locked HolyC.</p>
                <div className={styles.tokenStat}><span>Properties</span><strong>Deflationary Supply</strong></div>
                <div className={styles.tokenStat}><span>Transfer</span><strong>2% Burn</strong></div>
                <div className={styles.tokenStat}><span>User Action</span><strong>Divine Manager / bots burn supply</strong></div>
              </div>
            </div>
          </Section>

          <Section title="The Divine Compiler: The 1:1 Anchor" icon={<Anchor size={20} />}>
            <p>The Compiler smart contract sits between both tokens. It lets you wrap <span className={styles.tooltipIndigo}>HolyC</span> into <span className={styles.tooltipAmber}>JIT</span> (<span className={styles.keyword}>Compile</span>) or unwrap JIT back into HolyC (<span className={styles.keyword}>Restore</span>) at a fixed internal rate.</p>
            <p>To keep the system permanently deflationary, the Compiler charges a toll each way.</p>
            <div className={styles.parityFlow}>
              <div className={styles.parityRow}>
                <div className={styles.flowBlock}>
                  <img src={HolyCLogo} alt="HolyC source" className={styles.flowTokenLogo} />
                  <div>
                    <strong>Compile</strong>
                    <span>Lock 1 HolyC</span>
                  </div>
                </div>
                <ArrowRight size={18} />
                <div className={styles.flowBlock}>
                  <img src={JITLogo} alt="JIT output" className={styles.flowTokenLogo} />
                  <div>
                    <strong>Receive 1 JIT</strong>
                    <small>(minus 4% burn)</small>
                  </div>
                </div>
              </div>
              <div className={styles.parityRow}>
                <div className={styles.flowBlock}>
                  <img src={JITLogo} alt="JIT source" className={styles.flowTokenLogo} />
                  <div>
                    <strong>Restore</strong>
                    <span>Burn 1 JIT</span>
                  </div>
                </div>
                <ArrowRight size={18} />
                <div className={styles.flowBlock}>
                  <img src={HolyCLogo} alt="HolyC output" className={styles.flowTokenLogo} />
                  <div>
                    <strong>Unlock 1 HolyC</strong>
                    <small>(minus 4% burn)</small>
                  </div>
                </div>
              </div>
            </div>
            <p className={styles.caption}>This toll creates the <span className={styles.keyword}>Hard Anchor.</span> Inside the Compiler the rate never moves. Outside, the market can swing wildly.</p>
          </Section>

          <Section title="How Variance Is Created (The Depeg)" icon={<Zap size={20} />}>
            <p><span className={styles.tooltipIndigo}>HolyC</span>/PLS and <span className={styles.tooltipAmber}>JIT</span>/PLS pools on PulseX trade independently, so the tokens diverge in price.</p>
            <ul className={styles.calloutList}>
              <li><span className={styles.tooltipAmber}>Friction Gap:</span> JIT burns 2% on every transfer and costs 4% to compile or redeem, so markets naturally price it differently from HolyC.</li>
              <li><span className={styles.tooltipGreen}>Opportunity Window:</span> The Compiler rate stays ~1:1. When the market drifts away, a gap appears—free value waiting for whoever bridges it.</li>
            </ul>
            <div className={styles.dualStatGrid}>
              <div className={styles.dualStat}>
                <h5>Market Price</h5>
                <p>Moves with liquidity and trading volume.</p>
              </div>
              <div className={styles.dualStat}>
                <h5>Compiler Price</h5>
                <p>Hard-coded 1 HolyC ↔ 1 JIT (minus toll).</p>
              </div>
            </div>
            <div className={styles.insightBox}>
              <CheckCircle2 size={16} />
              <span>The gap between these prices is the engine’s heartbeat.</span>
            </div>
          </Section>

          <Section title="The Protocol’s Advantage: Automated Arbitrage" icon={<Bot size={20} />}>
            <p>In most ecosystems, predatory bots would vacuum this gap. Here, the <strong className={styles.tooltipPurple}>Divine Manager</strong> captures it for holders by running an automated loop 24/7.</p>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <span><strong className={styles.stepTitle}>Buy:</strong> Acquire the undervalued token on PulseX.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <span><strong className={styles.stepTitle}>Bridge:</strong> Force it through the Compiler at the fixed rate, sidestepping market pricing.</span>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <span><strong className={styles.stepTitle}>Sell:</strong> Offload the stronger asset back to market to close the gap.</span>
              </div>
            </div>
            <p>The captured profit is split: <span className={styles.tooltipRed}>Burn</span> a portion immediately (reducing <span className={styles.tooltipIndigo}>HolyC</span> supply) and route the remainder to the <span className={styles.tooltipGreen}>Protocol Vault</span> to back every holder.</p>
          </Section>

          <Section title="Decentralization &amp; Open Access" icon={<ShieldCheck size={20} />}>
            <p>Automation benefits the protocol, but the system stays fully permissionless.</p>
            <ul>
              <li>The Compiler contract and the <span className={styles.tooltipAmber}>JIT</span> token are open tools.</li>
              <li>Anyone can Compile, Restore, or self-arb via the dApp or block explorer.</li>
              <li>Whether you loop manually or let the Divine Manager work, every action feeds the deflationary engine.</li>
            </ul>
            <p>Want to study the automations in detail? Dive into the <span className={styles.tooltipPurple}>Divine Manager Guide</span>.</p>
          </Section>

          <Section title="The Holder's Advantage" icon={<TrendingUp size={20} />}>
            <p>Holding the fixed-supply <strong className={styles.tooltipIndigo}>HolyC</strong> token gives you passive exposure to the entire machine. You never need to touch <span className={styles.tooltipAmber}>JIT</span> to benefit.</p>
            <p>Every compile, restore, transfer burn, or arbitrage loop permanently destroys tokens. The system turns market volatility into engineered scarcity.</p>
            <div className={styles.insightBox} style={{ borderColor: 'var(--green-glow)' }}>
              <CheckCircle2 size={16} />
              <span>Simply holding <strong className={styles.tooltipIndigo}>HolyC</strong> is enough to receive the upside of constant burns.</span>
            </div>
          </Section>

          <Section title="The Engine Needs Fuel" icon={<Droplets size={20} />} className={styles.finalSection}>
            <p>The engine is powerful, but it still needs volume. No volume means no gaps. No gaps means no arbitrage. No arbitrage means no burn.</p>
            <p>That’s not a flaw—it’s how engines work.</p>
          </Section>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default GuideModal;
