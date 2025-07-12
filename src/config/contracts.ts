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

export const CONTRACT_ADDRESSES = {
  holyC: HOLY_C_ADDRESS,
  jit: JIT_ADDRESS,
  wpls: WPLS_ADDRESS,
  dai: DAI_ADDRESS,
  pulsexRouter: PULSEX_ROUTER_ADDRESS,
  uniswapV2Factory: UNISWAP_V2_FACTORY_ADDRESS,
  wplsDaiPair: WPLS_DAI_PAIR_ADDRESS,
  burn: '0x0000000000000000000000000000000000000369' as const,
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

// NEW – absolute mint at deployment (1 B tokens, 18 decimals)
export const HOLYC_INITIAL_SUPPLY = 1_000_000_000n * 10n ** 18n;