import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  ASSETS,
  generateStrikePrices,
  generateExpirationDates,
  formatCurrency,
  formatPercentage,
  formatNumber,
  getAssetsByStrategy,
} from '../utils/assetConfig';
import { AssetSymbol, Strategy, StrikePrice, ExpirationDate } from '../types';

export const TradingPage: React.FC = () => {
  const { assetSymbol } = useParams<{ assetSymbol: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  const [strategy, setStrategy] = useState<Strategy>(
    (searchParams.get('strategy') as Strategy) || 'covered-call'
  );
  const [selectedDate, setSelectedDate] = useState<ExpirationDate | null>(null);
  const [selectedStrike, setSelectedStrike] = useState<StrikePrice | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [balance, setBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const asset = ASSETS[assetSymbol as AssetSymbol];
  const filteredAssets = useMemo(() => getAssetsByStrategy(strategy), [strategy]);
  const expirationDates = useMemo(() => generateExpirationDates(), []);
  const strikePrices = useMemo(() => {
    if (!asset) return [];
    return generateStrikePrices(asset.price, strategy);
  }, [asset, strategy]);

  useEffect(() => {
    if (expirationDates.length > 0 && !selectedDate) {
      setSelectedDate(expirationDates[0]);
    }
  }, [expirationDates, selectedDate]);

  useEffect(() => {
    if (strikePrices.length > 0 && !selectedStrike) {
      setSelectedStrike(strikePrices[0]);
    }
  }, [strikePrices, selectedStrike]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!connected || !publicKey) {
        setBalance(0);
        return;
      }

      setIsLoadingBalance(true);
      try {
        const bal = await connection.getBalance(publicKey);
        const solBalance = bal / LAMPORTS_PER_SOL;

        // For cash-secured-put, simulate USDC balance (in real app, fetch actual USDC token balance)
        if (strategy === 'cash-secured-put') {
          // Simulate USDC balance as SOL balance * SOL price
          setBalance(solBalance * 165); // Approximate SOL price in USDC
        } else {
          setBalance(solBalance);
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance(0);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [connected, publicKey, connection, strategy]);

  const handleAssetChange = (newAsset: AssetSymbol) => {
    navigate(`/trade/${newAsset}?strategy=${strategy}`);
    setShowAssetDropdown(false);
  };

  const handleStrategyChange = (newStrategy: Strategy) => {
    setStrategy(newStrategy);
    setSelectedStrike(null);
    setShowStrategyDropdown(false);

    // Check if current asset is available in the new strategy
    const availableAssets = getAssetsByStrategy(newStrategy);
    const isAssetAvailable = availableAssets.some(a => a.symbol === assetSymbol);

    if (isAssetAvailable) {
      // Keep current asset
      navigate(`/trade/${assetSymbol}?strategy=${newStrategy}`);
    } else {
      // Switch to first available asset in the new strategy
      navigate(`/trade/${availableAssets[0].symbol}?strategy=${newStrategy}`);
    }
  };

  const handleMaxClick = () => {
    if (balance > 0) {
      if (strategy === 'cash-secured-put') {
        // For cash secured put: max amount = full USDC balance
        setAmount(balance.toFixed(2));
      } else {
        // For covered call: max amount = token balance
        setAmount(balance.toFixed(4));
      }
    }
  };

  const handleEarnPremium = () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (strategy === 'cash-secured-put') {
      if (parseFloat(amount) > balance) {
        alert(`Insufficient USDC balance.`);
        return;
      }
    } else {
      if (parseFloat(amount) > balance) {
        alert('Insufficient balance');
        return;
      }
    }

    // Simulate transaction
    const premiumEarned = strategy === 'cash-secured-put'
      ? (parseFloat(amount) / (selectedStrike?.price || 1)) * (selectedStrike?.premium || 0)
      : parseFloat(amount) * (selectedStrike?.premium || 0);

    alert(
      `Transaction simulated!\n\nYou would earn ${formatCurrency(premiumEarned)} USDC upfront premium.`
    );
  };

  const actionVerb = strategy === 'covered-call' ? 'sell' : 'buy';
  const conditionText =
    strategy === 'covered-call'
      ? `price below $${selectedStrike?.price || 0}`
      : `price above $${selectedStrike?.price || 0}`;
  const outcomeText =
    strategy === 'covered-call'
      ? `keep your ${asset?.symbol} and the premium`
      : `keep the premium without buying`;

  if (!asset) {
    return (
      <div className="min-h-screen bg-retro-beige flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Asset not found</h1>
          <button onClick={() => navigate('/earn')} className="btn-primary">
            Back to Earn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-retro-beige py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <div className="mb-8 flex items-center space-x-2 text-sm">
          <div className="relative">
            <button
              onClick={() => setShowAssetDropdown(!showAssetDropdown)}
              className="px-4 py-2 bg-white border-2 border-retro-black rounded-retro hover:shadow-retro transition-all font-medium flex items-center space-x-2"
            >
              <img src={asset.logo} alt={asset.name} className="w-6 h-6 rounded-full" />
              <span>{asset.symbol} ▼</span>
            </button>
            {showAssetDropdown && (
              <div className="absolute top-full mt-2 w-48 bg-white border-2 border-retro-black rounded-retro shadow-retro-lg z-10">
                {filteredAssets.map((a) => (
                  <button
                    key={a.symbol}
                    onClick={() => handleAssetChange(a.symbol)}
                    className="w-full px-4 py-2 text-left hover:bg-retro-gray-100 flex items-center space-x-2"
                  >
                    <img src={a.logo} alt={a.name} className="w-6 h-6 rounded-full" />
                    <span>{a.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-retro-gray-400">›</span>

          <div className="relative">
            <button
              onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
              className="px-4 py-2 bg-white border-2 border-retro-black rounded-retro hover:shadow-retro transition-all font-medium"
            >
              {strategy === 'covered-call' ? 'Covered Call' : 'Cash Secured Put'} ▼
            </button>
            {showStrategyDropdown && (
              <div className="absolute top-full mt-2 w-56 bg-white border-2 border-retro-black rounded-retro shadow-retro-lg z-10">
                <button
                  onClick={() => handleStrategyChange('covered-call')}
                  className="w-full px-4 py-2 text-left hover:bg-retro-gray-100"
                >
                  Covered Call
                </button>
                <button
                  onClick={() => handleStrategyChange('cash-secured-put')}
                  className="w-full px-4 py-2 text-left hover:bg-retro-gray-100"
                >
                  Cash Secured Put
                </button>
              </div>
            )}
          </div>

          <span className="text-retro-gray-400">›</span>

          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="px-4 py-2 bg-white border-2 border-retro-black rounded-retro hover:shadow-retro transition-all font-medium"
            >
              {selectedDate?.date || 'Select Date'} ({selectedDate?.daysUntil || 0}d) ▼
            </button>
            {showDateDropdown && (
              <div className="absolute top-full mt-2 w-56 bg-white border-2 border-retro-black rounded-retro shadow-retro-lg z-10">
                {expirationDates.map((date) => (
                  <button
                    key={date.timestamp}
                    onClick={() => {
                      setSelectedDate(date);
                      setShowDateDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-retro-gray-100"
                  >
                    {date.date} ({date.daysUntil} days)
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Choose the price at which you are happy to {actionVerb} {asset.symbol} on{' '}
            {selectedDate?.date || '...'} (in {selectedDate?.daysUntil || 0} days)
          </h1>
          <p className="text-retro-gray-600">
            Current price: {formatCurrency(asset.price)}
          </p>
        </div>

        {/* Strike Price Selection */}
        <div className="card mb-6">
          <h3 className="font-bold mb-4">Select Strike Price</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {strikePrices.map((strike, index) => (
              <button
                key={index}
                onClick={() => setSelectedStrike(strike)}
                className={`p-4 rounded-retro border-2 border-retro-black transition-all ${
                  selectedStrike?.price === strike.price
                    ? 'bg-retro-green text-white shadow-retro'
                    : 'bg-white hover:shadow-retro'
                }`}
              >
                <div className="text-2xl font-bold mb-2">{formatCurrency(strike.price)}</div>
                <div className="text-sm">APR: {formatPercentage(strike.apr)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* User Input Section */}
        <div className="card mb-6">
          <h3 className="font-bold mb-4">Enter Amount</h3>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input pr-20"
              step="0.0001"
              min="0"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
              {strategy === 'cash-secured-put' ? (
                <>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/USD_Coin_logo_%28cropped%29.png/1195px-USD_Coin_logo_%28cropped%29.png" alt="USDC" className="w-6 h-6 rounded-full" />
                  <span className="font-bold">USDC</span>
                </>
              ) : (
                <>
                  <img src={asset.logo} alt={asset.name} className="w-6 h-6 rounded-full" />
                  <span className="font-bold">{asset.symbol}</span>
                </>
              )}
            </div>
          </div>
          <div className="mt-2 flex justify-between items-center text-sm">
            <div className="text-retro-gray-600">
              {strategy === 'cash-secured-put' ? (
                <>Balance: {isLoadingBalance ? '...' : formatNumber(balance, 2)} USDC</>
              ) : (
                <>Balance: {isLoadingBalance ? '...' : formatNumber(balance, 4)} {asset.symbol}</>
              )}
            </div>
            <button
              onClick={handleMaxClick}
              className="px-3 py-1 bg-retro-gray-200 hover:bg-retro-gray-300 rounded-retro font-medium transition-colors"
            >
              MAX
            </button>
          </div>
          {strategy === 'cash-secured-put' && selectedStrike && amount && parseFloat(amount) > 0 && (
            <div className="mt-3 p-3 bg-retro-beige rounded-retro text-sm">
              <div className="text-retro-gray-600">
                You will receive: <span className="font-bold text-retro-black">{formatNumber(parseFloat(amount) / selectedStrike.price, 4)} {asset.symbol}</span>
              </div>
              <div className="text-xs text-retro-gray-500 mt-1">
                Buying at strike price of ${selectedStrike.price}
              </div>
            </div>
          )}
        </div>

        {/* Summary Section */}
        {selectedStrike && (
          <div className="card mb-6 bg-retro-cream">
            <h3 className="font-bold mb-4">Summary</h3>

            {/* Now section - show upfront premium */}
            <div className="mb-4 pb-4 border-b-2 border-retro-gray-300">
              <span className="font-bold text-retro-green">Now:</span> APR{' '}
              {formatPercentage(selectedStrike.apr)},{' '}
              {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? (
                <>
                  {strategy === 'cash-secured-put'
                    ? formatCurrency((parseFloat(amount) / selectedStrike.price) * selectedStrike.premium)
                    : formatCurrency(parseFloat(amount) * selectedStrike.premium)
                  } USDC upfront premium
                </>
              ) : (
                <span className="text-retro-gray-600">Enter amount to see premium</span>
              )}
            </div>

            {/* On expiration - left/right scenarios */}
            <div>
              <div className="font-bold mb-3">On {selectedDate?.date}:</div>
              <div className="grid grid-cols-2 gap-4">
                {/* Left side - favorable scenario */}
                <div className="bg-white p-4 rounded-retro border-2 border-retro-black">
                  <div className="text-sm">
                    {strategy === 'covered-call' ? (
                      <>
                        <div className="font-medium mb-2">If price below ${selectedStrike.price}</div>
                        <div className="text-retro-gray-600">
                          Keep the premium without selling your {asset?.symbol}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium mb-2">If price above ${selectedStrike.price}</div>
                        <div className="text-retro-gray-600">
                          Keep the premium without buying
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Right side - unfavorable scenario with USDC calculation */}
                <div className="bg-white p-4 rounded-retro border-2 border-retro-black">
                  <div className="text-sm">
                    {strategy === 'covered-call' ? (
                      <>
                        <div className="font-medium mb-2">If price above ${selectedStrike.price}</div>
                        <div className="text-retro-gray-600">
                          {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? (
                            <>Receive {formatCurrency(parseFloat(amount) * selectedStrike.price)} USDC</>
                          ) : (
                            <>Receive USDC based on amount</>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium mb-2">If price below ${selectedStrike.price}</div>
                        <div className="text-retro-gray-600">
                          {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? (
                            <>Buy {formatNumber(parseFloat(amount) / selectedStrike.price, 4)} {asset?.symbol} for {formatCurrency(parseFloat(amount))} USDC</>
                          ) : (
                            <>Buy {asset?.symbol} at strike price</>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleEarnPremium}
          disabled={
            !connected ||
            !amount ||
            parseFloat(amount) <= 0 ||
            !selectedStrike ||
            parseFloat(amount) > balance
          }
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connected ? 'Earn upfront premium now' : 'Connect wallet to continue'}
        </button>
      </div>
    </div>
  );
};
