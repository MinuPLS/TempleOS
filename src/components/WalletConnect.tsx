import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Tooltip } from './Tooltip';

type WalletConnectProps = {
  compact?: boolean;
};

export function WalletConnect({ compact = false }: WalletConnectProps) {
  return (
    <div className="wallet-connect-wrapper">
      <Tooltip 
        content="Connect your wallet safely using RainbowKit library" 
        variant="info"
        position="bottom"
      >
        <ConnectButton
          accountStatus={{ smallScreen: 'avatar', largeScreen: 'address' }}
          chainStatus={{ smallScreen: 'none', largeScreen: 'icon' }}
          label={compact ? 'Connect' : 'Connect Wallet'}
          showBalance={false}
        />
      </Tooltip>
    </div>
  );
}
