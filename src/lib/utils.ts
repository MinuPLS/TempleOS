import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatUnits } from "viem";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatTokenAmount = (amount: string | number, decimals: number = 4) => {
  const number = Number(amount);
  if (isNaN(number)) return "0.00";
  
  // For large numbers (>= 1 billion), show in abbreviated form
  if (number >= 1000000000) {
    return (number / 1000000000).toFixed(0) + "B";
  }
  // For millions
  if (number >= 1000000) {
    return (number / 1000000).toFixed(1) + "M";
  }
  // For thousands
  if (number >= 1000) {
    return (number / 1000).toFixed(1) + "K";
  }
  
  return number.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatCurrency = (amount: string | number, currency: string = "USD") => {
  const number = Number(amount);
  if (isNaN(number)) return "$0.00";
  
  // Show more decimal places for crypto tokens - use high precision for small values
  let decimals = 2;
  if (number < 0.000001) decimals = 12;
  else if (number < 0.00001) decimals = 11;
  else if (number < 0.0001) decimals = 10;
  else if (number < 0.001) decimals = 9;
  else if (number < 0.01) decimals = 8;
  else if (number < 0.1) decimals = 6;
  else if (number < 1) decimals = 4;
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number);
};

export const formatAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatBigIntTokenAmount = (bn: bigint, decimalsShown = 0) =>
  Number(formatUnits(bn, 18)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimalsShown,
  });