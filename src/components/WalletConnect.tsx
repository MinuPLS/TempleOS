import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Tooltip } from './Tooltip';

export function WalletConnect() {
  return (
    <div className="wallet-connect-wrapper">
      <Tooltip 
        content="Connect your wallet safely using RainbowKit library" 
        variant="info"
        position="bottom"
      >
        <ConnectButton showBalance={false} chainStatus="icon" />
      </Tooltip>
    </div>
  );
}