import PeriodReport from '../../components/PeriodReport';

export default function WeeklyReport() {
  return (
    <PeriodReport
      windowKind="weekly"
      pageTitle="Weekly Report"
      subtitle="Mon–Fri rollup of biodiesel trades and ICE settlements. Published each Monday for the previous trading week."
    />
  );
}
