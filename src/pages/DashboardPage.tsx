import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Position, IncomeData, DashboardMetrics } from '../types';
import { formatCurrency, ASSETS } from '../utils/assetConfig';
import { getProgram } from '../anchor/setup';
import { fetchUserPositions } from '../services/positions';
import { canSettlePosition, settlePosition } from '../services/settlement';
import { SOL_MINT, USDC_MINT } from '../config/constants';

// Mock data for demonstration
const generateMockPositions = (): Position[] => {
  return [
    {
      id: '1',
      asset: 'SOL',
      strategy: 'covered-call',
      amount: 10,
      strikePrice: 175,
      expirationDate: '2025-11-18',
      premiumEarned: 45.23,
      status: 'active',
      createdAt: '2025-11-04',
    },
    {
      id: '2',
      asset: 'ETH',
      strategy: 'cash-secured-put',
      amount: 2,
      strikePrice: 2950,
      expirationDate: '2025-11-25',
      premiumEarned: 112.5,
      status: 'active',
      createdAt: '2025-11-03',
    },
    {
      id: '3',
      asset: 'cbBTC',
      strategy: 'covered-call',
      amount: 0.5,
      strikePrice: 91000,
      expirationDate: '2025-11-11',
      premiumEarned: 234.67,
      status: 'expired',
      createdAt: '2025-10-28',
    },
  ];
};

const generateMockIncomeData = (): IncomeData[] => {
  const data: IncomeData[] = [];
  const today = new Date();

  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    data.push({
      date: date.toISOString().split('T')[0],
      amount: 100 + Math.random() * 500,
    });
  }

  return data;
};

export const DashboardPage: React.FC = () => {
  const { connected, publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();

  const [blockchainPositions, setBlockchainPositions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettling, setIsSettling] = useState<string | null>(null);

  // Fetch positions from blockchain
  useEffect(() => {
    const loadPositions = async () => {
      if (!connected || !publicKey) {
        setBlockchainPositions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const program = getProgram(connection, {
          publicKey,
          signTransaction: async (tx) => {
            if (signTransaction) return await signTransaction(tx);
            throw new Error('Wallet does not support transaction signing');
          },
          signAllTransactions: async (txs) => {
            if (signAllTransactions) return await signAllTransactions(txs);
            throw new Error('Wallet does not support transaction signing');
          },
        });

        const userPositions = await fetchUserPositions(program, publicKey);
        console.log('Fetched positions:', userPositions);
        setBlockchainPositions(userPositions);
      } catch (error) {
        console.error('Error loading positions:', error);
        setBlockchainPositions([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPositions();
  }, [connected, publicKey, connection, signTransaction, signAllTransactions]);

  // Handle settlement
  const handleSettle = async (position: any) => {
    if (!connected || !publicKey || !signTransaction || !signAllTransactions) {
      alert('Please connect your wallet');
      return;
    }

    setIsSettling(position.publicKey.toBase58());

    try {
      const program = getProgram(connection, { publicKey, signTransaction, signAllTransactions });

      const canSettle = await canSettlePosition(program, position.publicKey);
      if (!canSettle) {
        alert('Position cannot be settled yet or is already settled.');
        setIsSettling(null);
        return;
      }

      const positionAccount = position.account;
      const tx = await settlePosition({
        program,
        userPublicKey: publicKey,
        positionPublicKey: position.publicKey,
        assetMint: positionAccount.assetMint,
        quoteMint: positionAccount.quoteMint,
        positionId: positionAccount.positionId,
      });

      alert(`✅ Position settled! TX: ${tx.slice(0, 8)}...${tx.slice(-8)}`);

      const userPositions = await fetchUserPositions(program, publicKey);
      setBlockchainPositions(userPositions);
    } catch (error: any) {
      console.error('Error settling:', error);
      alert(`❌ Failed to settle: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSettling(null);
    }
  };

  // Convert blockchain positions to display format
  const positions: Position[] = useMemo(() => {
    return blockchainPositions.map((p) => {
      const account = p.account;
      const assetMintStr = account.assetMint.toBase58();
      const asset = assetMintStr === SOL_MINT.toBase58() ? 'SOL' : 'USDC';
      const strategy = account.strategy.coveredCall !== undefined ? 'covered-call' : 'cash-secured-put';
      const amount = account.contractSize.toNumber() / LAMPORTS_PER_SOL;
      const strikePrice = account.strikePrice.toNumber() / 100000000;
      const premiumEarned = account.premiumPaid.toNumber() / 1_000_000;
      const expirationDate = new Date(account.expiryTimestamp.toNumber() * 1000).toLocaleDateString();
      const createdAt = new Date(account.createdAt.toNumber() * 1000).toLocaleDateString();

      let status = 'active';
      if (account.status.settledItm !== undefined) status = 'exercised';
      else if (account.status.settledOtm !== undefined || account.status.settledAtm !== undefined) status = 'expired';

      return {
        id: p.publicKey.toBase58(),
        asset,
        strategy,
        amount,
        strikePrice,
        expirationDate,
        premiumEarned,
        status,
        createdAt,
        _raw: p, // Store raw data for settlement
      };
    });
  }, [blockchainPositions]);

  // Use mock data if no blockchain positions
  const [mockPositions] = useState<Position[]>(generateMockPositions());
  const [mockIncomeData] = useState<IncomeData[]>(generateMockIncomeData());

  const displayPositions = positions.length > 0 ? positions : mockPositions;
  const incomeData = positions.length > 0
    ? positions.map((p) => ({
        date: p.createdAt,
        amount: p.premiumEarned,
      }))
    : mockIncomeData;

  const metrics: DashboardMetrics = useMemo(() => {
    const activePositions = displayPositions.filter((p) => p.status === 'active').length;
    const totalEarnings = displayPositions.reduce((sum, p) => sum + p.premiumEarned, 0);
    const realizedProfits = displayPositions
      .filter((p) => p.status === 'expired')
      .reduce((sum, p) => sum + p.premiumEarned, 0);

    return {
      totalIncome: incomeData.reduce((sum, d) => sum + d.amount, 0),
      activePositions,
      totalEarnings,
      realizedProfits,
    };
  }, [displayPositions, incomeData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-retro-green';
      case 'expired':
        return 'text-retro-gray-500';
      case 'exercised':
        return 'text-retro-black';
      default:
        return 'text-retro-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-retro-green text-white',
      expired: 'bg-retro-gray-300 text-retro-gray-700',
      exercised: 'bg-retro-black text-white',
    };

    return (
      <span
        className={`px-3 py-1 rounded-retro text-xs font-medium ${
          colors[status as keyof typeof colors]
        }`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-retro-beige flex items-center justify-center">
        <div className="card text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-retro-gray-600 mb-6">
            Please connect your wallet to view your dashboard and positions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-retro-beige py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-retro-gray-600">Track your positions and earnings</p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left Panel: Metrics */}
          <div>
            <div className="card mb-6 bg-retro-green text-white">
              <h2 className="text-sm font-medium mb-2 opacity-90">TOTAL INCOME</h2>
              <div className="text-4xl font-bold mb-4">
                {formatCurrency(metrics.totalIncome)}
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
                <div>
                  <div className="text-xs opacity-75 mb-1">Active Positions</div>
                  <div className="text-xl font-bold">{metrics.activePositions}</div>
                </div>
                <div>
                  <div className="text-xs opacity-75 mb-1">Total Earnings</div>
                  <div className="text-xl font-bold">
                    {formatCurrency(metrics.totalEarnings, 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs opacity-75 mb-1">Realized Profits</div>
                  <div className="text-xl font-bold">
                    {formatCurrency(metrics.realizedProfits, 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <h3 className="text-sm text-retro-gray-600 mb-1">Avg APR</h3>
                <div className="text-2xl font-bold text-retro-green">12.45%</div>
              </div>
              <div className="card">
                <h3 className="text-sm text-retro-gray-600 mb-1">Success Rate</h3>
                <div className="text-2xl font-bold text-retro-green">87.5%</div>
              </div>
            </div>
          </div>

          {/* Right Panel: Income Chart */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Income Over Time</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={incomeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fontFamily: 'DM Mono' }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12, fontFamily: 'DM Mono' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '2px solid #0A0A0A',
                    borderRadius: '2px',
                    fontFamily: 'DM Mono',
                  }}
                  formatter={(value: number) => [`${formatCurrency(value)}`, 'Income']}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#00D084"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Positions Table */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6">Current Positions</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-retro-black">
                  <th className="text-left py-3 px-4 font-bold">Asset</th>
                  <th className="text-left py-3 px-4 font-bold">Strategy</th>
                  <th className="text-right py-3 px-4 font-bold">Amount</th>
                  <th className="text-right py-3 px-4 font-bold">Strike</th>
                  <th className="text-left py-3 px-4 font-bold">Expiration</th>
                  <th className="text-right py-3 px-4 font-bold">Premium</th>
                  <th className="text-center py-3 px-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-retro-gray-600">
                      Loading positions...
                    </td>
                  </tr>
                ) : (
                  displayPositions.map((position: any) => {
                    const canSettle = position.status === 'active' &&
                      new Date(position.expirationDate) < new Date();
                    const isSettlingThis = isSettling === position.id;

                    return (
                      <tr
                        key={position.id}
                        className="border-b border-retro-gray-200 hover:bg-retro-gray-100 transition-colors"
                      >
                        <td className="py-4 px-4 font-medium">{position.asset}</td>
                        <td className="py-4 px-4 text-sm capitalize">
                          {position.strategy.replace('-', ' ')}
                        </td>
                        <td className="py-4 px-4 text-right">{position.amount.toFixed(4)}</td>
                        <td className="py-4 px-4 text-right">
                          {formatCurrency(position.strikePrice)}
                        </td>
                        <td className="py-4 px-4 text-sm">{position.expirationDate}</td>
                        <td className="py-4 px-4 text-right font-bold text-retro-green">
                          {formatCurrency(position.premiumEarned)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {getStatusBadge(position.status)}
                            {canSettle && position._raw && (
                              <button
                                onClick={() => handleSettle(position._raw)}
                                disabled={isSettlingThis}
                                className="px-2 py-1 bg-retro-black text-white text-xs rounded-retro hover:bg-retro-gray-700 disabled:opacity-50"
                              >
                                {isSettlingThis ? 'Settling...' : 'Settle'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {displayPositions.length === 0 && !isLoading && (
            <div className="text-center py-12 text-retro-gray-600">
              <p className="text-lg mb-2">No positions yet</p>
              <p className="text-sm">Start earning premiums to see your positions here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
