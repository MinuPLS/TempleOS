export const HOLY_C_ADDRESS = '0x6c8fdfd2CeC0b83d69045074d57A87Fa1525225A' as const;
export const JIT_ADDRESS = '0x57909025ACE10D5dE114d96E3EC84F282895870c' as const;
export const WPLS_ADDRESS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27' as const;
export const DAI_ADDRESS = '0xefD766cCb38EaF1dfd701853BFCe31359239F305' as const;

export const PULSEX_ROUTER_ADDRESS = '0x165C3410fC91EF562C50559f7d2289fEbed552d9' as const;
export const UNISWAP_V2_FACTORY_ADDRESS = '0x1715a3E4A142d8b698131108995174F37aEBA10D' as const;
export const WPLS_DAI_PAIR_ADDRESS = '0xE56043671df55dE5CDf8459710433C10324DE0aE' as const;

// Actual pair addresses
export const HOLYC_WPLS_PAIR_ADDRESS = '0x28be4ad6d58ab4aacea3cb42bde457b7da251bac' as const;
export const HOLYC_JIT_PAIR_ADDRESS = '0x7fa560cbe6d7c0d6d408b3fd9e59137d3324c76e' as const;
export const JIT_WPLS_PAIR_ADDRESS = '0xc68a84655fa4ef48f8dd5273821183216da4de37' as const;
export const DIVINE_MANAGER_ADDRESS = '0x50DF180Ea29a7872b54C5EC5241d4b889E4DEBF0' as const;
export const AOT_RELAYER_ADDRESS = '0x9E39d3c00A49AA244A62740f7209D4C133b5780c' as const;
export const FEEDER_BOT_ADDRESS = '0x01f04AD75bc557ed6072E870278B99f40Fd75b2d' as const;
export const FEEDER_SETTLEMENT_DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;
export const FEEDER_PARTNER_ADDRESS = '0x4D5B84cC20D991803bDf0bd1f53E72A9435Ce21a' as const;

export const BRIAH_BUY_AND_BURN_ADDRESS = '0x7DA770d10B6a62Fc9DC5A9682bDF2849d2b617d4' as const;
export const BRIAH_TOKEN_ADDRESS = '0xA80736067abDc215a3b6B66a57c6e608654d0C9a' as const;
export const COINMAFIA_BUY_AND_BURN_ADDRESS = '0xbC289B8a84ACf05d1aA9Ec72cdf5F22dE4bb3A39' as const;
export const COINMAFIA_TOKEN_ADDRESS = '0x562866b6483894240739211049E109312E9A9A67' as const;
export const DUMB_BUY_AND_BURN_ADDRESS = '0x3AdC613625D5c2668c921821d91b602c36c7F401' as const;
export const DUMB_TOKEN_ADDRESS = '0xe65112d2f120c8cb23ADC80D8E8122c0c8b7fF8D' as const;
export const FUPA_BUY_AND_BURN_ADDRESS = '0x12F715fc5e9e62fBe816D1f15b66bf1C85c1A38a' as const;
export const FUPA_TOKEN_ADDRESS = '0xB41cEb0d0316e6c330b2Dd982779a4030C8FeDeB' as const;

export const CONTRACT_ADDRESSES = {
  holyC: HOLY_C_ADDRESS,
  jit: JIT_ADDRESS,
  wpls: WPLS_ADDRESS,
  dai: DAI_ADDRESS,
  pulsexRouter: PULSEX_ROUTER_ADDRESS,
  uniswapV2Factory: UNISWAP_V2_FACTORY_ADDRESS,
  wplsDaiPair: WPLS_DAI_PAIR_ADDRESS,
  burn: '0x0000000000000000000000000000000000000369' as const,
  divineManager: DIVINE_MANAGER_ADDRESS,
  aotRelayer: AOT_RELAYER_ADDRESS,
  feederBot: FEEDER_BOT_ADDRESS,
} as const

export const CHAIN_ID = 369 // Chain 369

export const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{ "name": "", "type": "string" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "name": "", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{ "name": "_from", "type": "address" }, { "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }],
    "name": "transferFrom",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }],
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }, { "name": "_spender", "type": "address" }],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const UNISWAP_V2_FACTORY_ABI = [
  {
    "type": "function",
    "name": "getPair",
    "stateMutability": "view",
    "inputs": [
      { "type": "address", "name": "tokenA" },
      { "type": "address", "name": "tokenB" }
    ],
    "outputs": [{ "type": "address", "name": "pair" }]
  }
] as const;

export const UNISWAP_V2_PAIR_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "getReserves",
    "outputs": [
      { "internalType": "uint112", "name": "_reserve0", "type": "uint112" },
      { "internalType": "uint112", "name": "_reserve1", "type": "uint112" },
      { "internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32" }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "name": "", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "token0",
    "outputs": [{ "name": "", "type": "address" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "token1",
    "outputs": [{ "name": "", "type": "address" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const JIT_ABI = [
  {
    name: 'compile',
    type: 'function',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'restore',
    type: 'function',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address'
      }
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    stateMutability: 'view'
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address'
      },
      {
        name: 'spender',
        type: 'address',
        internalType: 'address'
      }
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    stateMutability: 'view'
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address'
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool'
      }
    ],
    stateMutability: 'nonpayable'
  },
  {
    name: 'compileRestoreFee',
    type: 'function',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    stateMutability: 'view'
  },
  {
    name: 'transferFee',
    type: 'function',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    stateMutability: 'view'
  },
  {
    name: 'feeExempt',
    type: 'function',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address'
      }
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool'
      }
    ],
    stateMutability: 'view'
  }
] as const

export const HOLYC_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address'
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool'
      }
    ],
    stateMutability: 'nonpayable'
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address'
      },
      {
        name: 'spender',
        type: 'address',
        internalType: 'address'
      }
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    stateMutability: 'view'
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address'
      }
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256'
      }
    ],
    stateMutability: 'view'
  }
] as const

export const DIVINE_MANAGER_ABI = [
  {
    type: 'function',
    name: 'splitDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address', name: '' }],
  },
  {
    type: 'function',
    name: 'splitBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16', name: '' }],
  },
  {
    type: 'function',
    name: 'HOLYC',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address', name: '' }],
  },
  {
    type: 'function',
    name: 'JIT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address', name: '' }],
  },
  {
    type: 'function',
    name: 'WPLS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address', name: '' }],
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'strategyId', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'jobNonce', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'profitWPLS', type: 'uint256' },
    ],
    name: 'TicketExecuted',
    type: 'event',
  },
] as const

// NEW – absolute mint at deployment (1 B tokens, 18 decimals)
export const HOLYC_INITIAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
