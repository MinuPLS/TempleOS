import { useReadContracts } from 'wagmi'
import { JIT_ABI, JIT_ADDRESS } from '@/config/contracts'

const DEFAULT_COMPILE_FEE = 4000n
const DEFAULT_TRANSFER_FEE = 2000n

export const useProtocolFees = () => {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
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
    ],
    query: {
      staleTime: 60_000,
      gcTime: 300_000,
    },
  })

  const compileRestoreFee = (data?.[0]?.result as bigint | undefined) ?? DEFAULT_COMPILE_FEE
  const transferFee = (data?.[1]?.result as bigint | undefined) ?? DEFAULT_TRANSFER_FEE

  return {
    compileRestoreFee,
    transferFee,
    isLoading,
    refetch,
  }
}
