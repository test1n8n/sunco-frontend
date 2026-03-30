export default function ErrorBanner() {
  return (
    <div className="w-full bg-accent/5 border border-accent/30 text-accent px-4 py-3 rounded flex items-center gap-2 mb-4">
      <span className="font-bold text-sm">!</span>
      <span className="text-sm font-medium">
        Data unavailable — please refresh or contact support
      </span>
    </div>
  );
}
