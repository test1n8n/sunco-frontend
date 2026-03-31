import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DailyReport from './pages/broker/DailyReport';
import TradeBlotter from './pages/broker/TradeBlotter';
import ReportArchive from './pages/broker/ReportArchive';
import Charts from './pages/broker/Charts';
import BiofuelsAI from './pages/broker/BiofuelsAI';
import ClientReport from './pages/client/ClientReport';
import Layout from './components/Layout';

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

        <Route
          path="/broker"
          element={
            <ProtectedRoute requiredRole="broker">
              <Layout pageTitle="Daily Report">
                <DailyReport />
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
          path="/client"
          element={
            <ProtectedRoute requiredRole="client">
              <ClientReport />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
