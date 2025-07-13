export interface CompileRestoreMode {
  isCompileMode: boolean;
}

export interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
}

export interface CompilerState {
  isCompileMode: boolean;
  amount: string;
  showBurnAnimation: boolean;
  showModeTransition: boolean;
}

export interface TokenCalculations {
  burnAmount: string;
  holycBurnFee: string;
  lockedAmount: string;
  received: string;
  feePercent: string;
}

export interface ProcessCard {
  type: 'burn' | 'lock' | 'burn-jit' | 'burn-fee';
  amount: string;
  token: string;
}