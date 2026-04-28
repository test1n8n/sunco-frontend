import PeriodReport from '../../components/PeriodReport';

export default function BiweeklyReport() {
  return (
    <PeriodReport
      windowKind="biweekly"
      pageTitle="Biweekly Report"
      subtitle="Two-week rollup of biodiesel trades and ICE settlements. Published every other Monday (even ISO weeks)."
    />
  );
}
