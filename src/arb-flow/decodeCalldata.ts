import { decodeAbiParameters, slice, getAddress, isHex } from 'viem'
import {
  AOT_EXEMPT_ABI_PARAMETERS,
  AOT_EXEMPT_FUNDED_ABI_PARAMETERS,
  AOT_EXECUTE_EXEMPT_FUNDED_SELECTOR,
  AOT_EXECUTE_EXEMPT_SELECTOR,
  AOT_EXECUTE_PLAIN_FUNDED_SELECTOR,
  AOT_EXECUTE_PLAIN_SELECTOR,
  AOT_PLAIN_FUNDED_ABI_PARAMETERS,
  BYTES_ABI_PARAMETERS,
  EXECUTE_SELECTOR,
  ExecutionTicket,
  LEG_COMPILE,
  LEG_RESTORE,
  LEG_SWAP_EXACT,
  LEG_SWAP_SUPPORTING_FOT,
  TicketLeg,
  TICKET_ABI_PARAMETERS,
} from './abi'

export interface DecodedCalldata {
  ticket: ExecutionTicket | null
  isExecuteCall: boolean
  warning?: string
}

const normalizeLegKey = (key: number): TicketLeg['key'] | null => {
  switch (key) {
    case LEG_COMPILE:
    case LEG_RESTORE:
    case LEG_SWAP_SUPPORTING_FOT:
    case LEG_SWAP_EXACT:
      return key
    default:
      return null
  }
}

const normalizePath = (path: readonly string[]): readonly string[] =>
  path.map((p) => getAddress(p))

const extractTicketPayload = (input: `0x${string}`, selector: string): `0x${string}` | null => {
  const encodedArgs = slice(input, 4)

  if (selector === EXECUTE_SELECTOR || selector === AOT_EXECUTE_PLAIN_SELECTOR) {
    return decodeAbiParameters(BYTES_ABI_PARAMETERS, encodedArgs)[0]
  }

  if (selector === AOT_EXECUTE_EXEMPT_SELECTOR) {
    return decodeAbiParameters(AOT_EXEMPT_ABI_PARAMETERS, encodedArgs)[1]
  }

  if (selector === AOT_EXECUTE_PLAIN_FUNDED_SELECTOR) {
    return decodeAbiParameters(AOT_PLAIN_FUNDED_ABI_PARAMETERS, encodedArgs)[1]
  }

  if (selector === AOT_EXECUTE_EXEMPT_FUNDED_SELECTOR) {
    return decodeAbiParameters(AOT_EXEMPT_FUNDED_ABI_PARAMETERS, encodedArgs)[2]
  }

  return null
}

export const decodeExecuteCalldata = (input: string): DecodedCalldata => {
  if (!isHex(input) || input.length < 10) {
    return { ticket: null, isExecuteCall: false, warning: 'empty or non-hex input' }
  }

  const selector = input.slice(0, 10).toLowerCase()

  try {
    const payload = extractTicketPayload(input, selector)
    if (!payload) {
      return { ticket: null, isExecuteCall: false, warning: `selector ${selector} is not a manager execution` }
    }
    const raw = decodeAbiParameters(TICKET_ABI_PARAMETERS, payload)[0]

    const legs: TicketLeg[] = []
    for (const leg of raw.legs as readonly {
      key: number
      path: readonly string[]
      amountIn: bigint
      amountOutMin: bigint
    }[]) {
      const key = normalizeLegKey(leg.key)
      if (key === null) {
        legs.push({
          key: LEG_SWAP_EXACT,
          path: normalizePath(leg.path),
          amountIn: leg.amountIn,
          amountOutMin: leg.amountOutMin,
        })
        continue
      }
      legs.push({
        key,
        path: normalizePath(leg.path),
        amountIn: leg.amountIn,
        amountOutMin: leg.amountOutMin,
      })
    }

    const ticket: ExecutionTicket = {
      strategyId: raw.strategyId,
      targetAsset: raw.targetAsset as ExecutionTicket['targetAsset'],
      minProfitWPLS: raw.minProfitWPLS,
      deadline: raw.deadline,
      basefeeCap: raw.basefeeCap,
      policyHash: raw.policyHash,
      legs,
      finalGuard: {
        asset: raw.finalGuard.asset as ExecutionTicket['finalGuard']['asset'],
        minAmount: raw.finalGuard.minAmount,
      },
      binding: {
        blockNumberObserved: raw.binding.blockNumberObserved,
        pairs: (raw.binding.pairs as readonly {
          pair: string
          reserve0: bigint
          reserve1: bigint
        }[]).map((p) => ({
          pair: getAddress(p.pair),
          reserve0: p.reserve0,
          reserve1: p.reserve1,
        })),
        reservesToleranceBps: raw.binding.reservesToleranceBps,
        policyHash: raw.binding.policyHash,
      },
      burn: {
        owedHolyC: raw.burn.owedHolyC,
        owedJIT: raw.burn.owedJIT,
      },
      jobNonce: raw.jobNonce,
    }

    return { ticket, isExecuteCall: true }
  } catch (err) {
    return {
      ticket: null,
      isExecuteCall: true,
      warning: err instanceof Error ? `calldata decode failed: ${err.message}` : 'calldata decode failed',
    }
  }
}
