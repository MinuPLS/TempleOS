import { useState, useEffect, useCallback, useRef } from 'react';
import { getPublicClient } from '@wagmi/core';
import { config, pulseChain } from '@/config/wagmi';
import {
  ERC20_ABI,
  HOLY_C_ADDRESS,
  JIT_ADDRESS,
  CONTRACT_ADDRESSES,
  HOLYC_INITIAL_SUPPLY,
  UNISWAP_V2_PAIR_ABI,
  HOLYC_WPLS_PAIR_ADDRESS
} from '@/config/contracts';

export interface TokenStats {
  holycLocked: bigint;
  jitCirculating: bigint;
  holycFeesBurned: bigint;
  permanentlyLockedHolyC: bigint;
  removedTotalHolyC: bigint;
  circulatingHolyC: bigint;
  holycLockedAsLP: bigint;
}

export const useTokenStats = () => {
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    holycLocked: 0n,
    jitCirculating: 0n,
    holycFeesBurned: 0n,
    permanentlyLockedHolyC: 0n,
    removedTotalHolyC: 0n,
    circulatingHolyC: 0n,
    holycLockedAsLP: 0n,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchTokenStats = useCallback(async (options?: { manual?: boolean }) => {
    const manual = options?.manual === true;
    const shouldShowLoading = manual || !hasLoadedRef.current;

    if (shouldShowLoading) {
      setIsLoading(true);
      setError(null);
    }
    
    try {
      console.log('Fetching token stats...');
      const publicClient = getPublicClient(config, { chainId: pulseChain.id });
      if (!publicClient) throw new Error('Public client not available');

      // Fetch all data in parallel
      const [
        holyCLocked,
        jitSupply,
        holyCBurned,
        lpTotalSupply,
        lpBurnBalance,
        reserves,
        token0,
      ] = await Promise.all([
        // HolyC locked in JIT contract
        publicClient.readContract({
          address: HOLY_C_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [JIT_ADDRESS],
        }),
        // JIT circulating supply
        publicClient.readContract({
          address: JIT_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'totalSupply',
        }),
        // Total burned HolyC (balance of burn address)
        publicClient.readContract({
          address: HOLY_C_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [CONTRACT_ADDRESSES.burn],
        }),
        // LP token total supply
        publicClient.readContract({
          address: HOLYC_WPLS_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'totalSupply',
        }),
        // LP tokens held by burn address
        publicClient.readContract({
          address: HOLYC_WPLS_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'balanceOf',
          args: ['0x0000000000000000000000000000000000000000'],
        }),
        // Get reserves
        publicClient.readContract({
          address: HOLYC_WPLS_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'getReserves',
        }),
        // Get token0 address
        publicClient.readContract({
          address: HOLYC_WPLS_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'token0',
        }),
      ]);

      // Calculate HolyC locked as LP
      let holycLockedAsLP = 0n;
      if (lpTotalSupply > 0n) {
        // Determine which token is HolyC
        const isToken0HolyC = token0.toLowerCase() === HOLY_C_ADDRESS.toLowerCase();
        const holycReserve = isToken0HolyC ? reserves[0] : reserves[1];
        
        // Calculate burn wallet's share of the pool
        const shareBurned = (lpBurnBalance * 10n ** 18n) / lpTotalSupply;
        
        // Calculate HolyC locked as LP by burn wallet
        holycLockedAsLP = (holycReserve * shareBurned) / (10n ** 18n);
      }

      const permaLockedHolyC  = holyCLocked - jitSupply;               // BigInt
      const removedTotalHolyC = permaLockedHolyC + holyCBurned + holycLockedAsLP;  // Include LP locked for circulating calc
      const circulatingHolyC  = HOLYC_INITIAL_SUPPLY - removedTotalHolyC;

      setTokenStats({
        holycLocked:            holyCLocked,
        jitCirculating:         jitSupply,
        holycFeesBurned:        holyCBurned,
        permanentlyLockedHolyC: permaLockedHolyC,
        removedTotalHolyC:      removedTotalHolyC,
        circulatingHolyC:       circulatingHolyC,
        holycLockedAsLP:        holycLockedAsLP,
      });
      setError(null);
      hasLoadedRef.current = true;

    } catch (error) {
      console.error('Error fetching token stats:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      if (shouldShowLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchTokenStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTokenStats, 30000);
    return () => clearInterval(interval);
  }, [fetchTokenStats]);

  return { tokenStats, isLoading, error, refresh: fetchTokenStats };
};
