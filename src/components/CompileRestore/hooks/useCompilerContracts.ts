import { useReadContract } from 'wagmi'
import { JIT_ADDRESS, HOLY_C_ADDRESS, JIT_ABI, HOLYC_ABI } from '../../../config/contracts'

export function useCompilerContracts(address?: `0x${string}`) {
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: HOLYC_ABI,
    address: HOLY_C_ADDRESS,
    functionName: 'allowance',
    args: address ? [address, JIT_ADDRESS] : undefined,
  })

  const { data: compileRestoreFee } = useReadContract({
    abi: JIT_ABI,
    address: JIT_ADDRESS,
    functionName: 'compileRestoreFee',
  })

  const { data: transferFee } = useReadContract({
    abi: JIT_ABI,
    address: JIT_ADDRESS,
    functionName: 'transferFee',
  })

  const { data: isUserFeeExempt } = useReadContract({
    abi: JIT_ABI,
    address: JIT_ADDRESS,
    functionName: 'feeExempt',
    args: address ? [address] : undefined,
  })

  return {
    allowance,
    compileRestoreFee,
    transferFee,
    isUserFeeExempt,
    refetchAllowance,
  }
}