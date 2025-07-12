import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, BookOpen, Coins, ArrowRight, CheckCircle2, 
  Recycle, Anchor, ShieldCheck, Zap, Gem, Flame, Bot, UserCheck, TrendingUp, Droplets
} from 'lucide-react';
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
          <h2><BookOpen className={styles.headerIcon} /> The JIT Compiler Guide</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close guide">
            <X size={24} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.intro}>
            <h3 className={styles.introTitle}>Divine Intellect: The First Deflationary Pump.Tires Token</h3>
            <p className={styles.introText}>
              <strong className={styles.tooltipIndigo}>HolyC</strong> is the first deflationary Pump.Tires token, made possible by a pioneering tokenomic model designed and invented by <strong className={styles.tooltipPurple}>@MinuPLS</strong>.
            </p>
            <p className={styles.introText} style={{marginTop: '12px'}}>
              Inspired by Terry Davis’s Just-In-Time Compiler for TempleOS, the "Divine Compiler" uses a second token, <strong className={styles.tooltipAmber}>JIT</strong>, to make the non-burning HolyC effectively deflationary through a unique dual-token system that creates <span className={styles.tooltipGreen}>arbitrage</span>, <span className={styles.tooltipRed}>supply shock</span>, and price alignment.
            </p>
          </div>

          <Section title="The Two Tokens" icon={<Coins size={20} />}>
            <div className={styles.tokenGrid}>
              <div className={`${styles.tokenCard} ${styles.holycCard}`}>
                <h5 className={styles.tokenTitle}>HolyC</h5>
                <p className={styles.tokenDesc}>The foundational, tax-free reserve asset with a fixed supply.</p>
                <div className={styles.tokenStat}><span>Supply:</span> <strong>1T (Fixed)</strong></div>
                <div className={styles.tokenStat}><span>Tax:</span> <strong>0%</strong></div>
              </div>
              <div className={`${styles.tokenCard} ${styles.jitCard}`}>
                <h5 className={styles.tokenTitle}>JIT</h5>
                <p className={styles.tokenDesc}>The utility token that enables deflation through a transfer burn.</p>
                <div className={styles.tokenStat}><span>Supply:</span> <strong>≤1T (Deflationary)</strong></div>
                <div className={styles.tokenStat}><span>Transfer Fee:</span> <strong>2% Burn</strong></div>
              </div>
            </div>
          </Section>

          <Section title="The Compiler's Fixed-Rate Guarantee" icon={<Anchor size={20} />}>
            <p>The Compiler is the only place <span className={styles.tooltipAmber}>JIT</span> can be minted or restored. It enforces a fixed 1:1 conversion (minus fees), creating a <strong className={styles.tooltipGreen}>hardcoded anchor outside the market</strong>.</p>
            <p>This predictable ratio holds regardless of pool prices. The Compiler is indifferent to market conditions; it simply enforces its fixed rate, ensuring the tokens always have a path back to equilibrium.</p>
            <div className={styles.parityFlow}>
              <div className={styles.parityRow}><span>1 <span className={styles.tooltipIndigo}>HolyC</span></span> <ArrowRight size={16} /> <span>1 <span className={styles.tooltipAmber}>JIT</span> <small>(-4% Fee)</small></span></div>
              <div className={styles.parityRow}><span>1 <span className={styles.tooltipAmber}>JIT</span></span> <ArrowRight size={16} /> <span>1 <span className={styles.tooltipIndigo}>HolyC</span> <small>(-4% Fee)</small></span></div>
            </div>
          </Section>

          <Section title="How the System Self-Regulates" icon={<Recycle size={20} />}>
            <p>Every buy or sell in the <span className={styles.tooltipIndigo}>HolyC</span>/<span className={styles.tooltipPurple}>PLS</span> or <span className={styles.tooltipAmber}>JIT</span>/<span className={styles.tooltipPurple}>PLS</span> pools creates price pressure. When <span className={styles.tooltipIndigo}>HolyC</span> is bought, its price rises relative to <span className={styles.tooltipAmber}>JIT</span>, creating an imbalance. These price shifts create natural <span className={styles.tooltipGreen}>arbitrage</span> pathways that always route volume through the <span className={styles.tooltipIndigo}>HolyC</span>/<span className={styles.tooltipAmber}>JIT</span> pool, triggering the 2% <span className={styles.tooltipRed}>JIT burn</span>.</p>
            <div className={styles.insightBox}>
              <Gem size={16} />
              <span>The system fuels itself. It doesn’t need manual interaction—the market just needs to breathe.</span>
            </div>
          </Section>

          <Section title="Engine of Deflation: Supply Shock" icon={<Flame size={20} />}>
            <p><span className={styles.tooltipAmber}>JIT</span>'s deflationary mechanics create a continuous <span className={styles.tooltipRed}>supply shock</span>. When <span className={styles.tooltipAmber}>JIT</span> becomes scarce, the market is incentivized to compile <span className={styles.tooltipIndigo}>HolyC</span> to mint more <span className={styles.tooltipAmber}>JIT</span>, which removes <span className={styles.tooltipIndigo}>HolyC</span> from circulation and burns a portion as fees. This permanently locks some <span className={styles.tooltipIndigo}>HolyC</span> in the compiler contract.</p>
          </Section>

          <Section title="LP Advantage: No Impermanent Loss" icon={<ShieldCheck size={20} />}>
            <p>The fee structure deliberately channels <span className={styles.tooltipGreen}>arbitrage</span> volume through the <strong className={styles.tooltipIndigo}>HolyC</strong>/<strong className={styles.tooltipAmber}>JIT</strong> pool, benefiting LPs who are shielded from <span className={styles.tooltipRed}>impermanent loss</span> by the Compiler's fixed-rate guarantee.</p>
          </Section>

          <div className={styles.strategySection}>
            <h4 className={styles.strategyTitleHeader}><Zap size={20} /> The Trader's Advantage</h4>
            <p className={styles.strategyIntro}>Friction in the system creates opportunity. Bots and traders create inefficiencies and <span className={styles.tooltipRed}>burn</span> tokens, leaving behind value that only a savvy user with the Compiler can capture.</p>
            
            <Section title="Strategy 1: The Compiler Hop & Rebalance" icon={<UserCheck size={20} />} className={styles.subSection}>
              <p>The Compiler is your bridge to transform an undervalued token into a stronger one, allowing you to profit from the price difference.</p>
              <div className={styles.stepList}>
                <div className={styles.step}><div className={styles.stepNumber}>1</div><span><strong className={styles.stepTitle}>Buy Cheap:</strong> Identify the undervalued token in the <span className={styles.tooltipPurple}>PLS</span> pools and acquire it.</span></div>
                <div className={styles.step}><div className={styles.stepNumber}>2</div><span><strong className={styles.stepTitle}>Compiler Hop:</strong> Use the Compiler to convert it 1:1 (minus fees) into the higher-value token.</span></div>
                <div className={styles.step}><div className={styles.stepNumber}>3</div><span><strong className={styles.stepTitle}>Rebalance:</strong> Swap the expensive token back for more of the cheap one in the <span className={styles.tooltipIndigo}>HolyC</span>/<span className={styles.tooltipAmber}>JIT</span> pool for a profit.</span></div>
              </div>
              <div className={styles.insightBox} style={{borderColor: 'var(--green-glow)'}}>
                <Gem size={16} />
                <span>You <span className={styles.tooltipGreen}>profit</span> by restoring balance, without harming the market.</span>
              </div>
            </Section>

            <Section title="Strategy 2: Exploiting Bot Activity" icon={<Bot size={20} />} className={styles.subSection}>
              <p><span className={styles.tooltipGreen}>Arbitrage bots</span> react instantly to price spikes across PulseX pools, but they can't use the Compiler. Their actions create deeper arbitrage opportunities for you.</p>
              <div className={styles.stepList}>
                <div className={styles.step}><div className={styles.stepNumber}>1</div><span>A bot's trade <span className={styles.tooltipRed}>burns JIT</span> and shifts pool ratios, creating a discount.</span></div>
                <div className={styles.step}><div className={styles.stepNumber}>2</div><span><strong className={styles.stepTitle}>Spot the Discount:</strong> Identify the <span className={styles.tooltipAmber}>JIT</span> discount caused by bot activity.</span></div>
                <div className={styles.step}><div className={styles.stepNumber}>3</div><span><strong className={styles.stepTitle}>Restore Value:</strong> Buy cheap <span className={styles.tooltipAmber}>JIT</span> and use the Compiler to restore it 1:1 to the more valuable <span className={styles.tooltipIndigo}>HolyC</span>.</span></div>
              </div>
              <div className={styles.insightBox} style={{borderColor: 'var(--green-glow)'}}>
                <UserCheck size={16} />
                <span>Leverage the Compiler to capture deep value that bots can’t reach.</span>
              </div>
            </Section>
          </div>

          <Section title="The Holder's Advantage" icon={<TrendingUp size={20} />}>
            <p>As a holder of the fixed-supply <strong className={styles.tooltipIndigo}>HolyC</strong> token, you benefit passively from the entire ecosystem without ever needing to interact with it directly.</p>
            <p>Every trade, whether by a strategic user or an <span className={styles.tooltipGreen}>arbitrage bot</span>, contributes to the deflation of <span className={styles.tooltipAmber}>JIT</span> and the corresponding reduction of <span className={styles.tooltipIndigo}>HolyC</span>'s circulating supply. Both traders and bots are naturally incentivized to perform actions that ultimately <span className={styles.tooltipRed}>burn</span> tokens, creating a perpetual, positive pressure on the value of your holdings.</p>
            <div className={styles.insightBox} style={{borderColor: 'var(--green-glow)'}}>
              <CheckCircle2 size={16} />
              <span>Simply holding <strong className={styles.tooltipIndigo}>HolyC</strong> is enough to benefit from the deflationary engine.</span>
            </div>
          </Section>

          <Section title="The Engine Needs Fuel" icon={<Droplets size={20} />} className={styles.finalSection}>
            <p>The system works, but it doesn’t create its own fuel. It needs activity.</p>
            <p>No volume means no price gaps. No gaps means no arbitrage. No arbitrage means no burn or rebalancing. Without volume, the engine doesn't spin.</p>
            <p className={styles.finalThought}>That’s not a flaw. That’s just how engines work.</p>
          </Section>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default GuideModal;