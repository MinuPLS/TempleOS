import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rabbyWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { defineChain, fallback, http } from 'viem';

// The official RPC stays first so happy-path behaviour is unchanged. The
// remaining endpoints are only consulted when an earlier one fails (rank:false),
// adding redundancy for the heavy on-chain activity scans without altering the
// primary read path.
const PULSECHAIN_RPC_URLS = [
  'https://rpc.pulsechain.com',
  'https://rpc-pulsechain.g4mm4.io',
  'https://pulsechain-rpc.publicnode.com',
];

export const pulseChain = defineChain({
  id: 369,
  name: 'PulseChain',
  nativeCurrency: {
    decimals: 18,
    name: 'Pulse',
    symbol: 'PLS',
  },
  rpcUrls: {
    default: {
      http: PULSECHAIN_RPC_URLS,
    },
  },
  blockExplorers: {
    default: { 
      name: 'PulseScan', 
      url: 'https://scan.pulsechain.com' 
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 17034870,
    },
  },
});

export const config = getDefaultConfig({
  appName: 'TempleOS Frontend',
  projectId: import.meta.env.VITE_PROJECT_ID,
  chains: [pulseChain],
  transports: {
    [pulseChain.id]: fallback(
      PULSECHAIN_RPC_URLS.map((url) => http(url)),
      { rank: false }
    ),
  },
  wallets: [
    {
      groupName: 'Suggested',
      wallets: [
        metaMaskWallet,
        rabbyWallet
      ],
    },
  ],
  ssr: false,
  multiInjectedProviderDiscovery: false,
});