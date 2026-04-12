import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Overview from './pages/broker/Overview';
import DailyReport from './pages/broker/DailyReport';
import Mandates from './pages/broker/Mandates';
import TradeBlotter from './pages/broker/TradeBlotter';
import PositionsPnL from './pages/broker/PositionsPnL';
import Counterparties from './pages/broker/Counterparties';
import Alerts from './pages/broker/Alerts';
import Spreads from './pages/broker/Spreads';
import History from './pages/broker/History';
import Subscriptions from './pages/broker/Subscriptions';
import ReportArchive from './pages/broker/ReportArchive';
import Charts from './pages/broker/Charts';
import BiofuelsAI from './pages/broker/BiofuelsAI';
import ProductsData from './pages/broker/ProductsData';
import ResearchEngine from './pages/broker/ResearchEngine';
import QuantResearch from './pages/broker/QuantResearch';
import AltData from './pages/broker/AltData';
import Forecasting from './pages/broker/Forecasting';
import FeedstockSupply from './pages/broker/FeedstockSupply';
import Layout, { CLIENT_NAV } from './components/Layout';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: 'broker' | 'client';
}

function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const role = localStorage.getItem('role');
  if (!role || role !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* ── Broker routes ─────────────────────────────────────────── */}
        <Route
          path="/broker"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Market Overview">
                <Overview />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/daily"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Daily Report">
                <DailyReport role="broker" />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/mandates"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Mandates">
                <Mandates />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/blotter"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Trade Blotter">
                <TradeBlotter />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/pnl"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Positions & P&L">
                <PositionsPnL />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/counterparties"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Counterparties">
                <Counterparties />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/alerts"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Alerts">
                <Alerts />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/spreads"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Spreads">
                <Spreads />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/history"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="History">
                <History />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/subscriptions"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Subscriptions">
                <Subscriptions />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/archive"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Report Archive">
                <ReportArchive />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/products"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Products Data">
                <ProductsData />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/charts"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Market Charts">
                <Charts />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/ai"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Biofuels AI">
                <BiofuelsAI />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/research"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Research Engine">
                <ResearchEngine />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/quant"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Quantitative Research">
                <QuantResearch />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/alt-data"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Alternative Data">
                <AltData />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/forecasting"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Forecasting">
                <Forecasting />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/broker/feedstock"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Feedstock & Trade">
                <FeedstockSupply />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Client routes (same components, no broker-only features) ── */}
        <Route
          path="/client"
          element={
            <ProtectedRoute requiredRole="client">
              <Layout pageTitle="Daily Report" navLinks={CLIENT_NAV}>
                <DailyReport role="client" />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/charts"
          element={
            <ProtectedRoute requiredRole="client">
              <Layout pageTitle="Market Charts" navLinks={CLIENT_NAV}>
                <Charts />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/archive"
          element={
            <ProtectedRoute requiredRole="client">
              <Layout pageTitle="Report Archive" navLinks={CLIENT_NAV}>
                <ReportArchive />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/ai"
          element={
            <ProtectedRoute requiredRole="client">
              <Layout pageTitle="Biofuels AI" navLinks={CLIENT_NAV}>
                <BiofuelsAI />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
