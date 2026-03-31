import GasoilReportPanel from '../../components/GasoilReportPanel';

export default function ProductsData() {
  return (
    <div className="max-w-4xl space-y-2">
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Products Data</p>
        <h1 className="text-text-primary font-semibold text-base">ICE LS Gasoil — Daily Settlement Analysis</h1>
        <p className="text-text-dim text-xs mt-1">
          Download the daily PDF from ice.com after ~18:00 London · Report: ICE Futures Europe Futures (Report 10)
        </p>
      </div>

      <GasoilReportPanel />
    </div>
  );
}
