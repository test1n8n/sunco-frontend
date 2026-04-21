import ProductReportPanel from './ProductReportPanel';

interface Props {
  reportDate?: string;
  readOnly?: boolean;
  prominentTitle?: boolean;
}

export default function GasoilReportPanel({ readOnly = false, prominentTitle = false }: Props) {
  return (
    <ProductReportPanel
      productCode="G"
      productName="ICE LS Gasoil"
      accentColor="#6366f1"
      dropZoneLabel="Drop ICE LS Gasoil PDF here, or click to select"
      readOnly={readOnly}
      prominentTitle={prominentTitle}
    />
  );
}
