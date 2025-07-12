import { useState, useEffect, useCallback } from 'react';
import { formatUnits } from 'viem';
import { getPublicClient } from '@wagmi/core';
import { config, pulseChain } from '@/config/wagmi';
import {
  UNISWAP_V2_PAIR_ABI,
  WPLS_DAI_PAIR_ADDRESS,
  HOLYC_WPLS_PAIR_ADDRESS,
  HOLYC_JIT_PAIR_ADDRESS,
  JIT_WPLS_PAIR_ADDRESS
} from '@/config/contracts';

interface PoolData {
  pairAddress: `0x${string}`;
  liquidityUSD: string;
  token0: {
    symbol: string;
    amount: string;
  };
  token1: {
    symbol: string;
    amount: string;
  };
}

interface TokenPrices {
  holycUSD: number;
  jitUSD: number;
}

export const usePoolData = () => {
  const [poolData, setPoolData] = useState<PoolData[]>([]);
  const [tokenPrices, setTokenPrices] = useState<TokenPrices>({ holycUSD: 0, jitUSD: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('Starting pool data fetch...');
      const publicClient = getPublicClient(config, { chainId: pulseChain.id });
      if (!publicClient) throw new Error('Public client not available');

      // Use hardcoded pair addresses
      const holycWplsPair = HOLYC_WPLS_PAIR_ADDRESS;
      const jitWplsPair = JIT_WPLS_PAIR_ADDRESS;
      const holyJitPair = HOLYC_JIT_PAIR_ADDRESS;
      
      console.log('Using hardcoded pair addresses:', { holycWplsPair, jitWplsPair, holyJitPair });

      // Get Reserves for all pairs including WPLS/DAI
      let wplsDaiReserves: readonly [bigint, bigint, number];
      let holycWplsReserves: readonly [bigint, bigint, number];
      let jitWplsReserves: readonly [bigint, bigint, number];
      let holyJitReserves: readonly [bigint, bigint, number];

      try {
        // Try multicall first
        const pairContracts = [WPLS_DAI_PAIR_ADDRESS, holycWplsPair, jitWplsPair, holyJitPair].map(address => ({
          address,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'getReserves',
        }));

        const reservesResults = await publicClient.multicall({ contracts: pairContracts });
        if (reservesResults.some(r => r.status !== 'success')) {
          throw new Error('Could not fetch all pair reserves.');
        }
        
        [wplsDaiReserves, holycWplsReserves, jitWplsReserves, holyJitReserves] = reservesResults.map(r => r.result as readonly [bigint, bigint, number]);
      } catch (multicallError) {
        console.log('Multicall failed, using individual calls:', multicallError);
        
        // Fallback to individual calls
        const [wplsDaiRes, holycWplsRes, jitWplsRes, holyJitRes] = await Promise.all([
          publicClient.readContract({
            address: WPLS_DAI_PAIR_ADDRESS,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'getReserves',
          }),
          publicClient.readContract({
            address: holycWplsPair,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'getReserves',
          }),
          publicClient.readContract({
            address: jitWplsPair,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'getReserves',
          }),
          publicClient.readContract({
            address: holyJitPair,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'getReserves',
          }),
        ]);

        wplsDaiReserves = wplsDaiRes as readonly [bigint, bigint, number];
        holycWplsReserves = holycWplsRes as readonly [bigint, bigint, number];
        jitWplsReserves = jitWplsRes as readonly [bigint, bigint, number];
        holyJitReserves = holyJitRes as readonly [bigint, bigint, number];
      }

      // 3. Precise Calculations using BigInt
      // Use a large precision factor to maintain accuracy during division
      const PRECISION_FACTOR = 10n ** 18n;

      // WPLS/DAI pair: Get WPLS price in USD (DAI = $1)
      // Price = DAI_reserves / WPLS_reserves
      const wplsPriceInUsdBigInt = (wplsDaiReserves[1] * PRECISION_FACTOR) / wplsDaiReserves[0];
      
      // HolyC/WPLS pair: Get HolyC price in USD
      // Price = (WPLS_reserves * WPLS_price) / HolyC_reserves
      // Note: wplsPriceInUsdBigInt already contains PRECISION_FACTOR, so no additional multiplication needed
      const holycPriceInUsdBigInt = (holycWplsReserves[1] * wplsPriceInUsdBigInt) / holycWplsReserves[0];

      // JIT/WPLS pair: Get JIT price in USD
      // Price = (WPLS_reserves * WPLS_price) / JIT_reserves
      // Note: wplsPriceInUsdBigInt already contains PRECISION_FACTOR, so no additional multiplication needed
      const jitPriceInUsdBigInt = (jitWplsReserves[1] * wplsPriceInUsdBigInt) / jitWplsReserves[0];

      setTokenPrices({ 
        holycUSD: Number(formatUnits(holycPriceInUsdBigInt, 18)), 
        jitUSD: Number(formatUnits(jitPriceInUsdBigInt, 18)) 
      });

      // Calculate liquidity USD values with precise BigInt arithmetic
      // Since both price BigInts contain PRECISION_FACTOR, we need to divide by it to get the actual USD value
      const holycLiquidityUsdBigInt = (holycWplsReserves[0] * holycPriceInUsdBigInt) / PRECISION_FACTOR + 
                                      (holycWplsReserves[1] * wplsPriceInUsdBigInt) / PRECISION_FACTOR;
      const jitLiquidityUsdBigInt = (jitWplsReserves[0] * jitPriceInUsdBigInt) / PRECISION_FACTOR + 
                                    (jitWplsReserves[1] * wplsPriceInUsdBigInt) / PRECISION_FACTOR;
      const holyJitLiquidityUsdBigInt = (holyJitReserves[1] * holycPriceInUsdBigInt) / PRECISION_FACTOR + 
                                        (holyJitReserves[0] * jitPriceInUsdBigInt) / PRECISION_FACTOR;

      const newPoolData = [
        {
          pairAddress: holycWplsPair,
          liquidityUSD: Number(formatUnits(holycLiquidityUsdBigInt, 18)).toFixed(2),
          token0: { symbol: 'HolyC', amount: formatUnits(holycWplsReserves[0], 18) },
          token1: { symbol: 'WPLS', amount: formatUnits(holycWplsReserves[1], 18) },
        },
        {
          pairAddress: jitWplsPair,
          liquidityUSD: Number(formatUnits(jitLiquidityUsdBigInt, 18)).toFixed(2),
          token0: { symbol: 'JIT', amount: formatUnits(jitWplsReserves[0], 18) },
          token1: { symbol: 'WPLS', amount: formatUnits(jitWplsReserves[1], 18) },
        },
        {
          pairAddress: holyJitPair,
          liquidityUSD: Number(formatUnits(holyJitLiquidityUsdBigInt, 18)).toFixed(2),
          token0: { symbol: 'HolyC', amount: formatUnits(holyJitReserves[1], 18) },
          token1: { symbol: 'JIT', amount: formatUnits(holyJitReserves[0], 18) },
        },
      ];
      setPoolData(newPoolData);

    } catch (error) {
      console.error("Error fetching pool data:", error);
      console.error("Error details:", error instanceof Error ? error.message : 'Unknown error');
      setPoolData([]); // Clear data on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 1 minute auto-refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  return { poolData, tokenPrices, isLoading, refresh: fetchData };
};