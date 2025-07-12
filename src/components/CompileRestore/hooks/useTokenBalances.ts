import { useBalance } from 'wagmi'
import { JIT_ADDRESS, HOLY_C_ADDRESS } from '../../../config/contracts'

export function useTokenBalances(address?: `0x${string}`) {
  const { data: holyCBalance, refetch: refetchHolyC } = useBalance({
    address,
    token: HOLY_C_ADDRESS,
  })
  
  const { data: jitBalance, refetch: refetchJIT } = useBalance({
    address,
    token: JIT_ADDRESS,
  })

  const refetchBalances = () => {
    refetchHolyC()
    refetchJIT()
  }

  return {
    holyCBalance,
    jitBalance,
    refetchBalances,
  }
}