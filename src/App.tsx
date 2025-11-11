import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WalletContextProvider } from './context/WalletContextProvider';
import { Header } from './components/Header';
import { EarnPage } from './pages/EarnPage';
import { TradingPage } from './pages/TradingPage';
import { DashboardPage } from './pages/DashboardPage';

function App() {
  return (
    <WalletContextProvider>
      <Router>
        <div className="min-h-screen bg-retro-beige">
          <Header />
          <Routes>
            <Route path="/" element={<Navigate to="/earn" replace />} />
            <Route path="/earn" element={<EarnPage />} />
            <Route path="/trade/:assetSymbol" element={<TradingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </div>
      </Router>
    </WalletContextProvider>
  );
}

export default App;
