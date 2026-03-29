export default function ErrorBanner() {
  return (
    <div className="w-full bg-amber-50 border border-amber-400 text-amber-800 px-4 py-3 rounded-md flex items-center gap-2 mb-4">
      <span className="text-amber-600 font-bold">⚠</span>
      <span className="text-sm font-medium">
        Data unavailable — please refresh or contact support
      </span>
    </div>
  );
}
