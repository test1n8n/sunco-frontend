import GasoilReportPanel from '../../components/GasoilReportPanel';
import CombinedProductPanel from '../../components/CombinedProductPanel';
import BiodieselTradesPanel from '../../components/BiodieselTradesPanel';
import DiffRecapChart from '../../components/DiffRecapChart';
import { COMBINED_PRODUCT_GROUPS } from '../../productConfig';

export default function ProductsData() {
  return (
    <div className="max-w-4xl space-y-6">

      {/* Page header */}
      <div className="pb-3 border-b border-border">
        <p className="text-text-dim text-xs tracking-widest uppercase mb-1">Products Data</p>
        <h1 className="text-text-primary font-semibold text-base">ICE Futures — Daily Settlement Analysis</h1>
        <p className="text-text-dim text-xs mt-1">
          Download the daily PDFs from ice.com after ~18:00 London · Report: ICE Futures Europe Futures (Report 10)
        </p>
      </div>

      {/* Section 1: LS Gasoil PDF upload + forward curve + charts */}
      <GasoilReportPanel />

      {/* Section 2: Combined Diff + Flat biodiesel panels */}
      {COMBINED_PRODUCT_GROUPS.map((group) => (
        <div key={group.name}>
          <div className="border-t border-border mt-2" />
          <CombinedProductPanel group={group} />
        </div>
      ))}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Section 3: Daily Recap — Stacked Volume + OI Aggregated */}
      <DiffRecapChart days={90} />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Section 4: Biodiesel trade screenshots */}
      <BiodieselTradesPanel showFlowSnapshot />

    </div>
  );
}
