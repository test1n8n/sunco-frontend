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
    <div className="min-h-screen bg-surface font-sans flex flex-col items-center justify-center p-6">
      {/* Logo / brand */}
      <div className="mb-10 text-center">
        <div className="text-text-primary font-bold text-2xl tracking-widest uppercase mb-1">
          SUNCO BROKERS
        </div>
        <div className="text-text-dim text-xs tracking-widest uppercase">
          Biofuels Intelligence Platform
        </div>
      </div>

      {/* Card */}
      <div className="bg-card border border-border rounded-lg p-8 w-full max-w-sm">
        <h2 className="text-text-primary font-semibold text-sm uppercase tracking-widest text-center mb-1">
          Access Portal
        </h2>
        <p className="text-text-dim text-xs text-center mb-8 tracking-wide">
          Geneva-based biofuels derivatives intelligence
        </p>

        <div className="space-y-3">
          <button
            onClick={handleBrokerLogin}
            className="w-full bg-accent text-surface font-bold py-3 px-6 rounded text-sm tracking-widest uppercase hover:bg-accent-hover transition-colors"
          >
            Broker Login
          </button>
          <button
            onClick={handleClientLogin}
            className="w-full bg-transparent border border-border text-text-secondary font-semibold py-3 px-6 rounded text-sm tracking-widest uppercase hover:border-accent/50 hover:text-text-primary transition-colors"
          >
            Client Login
          </button>
        </div>

        <p className="text-text-dim text-xs text-center mt-8">
          &copy; {new Date().getFullYear()} Sunco Brokers SA
        </p>
      </div>
    </div>
  );
}
