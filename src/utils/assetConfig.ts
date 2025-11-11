import { Asset, AssetSymbol, StrikePrice, ExpirationDate } from '../types';

export const ASSETS: Record<AssetSymbol, Asset> = {
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    price: 165.42,
    decimals: 9,
  },
  JUPSOL: {
    symbol: 'JUPSOL',
    name: 'Jupiter Staked SOL',
    logo: 'https://coin-images.coingecko.com/coins/images/37482/large/jupsol.png?1714473916',
    price: 172.15,
    decimals: 9,
  },
  JITOSOL: {
    symbol: 'JITOSOL',
    name: 'Jito Staked SOL',
    logo: 'https://storage.googleapis.com/token-metadata/JitoSOL-256.png',
    price: 173.88,
    decimals: 9,
  },
  cbBTC: {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    logo: 'https://zengo.com/wp-content/uploads/cbBTC-1.png',
    price: 89245.67,
    decimals: 8,
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    logo: 'https://cdn.freebiesupply.com/logos/thumbs/2x/ethereum-1-logo.png',
    price: 3128.94,
    decimals: 18,
  },
  mSOL: {
    symbol: 'mSOL',
    name: 'Marinade Staked SOL',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/200x200/11461.png',
    price: 168.75,
    decimals: 9,
  },
};

export const generateStrikePrices = (
  currentPrice: number,
  strategy: 'covered-call' | 'cash-secured-put'
): StrikePrice[] => {
  const multipliers = strategy === 'covered-call'
    ? [1.05, 1.10, 1.15, 1.20]
    : [0.95, 0.90, 0.85, 0.80];

  return multipliers.map((multiplier, index) => {
    const strikePrice = currentPrice * multiplier;
    const baseApr = 8 + (index * 4); // Base APR from 8% to 20%
    const premium = (strikePrice * baseApr) / (100 * 52); // Weekly premium

    return {
      price: Math.round(strikePrice),
      apr: baseApr + Math.random() * 2, // Add some variance
      premium: Math.round(premium * 100) / 100,
    };
  });
};

export const generateExpirationDates = (): ExpirationDate[] => {
  const dates: ExpirationDate[] = [];
  const now = new Date();

  // Generate expiration dates for 7 days and 28 days
  const dayIntervals = [7, 28];

  dayIntervals.forEach((days) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);

    dates.push({
      date: date.toISOString().split('T')[0],
      daysUntil: days,
      timestamp: date.getTime(),
    });
  });

  return dates;
};

export const formatCurrency = (amount: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

export const formatNumber = (num: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatPercentage = (percent: number): string => {
  return `${percent.toFixed(2)}%`;
};

export const getAssetsByStrategy = (strategy: 'covered-call' | 'cash-secured-put'): Asset[] => {
  if (strategy === 'cash-secured-put') {
    // Only SOL and mSOL for cash secured put
    return [ASSETS.SOL, ASSETS.mSOL];
  }
  // All assets except mSOL for covered call
  return [ASSETS.SOL, ASSETS.JUPSOL, ASSETS.JITOSOL, ASSETS.cbBTC, ASSETS.ETH];
};
