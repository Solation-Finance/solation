import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAssetsByStrategy } from '../utils/assetConfig';
import { Strategy, AssetSymbol } from '../types';

export const EarnPage: React.FC = () => {
  const [activeStrategy, setActiveStrategy] = useState<Strategy>('covered-call');
  const navigate = useNavigate();

  const filteredAssets = useMemo(() => getAssetsByStrategy(activeStrategy), [activeStrategy]);

  const handleAssetClick = (assetSymbol: AssetSymbol) => {
    navigate(`/trade/${assetSymbol}?strategy=${activeStrategy}`);
  };

  return (
    <div className="min-h-screen bg-retro-beige py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Earn Premium</h1>
          <p className="text-retro-gray-600">
            Choose your strategy and asset to start earning upfront premiums
          </p>
        </div>

        {/* Strategy Tabs */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setActiveStrategy('covered-call')}
            className={`px-6 py-3 rounded-retro border-2 border-retro-black font-medium transition-all ${
              activeStrategy === 'covered-call'
                ? 'bg-retro-green text-white shadow-retro'
                : 'bg-white text-retro-black hover:shadow-retro'
            }`}
          >
            Covered Call
          </button>
          <button
            onClick={() => setActiveStrategy('cash-secured-put')}
            className={`px-6 py-3 rounded-retro border-2 border-retro-black font-medium transition-all ${
              activeStrategy === 'cash-secured-put'
                ? 'bg-retro-green text-white shadow-retro'
                : 'bg-white text-retro-black hover:shadow-retro'
            }`}
          >
            Cash Secured Puts
          </button>
        </div>

        {/* Asset List */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Select Asset</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssets.map((asset) => (
              <button
                key={asset.symbol}
                onClick={() => handleAssetClick(asset.symbol)}
                className="card hover:shadow-retro-lg transform hover:-translate-y-1 transition-all duration-200 text-left"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <img src={asset.logo} alt={asset.name} className="w-12 h-12 rounded-full" />
                    <div>
                      <h3 className="font-bold text-xl">{asset.symbol}</h3>
                      <p className="text-retro-gray-600 text-sm">{asset.name}</p>
                    </div>
                  </div>
                </div>
                <div className="border-t-2 border-retro-gray-200 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-retro-gray-600 text-sm">Current Price</span>
                    <span className="font-bold text-lg">${asset.price.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-retro-green text-sm font-medium">
                    APR: {(8 + Math.random() * 12).toFixed(2)}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
