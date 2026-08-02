import assert from 'node:assert/strict'
import test from 'node:test'
import { chunkRecords, groupFeederLoops } from '../src/archive-publisher.js'

test('creates bounded chunks and preserves record order', () => {
  const records = Array.from({ length: 53 }, (_, index) => index)
  const chunks = chunkRecords(records)
  assert.deepEqual(chunks.map((chunk) => chunk.length), [25, 25, 3])
  assert.deepEqual(chunks.flat(), records)
})

test('groups a Feeder compile/swap/compile loop using normalized string amounts', () => {
  const transaction = (hash, nonce, kind, blockNumber, amountIn, amountOut, extra = {}) => ({
    hash,
    nonce,
    kind,
    route: null,
    blockNumber: String(blockNumber),
    timestamp: blockNumber * 1_000,
    amountIn: String(amountIn),
    amountOut: String(amountOut),
    tokenInSymbol: kind === 'swap' ? 'JIT' : 'HOLYC',
    tokenOutSymbol: kind === 'swap' ? 'HOLYC' : 'JIT',
    directHolyBurned: '0',
    compilerFeeEquivalentHolyc: '1',
    jitTransferTaxBurned: '0',
    jitRestorePrincipalBurned: '0',
    effectiveHolyContribution: '1',
    ...extra,
  })
  const result = groupFeederLoops([
    transaction('0xcompile-1', 1, 'compile', 100, 100, 99),
    transaction('0xswap', 2, 'swap', 101, 50, 60, { route: 'hc-start-jit-gain', tokenInSymbol: 'JIT', tokenOutSymbol: 'HOLYC' }),
    transaction('0xcompile-2', 3, 'compile', 102, 130, 129),
  ], new Set())

  assert.equal(result.length, 1)
  assert.equal(result[0].transactionHash, '0xswap')
  assert.equal(result[0].netTokenAmount, '30')
  assert.equal(result[0].effectiveHolyBurned, '3')
  assert.equal(result[0].settlement.status, 'none')
  assert.equal(result[0].steps.length, 3)
})
