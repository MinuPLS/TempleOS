import styles from './StatsDashboard.module.css';
import { usePoolData } from '../UniswapPools/hooks/usePoolData';
import { useTokenStats } from './hooks/useTokenStats';
import { formatCurrency, formatBigIntTokenAmount } from '@/lib/utils';
import HolyCLogo from '../../assets/TokenLogos/HolyC.png';
import JITLogo from '../../assets/TokenLogos/JIT.png';
import PulseXLogo from '../../assets/TokenLogos/PulseX.png';
import RefreshIcon from '../../assets/refresh-icon.svg';
import { Tooltip } from '../Tooltip';
import { useState } from 'react';

export const StatsDashboard = () => {
  const { tokenPrices } = usePoolData();
  const { tokenStats, isLoading, error, refresh: refreshTokenStats } = useTokenStats();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (rowId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  return (
    <div className={styles.poolsContainer}>
      <div className={styles.header}>
        <Tooltip 
          content="Key metrics to track the ecosystem and help make trading decisions" 
          variant="info"
          position="bottom"
        >
          <h2 className={styles.title}>Token Stats</h2>
        </Tooltip>
        <div className={styles.headerActions}>
          <Tooltip 
            content="Refresh stats with a new on-chain fetch" 
            variant="info"
            position="bottom"
          >
            <button onClick={refreshTokenStats} className={styles.refreshButton} disabled={isLoading} aria-label="Refresh stats">
              <img src={RefreshIcon} alt="Refresh" className={`${styles.refreshIcon} ${isLoading ? styles.loadingIcon : ''}`} />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className={styles.poolsGrid}>
        {/* Token Prices Section */}
        <div className={styles.tokenPricesCard}>
          <div className={styles.poolNameAndLogos}>
            <h3 className={styles.poolName}>Token Prices</h3>
          </div>
          <div className={styles.poolInfo}>
            <div className={`${styles.tokenPriceRow} ${styles.holycPriceRow}`}>
              <div className={styles.tokenNameSection}>
                <img src={HolyCLogo} alt="HolyC logo" className={styles.logo} />
                HolyC:
              </div>
              <div className={styles.priceSection}>
                <span>{formatCurrency(tokenPrices.holycUSD)}</span>
              </div>
            </div>
            <div className={`${styles.tokenPriceRow} ${styles.jitPriceRow}`}>
              <div className={styles.tokenNameSection}>
                <img src={JITLogo} alt="JIT logo" className={styles.logo} />
                JIT:
              </div>
              <div className={styles.priceSection}>
                <span>{formatCurrency(tokenPrices.jitUSD)}</span>
              </div>
            </div>
            {tokenPrices.holycUSD !== 0 && tokenPrices.jitUSD !== 0 && (() => {
              const holycPrice = tokenPrices.holycUSD;
              const jitPrice = tokenPrices.jitUSD;
              
              if (holycPrice === jitPrice) return null;

              const moreExpensiveTokenName = holycPrice > jitPrice ? 'HolyC' : 'JIT';
              const moreExpensiveTokenStyle = holycPrice > jitPrice ? styles.tooltipBlue : styles.tooltipAmber;
              const percentageDiff = holycPrice > jitPrice
                ? ((holycPrice / jitPrice) - 1) * 100
                : ((jitPrice / holycPrice) - 1) * 100;

              return (
                <p className={styles.priceDifference}>
                  <span className={moreExpensiveTokenStyle}>{moreExpensiveTokenName}</span>
                  <span className={styles.cheaper}> is more expensive</span> by <span className={styles.cheaper}>{percentageDiff.toFixed(2)}%</span>
                </p>
              );
            })()}
          </div>
        </div>
        
        {/* Token Supply Overview */}
        <div className={styles.poolCard}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.poolName}>Token Supply</h3>
          </div>
          <div className={styles.poolInfo}>
            <div className={styles.tokenAmounts}>
              <div className={styles.expandableRow}>
                <div className={styles.statRow} onClick={() => toggleRow('holyc-circulating')}>
                  <div className={styles.statLabel}>
                    <img src={HolyCLogo} alt="HolyC logo" className={styles.statIcon} />
                    <span className={styles.statName}>HolyC Circulating</span>
                  </div>
                  <div className={styles.statValue}>
                    <span className={styles.circulatingSupplyValue}>{formatBigIntTokenAmount(tokenStats.circulatingHolyC, 0)}</span>
                    <div className={`${styles.expandIcon} ${expandedRows.has('holyc-circulating') ? styles.expanded : ''}`}>
                      ▼
                    </div>
                  </div>
                </div>
                <div className={`${styles.expandableContent} ${expandedRows.has('holyc-circulating') ? styles.expanded : ''}`}>
                  <div className={styles.explanationText}>
                    All available <span className={styles.tooltipBlue}>HolyC</span> held in wallets and contracts, including the portion in the Compiler that can still be redeemed by Restoring <span className={styles.tooltipAmber}>JIT</span> tokens.
                  </div>
                </div>
              </div>
              <div className={styles.expandableRow}>
                <div className={styles.statRow} onClick={() => toggleRow('jit-supply')}>
                  <div className={styles.statLabel}>
                    <img src={JITLogo} alt="JIT logo" className={styles.statIcon} />
                    <span className={styles.statName}>JIT Supply</span>
                  </div>
                  <div className={styles.statValue}>
                    <span className={styles.jitSupplyValue}>{formatBigIntTokenAmount(tokenStats.jitCirculating, 0)}</span>
                    <div className={`${styles.expandIcon} ${expandedRows.has('jit-supply') ? styles.expanded : ''}`}>
                      ▼
                    </div>
                  </div>
                </div>
                <div className={`${styles.expandableContent} ${expandedRows.has('jit-supply') ? styles.expanded : ''}`}>
                  <div className={styles.explanationText}>
                    <span className={styles.tooltipAmber}>JIT</span> tokens compiled from <span className={styles.tooltipBlue}>HolyC</span>, the available supply users can Transfer/Trade. Backed 1-for-1 by <span className={styles.tooltipBlue}>HolyC</span>, but Compile, Restore, and Transfer Fees mean you get slightly less than one <span className={styles.tooltipAmber}>JIT</span> per <span className={styles.tooltipBlue}>HolyC</span>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reserves & Liquidity */}
        <div className={styles.poolCard}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.poolName}>Reserves & Liquidity</h3>
          </div>
          <div className={styles.poolInfo}>
            <div className={styles.tokenAmounts}>
              <div className={styles.expandableRow}>
                <div className={styles.statRow} onClick={() => toggleRow('holyc-compiler')}>
                  <div className={styles.statLabel}>
                    <img src={HolyCLogo} alt="HolyC logo" className={styles.statIcon} />
                    <span className={styles.statName}>HolyC in Compiler</span>
                  </div>
                  <div className={styles.statValue}>
                    <span className={styles.lockedAmount}>{formatBigIntTokenAmount(tokenStats.holycLocked, 0)}</span>
                    <div className={`${styles.expandIcon} ${expandedRows.has('holyc-compiler') ? styles.expanded : ''}`}>
                      ▼
                    </div>
                  </div>
                </div>
                <div className={`${styles.expandableContent} ${expandedRows.has('holyc-compiler') ? styles.expanded : ''}`}>
                  <div className={styles.explanationText}>
                    <span className={styles.tooltipBlue}>HolyC</span> held in the Compiler contract to back the current <span className={styles.tooltipAmber}>JIT</span> supply. Contains some <span className={styles.tooltipRed}>Locked HolyC</span> that can never be redeemed, since there isn't enough circulating <span className={styles.tooltipAmber}>JIT</span> to Restore all of it into <span className={styles.tooltipBlue}>HolyC</span>. The redeemable portion is already counted in <span className={styles.tooltipBlue}>HolyC Circulating</span>.
                  </div>
                </div>
              </div>
              <div className={styles.expandableRow}>
                <div className={styles.statRow} onClick={() => toggleRow('burned-lp')}>
                  <div className={styles.statLabel}>
                    <img src={PulseXLogo} alt="PulseX logo" className={styles.statIcon} />
                    <span className={styles.statName}>Burned LP</span>
                  </div>
                  <div className={styles.statValue}>
                    <span className={styles.liquidityAmount}>{formatBigIntTokenAmount(tokenStats.holycLockedAsLP, 0)}</span>
                    <div className={`${styles.expandIcon} ${expandedRows.has('burned-lp') ? styles.expanded : ''}`}>
                      ▼
                    </div>
                  </div>
                </div>
                <div className={`${styles.expandableContent} ${expandedRows.has('burned-lp') ? styles.expanded : ''}`}>
                  <div className={styles.explanationText}>
                    <span className={styles.tooltipBlue}>HolyC</span> currently deposited as liquidity on the DEX. The <span className={styles.tooltipIndigo}>LP tokens</span> were burned, so liquidity cannot be withdrawn; the <span className={styles.tooltipBlue}>HolyC</span> stays in the pool for trading. Any <span className={styles.tooltipBlue}>HolyC</span> bought from the pool is removed from this amount and added to the <span className={styles.tooltipBlue}>Circulating Supply</span>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Permanently Removed */}
        <div className={styles.poolCard}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.poolName}>Permanently Removed</h3>
          </div>
          <div className={styles.poolInfo}>
            <div className={styles.tokenAmounts}>
              <div className={styles.expandableRow}>
                <div className={styles.statRow} onClick={() => toggleRow('locked-holyc')}>
                  <div className={styles.statLabel}>
                    <div className={styles.lockEmoji}>🔒</div>
                    <span className={styles.statName}>Locked HolyC</span>
                  </div>
                  <div className={styles.statValue}>
                    <span className={styles.burnedAmount}>{formatBigIntTokenAmount(tokenStats.permanentlyLockedHolyC, 0)}</span>
                    <div className={`${styles.expandIcon} ${expandedRows.has('locked-holyc') ? styles.expanded : ''}`}>
                      ▼
                    </div>
                  </div>
                </div>
                <div className={`${styles.expandableContent} ${expandedRows.has('locked-holyc') ? styles.expanded : ''}`}>
                  <div className={styles.explanationText}>
                    <span className={styles.tooltipBlue}>HolyC</span> permanently trapped in the Compiler by <span className={styles.tooltipAmber}>JIT</span> Transfer Burns and Fees; it can never be withdrawn or redeemed.
                  </div>
                </div>
              </div>
              <div className={styles.expandableRow}>
                <div className={styles.statRow} onClick={() => toggleRow('burned-holyc')}>
                  <div className={styles.statLabel}>
                    <div className={styles.flameEmoji}>🔥</div>
                    <span className={styles.statName}>Burned HolyC</span>
                  </div>
                  <div className={styles.statValue}>
                    <span className={styles.burnedAmount}>{formatBigIntTokenAmount(tokenStats.holycFeesBurned, 0)}</span>
                    <div className={`${styles.expandIcon} ${expandedRows.has('burned-holyc') ? styles.expanded : ''}`}>
                      ▼
                    </div>
                  </div>
                </div>
                <div className={`${styles.expandableContent} ${expandedRows.has('burned-holyc') ? styles.expanded : ''}`}>
                  <div className={styles.explanationText}>
                    <span className={styles.tooltipBlue}>HolyC</span> sent to the Burn Address from Compile/Restore Fees or Manual Burns; permanently removed from supply.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading/Error State */}
        {isLoading && (
          <div className={styles.poolCard}>
            <div className={styles.poolInfo}>
              <p className={styles.poolValue}>Loading token stats...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className={styles.poolCard}>
            <div className={styles.poolInfo}>
              <p className={styles.poolValue}>Error: {error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};