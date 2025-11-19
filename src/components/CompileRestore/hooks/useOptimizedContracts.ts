import { useReadContracts } from 'wagmi'
import { JIT_ADDRESS, HOLY_C_ADDRESS, JIT_ABI, HOLYC_ABI } from '../../../config/contracts'

export function useOptimizedContracts(address?: `0x${string}`) {
  // Batch all contract reads into a single call for better performance
  const contracts = [
    {
      abi: HOLYC_ABI,
      address: HOLY_C_ADDRESS,
      functionName: 'allowance',
      args: address ? ([address, JIT_ADDRESS] as const) : undefined,
    },
    {
      abi: JIT_ABI,
      address: JIT_ADDRESS,
      functionName: 'compileRestoreFee',
    },
    {
      abi: JIT_ABI,
      address: JIT_ADDRESS,
      functionName: 'transferFee',
    },
    {
      abi: JIT_ABI,
      address: JIT_ADDRESS,
      functionName: 'feeExempt',
      args: address ? ([address] as const) : undefined,
    },
  ] as const

  const { data, refetch, isLoading, error } = useReadContracts({
    contracts,
    // Add stale time to reduce unnecessary refetches
    query: {
      staleTime: 30000, // 30 seconds
      gcTime: 300000, // 5 minutes
    },
  })

  return {
    allowance: data?.[0]?.result,
    compileRestoreFee: data?.[1]?.result,
    transferFee: data?.[2]?.result,
    isUserFeeExempt: data?.[3]?.result,
    refetchAllowance: refetch,
    isLoading,
    error,
  }
}
