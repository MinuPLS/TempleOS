import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rabbyWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { defineChain } from 'viem';

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
      http: ['https://rpc.pulsechain.com'],
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