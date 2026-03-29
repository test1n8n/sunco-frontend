import { useState, useEffect } from 'react';
import type { Report } from '../../types';
import { MOCK_REPORT } from '../../mockData';
import { API_BASE_URL, API_KEY } from '../../config';
import Spinner from '../../components/Spinner';
import BiasBadge from '../../components/BiasBadge';
import { NewsCard, MacroSignalsTable, OutlookCard } from './DailyReport';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

interface ArchiveListItem {
  report_date: string;
  id: string;
}

function ReportView({ report }: { report: Report }) {
  const filteredNews = report.key_news.filter(
    (n) => n.relevance === 'high' || n.relevance === 'medium'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <p className="text-gray-500 text-sm">{formatDate(report.report_date)}</p>
          <div className="flex items-center gap-3 mt-1">
            <BiasBadge bias={report.short_term_outlook.bias} />
            <span className="text-xs text-gray-400">Short-term bias</span>
          </div>
        </div>
      </div>

      {/* Market Summary */}
      <div className="bg-white rounded-lg shadow-sm border-l-4 border-navy p-5">
        <h3 className="text-navy font-semibold text-sm uppercase tracking-wide mb-3">Market Summary</h3>
        <p className="text-gray-800 text-base leading-relaxed">{report.market_summary}</p>
      </div>

      {/* Key News */}
      <div>
        <h3 className="text-navy font-semibold text-sm uppercase tracking-wide mb-3">Key News</h3>
        {filteredNews.length === 0 ? (
          <p className="text-gray-400 text-sm">No high/medium relevance news.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredNews.map((item, idx) => (
              <NewsCard key={idx} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Macro Signals */}
      <div>
        <h3 className="text-navy font-semibold text-sm uppercase tracking-wide mb-3">Macro Signals</h3>
        <MacroSignalsTable signals={report.macro_signals} />
      </div>

      {/* Outlooks */}
      <div>
        <h3 className="text-navy font-semibold text-sm uppercase tracking-wide mb-3">Market Outlook</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <OutlookCard outlook={report.short_term_outlook} />
          <OutlookCard outlook={report.long_term_outlook} />
        </div>
      </div>

      {/* SAF Note */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
        <h3 className="text-navy font-semibold text-sm uppercase tracking-wide mb-2">SAF Note</h3>
        <p className="text-gray-400 text-sm italic">{report.saf_note}</p>
      </div>

      {/* Broker Notes (read-only) */}
      {report.broker_notes && (
        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-100">
          <h3 className="text-navy font-semibold text-sm uppercase tracking-wide mb-2">Broker Notes</h3>
          <p className="text-gray-700 text-sm whitespace-pre-wrap">{report.broker_notes}</p>
        </div>
      )}
    </div>
  );
}

export default function ReportArchive() {
  const [dateList, setDateList] = useState<ArchiveListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const fetchList = async () => {
      setListLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/report/list`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ArchiveListItem[];
        // Sort newest first
        const sorted = [...data].sort((a, b) =>
          b.report_date.localeCompare(a.report_date)
        );
        setDateList(sorted);
      } catch {
        // Show mock as fallback
        setDateList([{ report_date: MOCK_REPORT.report_date, id: MOCK_REPORT.id }]);
      } finally {
        setListLoading(false);
      }
    };
    void fetchList();
  }, []);

  const handleSelectDate = async (date: string) => {
    setReportLoading(true);
    setSelectedReport(null);
    try {
      const res = await fetch(`${API_BASE_URL}/report/${date}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Report;
      setSelectedReport(data);
    } catch {
      if (date === MOCK_REPORT.report_date) {
        setSelectedReport(MOCK_REPORT);
      } else {
        setSelectedReport(null);
      }
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {selectedReport ? (
        <div>
          <button
            onClick={() => setSelectedReport(null)}
            className="flex items-center gap-2 text-navy font-semibold text-sm hover:underline mb-4"
          >
            ← Back to Archive
          </button>
          <ReportView report={selectedReport} />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-navy font-semibold text-base uppercase tracking-wide">Report Archive</h2>
            <p className="text-gray-500 text-sm mt-1">Click on a date to view the full report</p>
          </div>

          {listLoading ? (
            <Spinner />
          ) : dateList.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No archived reports found.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {dateList.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => void handleSelectDate(item.report_date)}
                    disabled={reportLoading}
                    className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-navy transition-colors">
                        {formatDate(item.report_date)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.report_date}</p>
                    </div>
                    <span className="text-accent font-medium text-sm group-hover:underline">
                      View →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {reportLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
          <Spinner />
        </div>
      )}
    </div>
  );
}
