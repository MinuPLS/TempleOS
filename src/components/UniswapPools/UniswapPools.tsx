import styles from './UniswapPools.module.css';
import { usePoolData } from './hooks/usePoolData';
import { formatCurrency, formatTokenAmount, formatAddress } from '@/lib/utils';
import HolyCLogo from '../../assets/TokenLogos/HolyC.png';
import JITLogo from '../../assets/TokenLogos/JIT.png';
import WPLSLogo from '../../assets/TokenLogos/wpls.png';
import RefreshIcon from '../../assets/refresh-icon.svg';
import { Tooltip } from '../Tooltip';
import { useState } from 'react';

interface UniswapPoolsProps {
  currentPanel?: number;
  onPanelChange?: (panel: number) => void;
}

export const UniswapPools = ({}: UniswapPoolsProps = {}) => {
  const { poolData, tokenPrices, isLoading, refresh } = usePoolData();
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  
  // Debug information
  console.log('Pool data:', poolData);
  console.log('Token prices:', tokenPrices);
  console.log('Loading state:', isLoading);

  const getTokenLogo = (symbol: string) => {
    if (symbol === 'HolyC') return HolyCLogo;
    if (symbol === 'JIT') return JITLogo;
    if (symbol === 'WPLS') return WPLSLogo;
    return '';
  };

  const getLogoClassName = (symbol: string) => {
    return symbol === 'WPLS' ? styles.logoWpls : styles.logo;
  };

  const togglePoolExpansion = (poolId: string) => {
    setExpandedPools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(poolId)) {
        newSet.delete(poolId);
      } else {
        newSet.add(poolId);
      }
      return newSet;
    });
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const getPoolExplanation = (token0: string, token1: string) => {
    if (token0 === 'HolyC' && token1 === 'WPLS') {
      return {
        title: 'Primary HolyC Market',
        content: (
          <>
            <span className={styles.tooltipBlue}>Main trading hub</span> for <span className={styles.tooltipBlue}>HolyC</span> price discovery. Most volume and liquidity flows through this pool.<br/><br/>
            <span className={styles.tooltipGreen}>Arbitrage Target:</span> When this pool's price differs from the compiler's 1:1 rate, arbitrageurs can profit by buying here and converting through the compiler.<br/><br/>
            <span className={styles.tooltipPurple}>Market Role:</span> Sets the baseline <span className={styles.tooltipBlue}>HolyC</span> value that other pools reference for price alignment.
          </>
        )
      };
    }
    if (token0 === 'JIT' && token1 === 'WPLS') {
      return {
        title: 'Independent JIT Market',
        content: (
          <>
            <span className={styles.tooltipAmber}>Separate trading</span> for <span className={styles.tooltipAmber}>JIT</span> tokens with independent price movement based on direct buy/sell pressure.<br/><br/>
            <span className={styles.tooltipRed}>Deflationary Impact:</span> Every <span className={styles.tooltipAmber}>JIT</span> transfer burns 2%, reducing supply and creating upward price pressure over time.<br/><br/>
            <span className={styles.tooltipGreen}>Arbitrage Source:</span> Price differences vs <span className={styles.tooltipBlue}>HolyC</span> create opportunities for profit through compiler conversions.
          </>
        )
      };
    }
    if ((token0 === 'HolyC' && token1 === 'JIT') || (token0 === 'JIT' && token1 === 'HolyC')) {
      return {
        title: 'Direct Arbitrage Pool',
        content: (
          <>
            <span className={styles.tooltipIndigo}>Market-based bridge</span> for direct <span className={styles.tooltipBlue}>HolyC</span>/<span className={styles.tooltipAmber}>JIT</span> trading without using the compiler.<br/><br/>
            <span className={styles.tooltipGreen}>Arbitrage Enabler:</span> Provides liquidity for rebalancing price differences between the external pools without impermanent loss risk.<br/><br/>
            <span className={styles.tooltipPurple}>Volume Driver:</span> Activity here helps correct price inefficiencies and maintains ecosystem balance through natural market forces.
          </>
        )
      };
    }
    return {
      title: 'Liquidity Pool',
      content: 'PulseX V2 liquidity pool for decentralized trading'
    };
  };

  const getTokenColorClass = (symbol: string) => {
    if (symbol === 'HolyC') return styles.tokenHolyC;
    if (symbol === 'JIT') return styles.tokenJIT;
    if (symbol === 'WPLS') return styles.tokenWPLS;
    return '';
  };


  const renderPoolName = (token0: string, token1: string) => {
    return (
      <>
        <span className={getTokenColorClass(token0)}>{token0}</span>
        <span>/</span>
        <span className={getTokenColorClass(token1)}>{token1}</span>
      </>
    );
  };

  return (
    <div className={styles.poolsContainer}>


      <div className={styles.header}>
        <div className={styles.headerActions}>
          <Tooltip 
            content="Refresh stats with a new on-chain fetch" 
            variant="info"
            position="bottom"
          >
            <button onClick={refresh} className={styles.refreshButton} disabled={isLoading} aria-label="Refresh pools">
              <img src={RefreshIcon} alt="Refresh" className={`${styles.refreshIcon} ${isLoading ? styles.loadingIcon : ''}`} />
            </button>
          </Tooltip>
        </div>
        <Tooltip 
          content="The main 3 pools for HolyC and JIT token trading" 
          variant="info"
          position="bottom"
        >
          <h2 className={styles.title}>PulseX V2 Pools</h2>
        </Tooltip>
      </div>
      <div className={`${styles.poolsGrid} ${isLoading ? styles.loading : ''}`}>
        {poolData.length === 0 && !isLoading ? (
          <>
            {['HolyC-WPLS', 'JIT-WPLS', 'HolyC-JIT'].map((poolType, index) => {
              const [token0, token1] = poolType.split('-');
              const poolId = `placeholder-${poolType}`;
              const poolExplanation = getPoolExplanation(token0, token1);
              
              return (
                <div key={index} className={styles.poolCard}>
                  <div className={styles.poolNameAndLogos}>
                    <h3 className={styles.poolName}>{renderPoolName(token0, token1)}</h3>
                    <div className={styles.poolLogos}>
                      <img src={getTokenLogo(token0)} alt={`${token0} logo`} className={getLogoClassName(token0)} />
                      <img src={getTokenLogo(token1)} alt={`${token1} logo`} className={getLogoClassName(token1)} />
                    </div>
                  </div>
                  <div className={styles.poolInfo}>
                    <div className={styles.tokenAmounts}>
                      <p className={styles.poolLiquidity}>
                        {token0}: <span>Pool not found</span>
                      </p>
                      <p className={styles.poolLiquidity}>
                        {token1}: <span>Check console for details</span>
                      </p>
                    </div>
                    <div className={styles.poolAddress}>
                      <span className={styles.addressText}>No address available</span>
                      <button 
                        className={styles.copyButton}
                        disabled
                        title="No address to copy"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                      <div 
                        className={`${styles.expandIcon} ${expandedPools.has(poolId) ? styles.expanded : ''}`}
                        onClick={() => togglePoolExpansion(poolId)}
                      >
                        ▼
                      </div>
                    </div>
                    <div className={`${styles.expandableContent} ${expandedPools.has(poolId) ? styles.expanded : ''}`}>
                      <div className={styles.explanationText}>
                        <h4 className={styles.explanationTitle}>{poolExplanation.title}</h4>
                        {poolExplanation.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          poolData.map((pool, index) => {
            const isHolyJitPool = pool.token0.symbol === 'HolyC' && pool.token1.symbol === 'JIT';
            
            if (isHolyJitPool) {
              // Calculate ratio for HolyC/JIT pool that sums to 2
              const holycAmount = Number(pool.token0.amount);
              const jitAmount = Number(pool.token1.amount);
              const totalAmount = holycAmount + jitAmount;
              const holycRatio = (holycAmount / totalAmount) * 2;
              const jitRatio = (jitAmount / totalAmount) * 2;
              const ratioDisplay = `${holycRatio.toFixed(2)}:${jitRatio.toFixed(2)}`;
              const poolId = `${pool.token0.symbol}-${pool.token1.symbol}-${index}`;
              const poolExplanation = getPoolExplanation(pool.token0.symbol, pool.token1.symbol);
              
              return (
                <div key={index} className={styles.poolCard}>
                  <div className={styles.poolNameAndLogos}>
                    <h3 className={styles.poolName}>{renderPoolName(pool.token0.symbol, pool.token1.symbol)}</h3>
                    <div className={styles.poolLogos}>
                      <img src={getTokenLogo(pool.token0.symbol)} alt={`${pool.token0.symbol} logo`} className={getLogoClassName(pool.token0.symbol)} />
                      <img src={getTokenLogo(pool.token1.symbol)} alt={`${pool.token1.symbol} logo`} className={getLogoClassName(pool.token1.symbol)} />
                    </div>
                  </div>
                  <div className={styles.poolInfo}>
                    <div className={styles.tokenAmounts}>
                      <p className={styles.poolLiquidity}>
                        {pool.token0.symbol}: <span>{formatTokenAmount(pool.token0.amount)}</span>
                      </p>
                      <p className={styles.poolLiquidity}>
                        {pool.token1.symbol}: <span>{formatTokenAmount(pool.token1.amount)}</span>
                      </p>
                    </div>
                    <div className={styles.poolMetrics}>
                      <p className={styles.poolValue}>
                        Ratio: <span>{ratioDisplay}</span>
                      </p>
                    </div>
                    <div className={styles.poolAddress}>
                      <span className={styles.addressText}>{formatAddress(pool.pairAddress)}</span>
                      <button 
                        className={`${styles.copyButton} ${copiedAddress === pool.pairAddress ? styles.copied : ''}`}
                        onClick={() => handleCopyAddress(pool.pairAddress)}
                        title="Copy pair address"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                      <div 
                        className={`${styles.expandIcon} ${expandedPools.has(poolId) ? styles.expanded : ''}`}
                        onClick={() => togglePoolExpansion(poolId)}
                      >
                        ▼
                      </div>
                    </div>
                    <div className={`${styles.expandableContent} ${expandedPools.has(poolId) ? styles.expanded : ''}`}>
                      <div className={styles.explanationText}>
                        <h4 className={styles.explanationTitle}>{poolExplanation.title}</h4>
                        {poolExplanation.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            } else {
              // Regular pool display with liquidity
              const poolId = `${pool.token0.symbol}-${pool.token1.symbol}-${index}`;
              const poolExplanation = getPoolExplanation(pool.token0.symbol, pool.token1.symbol);
              
              return (
                <div key={index} className={styles.poolCard}>
                  <div className={styles.poolNameAndLogos}>
                    <h3 className={styles.poolName}>{renderPoolName(pool.token0.symbol, pool.token1.symbol)}</h3>
                    <div className={styles.poolLogos}>
                      <img src={getTokenLogo(pool.token0.symbol)} alt={`${pool.token0.symbol} logo`} className={getLogoClassName(pool.token0.symbol)} />
                      <img src={getTokenLogo(pool.token1.symbol)} alt={`${pool.token1.symbol} logo`} className={getLogoClassName(pool.token1.symbol)} />
                    </div>
                  </div>
                  <div className={styles.poolInfo}>
                    <div className={styles.tokenAmounts}>
                      <p className={styles.poolLiquidity}>
                        {pool.token0.symbol}: <span>{formatTokenAmount(pool.token0.amount)}</span>
                      </p>
                      <p className={styles.poolLiquidity}>
                        {pool.token1.symbol}: <span>{formatTokenAmount(pool.token1.amount)}</span>
                      </p>
                    </div>
                    <div className={styles.poolMetrics}>
                      <p className={styles.poolValue}>
                        Liquidity: <span>{formatCurrency(pool.liquidityUSD)}</span>
                      </p>
                    </div>
                    <div className={styles.poolAddress}>
                      <span className={styles.addressText}>{formatAddress(pool.pairAddress)}</span>
                      <button 
                        className={`${styles.copyButton} ${copiedAddress === pool.pairAddress ? styles.copied : ''}`}
                        onClick={() => handleCopyAddress(pool.pairAddress)}
                        title="Copy pair address"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                      <div 
                        className={`${styles.expandIcon} ${expandedPools.has(poolId) ? styles.expanded : ''}`}
                        onClick={() => togglePoolExpansion(poolId)}
                      >
                        ▼
                      </div>
                    </div>
                    <div className={`${styles.expandableContent} ${expandedPools.has(poolId) ? styles.expanded : ''}`}>
                      <div className={styles.explanationText}>
                        <h4 className={styles.explanationTitle}>{poolExplanation.title}</h4>
                        {poolExplanation.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
      
      {/* Copy Feedback */}
      {copiedAddress && (
        <div className={styles.copyFeedback}>
          <div className={styles.copyFeedbackContent}>
            ✓ Pair Address Copied!
          </div>
        </div>
      )}
    </div>
  );
};