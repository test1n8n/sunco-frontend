import { useState, useEffect } from 'react';
import type { PricePanel } from '../../types';
import { API_BASE_URL, API_KEY } from '../../config';
import GasoilReportPanel from '../../components/GasoilReportPanel';
import ProductReportPanel from '../../components/ProductReportPanel';
import BiodieselTradesPanel from '../../components/BiodieselTradesPanel';
import PricePanelForm from '../../components/PricePanelForm';
import { BIODIESEL_PRODUCTS } from '../../productConfig';

export default function ProductsData() {
  const [panel, setPanel] = useState<PricePanel | null>(null);
  const [reportDate, setReportDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Load latest price panel on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/price-panel/latest`, {
      headers: { 'X-API-Key': API_KEY },
    })
      .then(r => r.ok ? r.json() : null)
      .then((p: PricePanel | null) => {
        if (p) {
          setPanel(p);
          setReportDate(p.report_date);
        }
      })
      .catch(() => {});
  }, []);

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

      {/* Section 2: Biodiesel product PDFs */}
      {BIODIESEL_PRODUCTS.map((product) => (
        <div key={product.code}>
          <div className="border-t border-border mt-2" />
          <ProductReportPanel
            productCode={product.code}
            productName={`ICE ${product.name} (${product.code})`}
            accentColor={product.color}
            dropZoneLabel={product.dropZoneLabel}
          />
        </div>
      ))}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Section 3: Biodiesel trade screenshots */}
      <BiodieselTradesPanel />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Section 4: Biodiesel diff entry + flat prices */}
      <div>
        <h2 className="text-text-dim font-semibold text-xs uppercase tracking-widest mb-4">
          Biodiesel Settlements
        </h2>
        <PricePanelForm
          panel={panel}
          reportDate={reportDate}
          onDiffsUpdated={setPanel}
        />
      </div>

    </div>
  );
}
