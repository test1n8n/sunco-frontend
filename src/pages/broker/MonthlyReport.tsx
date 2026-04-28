import PeriodReport from '../../components/PeriodReport';

export default function MonthlyReport() {
  return (
    <PeriodReport
      windowKind="monthly"
      pageTitle="Monthly Report"
      subtitle="Full calendar month rollup of biodiesel trades and ICE settlements. Published the first Monday of the new month."
    />
  );
}
