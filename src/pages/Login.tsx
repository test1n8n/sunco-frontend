import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  const handleBrokerLogin = () => {
    localStorage.setItem('role', 'broker');
    void navigate('/broker');
  };

  const handleClientLogin = () => {
    localStorage.setItem('role', 'client');
    void navigate('/client');
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col">
      {/* Navy header */}
      <header className="bg-navy px-6 py-4">
        <div className="text-white font-bold text-xl">🌿 SUNCO BROKERS</div>
        <div className="text-blue-300 text-xs mt-0.5">Biofuels Intelligence Platform</div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-navy text-center mb-2">
            Welcome to Sunco Brokers Intelligence Platform
          </h2>
          <p className="text-gray-500 text-sm text-center mb-8">
            Geneva-based biofuels derivatives intelligence
          </p>

          <div className="space-y-4">
            <button
              onClick={handleBrokerLogin}
              className="w-full bg-navy text-white font-semibold py-3.5 px-6 rounded-lg hover:bg-navy-light transition-colors text-base"
            >
              🏢 Broker Login
            </button>
            <button
              onClick={handleClientLogin}
              className="w-full border-2 border-navy text-navy font-semibold py-3.5 px-6 rounded-lg hover:bg-navy hover:text-white transition-colors text-base"
            >
              👤 Client Login
            </button>
          </div>

          <p className="text-gray-400 text-xs text-center mt-8">
            &copy; {new Date().getFullYear()} Sunco Brokers SA — All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
