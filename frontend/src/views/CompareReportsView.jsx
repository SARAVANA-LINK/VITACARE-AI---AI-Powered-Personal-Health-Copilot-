import React, { useState, useEffect } from 'react';
import { GitCompare, ArrowRight, TrendingUp, TrendingDown, Minus, Info, AlertCircle, Volume2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation } from '../i18n/LanguageContext';
import { useAccessibility } from '../context/AccessibilityContext';

export const CompareReportsView = ({ onBackToReports }) => {
  const { t, language } = useTranslation();
  const { speak } = useAccessibility();
  const [reports, setReports] = useState([]);
  const [rep1Id, setRep1Id] = useState('');
  const [rep2Id, setRep2Id] = useState('');
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadReports();
  }, [language]);

  const loadReports = async () => {
    try {
      const res = await api.getReports();
      const list = res.reports || [];
      setReports(list);

      // Auto-select latest two reports if available
      if (list.length >= 2) {
        setRep1Id(list[1].id);
        setRep2Id(list[0].id);
        fetchComparison(list[1].id, list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchComparison = async (id1, id2) => {
    if (!id1 || !id2) return;
    if (id1 === id2) {
      setErrorMsg(t('selectDistinctReports') || 'Please select two different reports to compare.');
      setComparisonData(null);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.compareReports(id1, id2, language);
      setComparisonData(res);
    } catch (err) {
      console.error(err);
      setErrorMsg((t('networkError') || 'Comparison error') + ': ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompareClick = () => {
    fetchComparison(rep1Id, rep2Id);
  };

  const handleSpeakComparison = () => {
    if (!comparisonData) return;
    const text = `Comparison between your baseline report from ${comparisonData.previousReport?.date || 'earlier'} and recent report from ${comparisonData.currentReport?.date || 'now'}. Found ${comparisonData.comparison?.length || 0} tracked health values. ${comparisonData.summaryNote || 'Values have been analyzed for changes over time.'}`;
    speak(text, language);
  };

  const getTrendIcon = (trend) => {
    if (trend === 'Increased' || trend === t('trendIncreased')) return <TrendingUp size={18} color="var(--primary)" />;
    if (trend === 'Decreased' || trend === t('trendDecreased')) return <TrendingDown size={18} color="var(--status-orange)" />;
    return <Minus size={18} color="var(--text-muted)" />;
  };

  const getLocalizedTrend = (trend) => {
    if (trend === 'Increased') return t('trendIncreased') || 'Higher';
    if (trend === 'Decreased') return t('trendDecreased') || 'Lower';
    return t('trendStable') || 'Stable';
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--navy)', margin: '0 0 6px 0' }}>
            {t('compareMedicalReports') || 'Compare Health Reports'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', margin: 0 }}>
            {t('compareReportsSubtitle') || 'See how your lab numbers have changed between your previous and recent test dates.'}
          </p>
        </div>
        {onBackToReports && (
          <button 
            className="btn btn-secondary" 
            onClick={onBackToReports}
            style={{ minHeight: '48px', padding: '10px 20px', fontSize: '1rem', fontWeight: 600 }}
          >
            <ArrowLeft size={18} /> {t('allReports') || 'Back to All Reports'}
          </button>
        )}
      </div>

      {/* Report Selection Dropdowns */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px', borderRadius: '18px', border: '1.5px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
              {t('previousBaselineReport') || '1. Select Earlier (Baseline) Report'}
            </label>
            <select
              className="form-select"
              style={{ minHeight: '52px', fontSize: '1.05rem', border: '1.5px solid var(--border)' }}
              value={rep1Id}
              onChange={(e) => setRep1Id(e.target.value)}
            >
              <option value="">{t('selectBaselineReport') || '-- Choose previous lab test --'}</option>
              {reports.map(r => (
                <option key={r.id} value={r.id}>
                  {r.reportType} ({r.reportDate})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
              {t('currentReport') || '2. Select Recent (Current) Report'}
            </label>
            <select
              className="form-select"
              style={{ minHeight: '52px', fontSize: '1.05rem', border: '1.5px solid var(--border)' }}
              value={rep2Id}
              onChange={(e) => setRep2Id(e.target.value)}
            >
              <option value="">{t('selectCurrentReport') || '-- Choose recent lab test --'}</option>
              {reports.map(r => (
                <option key={r.id} value={r.id}>
                  {r.reportType} ({r.reportDate})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={handleCompareClick}
              disabled={loading || !rep1Id || !rep2Id}
              style={{ width: '100%', minHeight: '52px', fontSize: '1.05rem', fontWeight: 700 }}
            >
              <GitCompare size={20} /> {loading ? 'Comparing...' : (t('compareNow') || 'Compare Two Reports')}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div style={{ marginTop: '16px', color: 'var(--status-red)', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Comparison Results Table */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '18px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: '4px solid var(--border)',
            borderTopColor: 'var(--primary)',
            margin: '0 auto 16px auto',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)' }}>Comparing official lab values...</p>
        </div>
      ) : comparisonData ? (
        <div className="card" style={{ padding: '24px', borderRadius: '18px', border: '1.5px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GitCompare size={24} color="var(--primary)" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                {t('compareMedicalReports') || 'Comparison Summary'}
              </h2>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={handleSpeakComparison}
                style={{ minHeight: '44px', padding: '8px 16px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                title="Read comparison results out loud"
              >
                <Volume2 size={18} color="var(--primary)" />
                <span>Listen to Summary</span>
              </button>

              <span className="badge badge-blue" style={{ fontSize: '0.9rem', padding: '6px 12px', fontWeight: 700 }}>
                {comparisonData.previousReport?.date} ➔ {comparisonData.currentReport?.date}
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="verification-table" style={{ width: '100%', fontSize: '1rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '14px', fontSize: '1rem' }}>{t('clinicalBiomarker') || 'Health Marker'}</th>
                  <th style={{ padding: '14px', fontSize: '1rem' }}>
                    {t('baseline') || 'Earlier Value'} ({comparisonData.previousReport?.date})
                  </th>
                  <th style={{ padding: '14px', fontSize: '1rem' }}>
                    {t('currentReport') || 'Recent Value'} ({comparisonData.currentReport?.date})
                  </th>
                  <th style={{ padding: '14px', fontSize: '1rem' }}>Change</th>
                  <th style={{ padding: '14px', fontSize: '1rem' }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.comparison?.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '1.05rem' }}>{row.metricName}</div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        {t('standardReference') || 'Normal Range'}: {row.referenceRange || 'Standard'}
                      </div>
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
                      {row.previousValue} {row.unit}
                    </td>
                    <td style={{ padding: '14px', fontWeight: 800, color: 'var(--navy)', fontSize: '1.1rem' }}>
                      {row.currentValue} {row.unit}
                    </td>
                    <td style={{ padding: '14px', fontWeight: 700, color: 'var(--primary)' }}>
                      {row.difference}
                    </td>
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.95rem' }}>
                        {getTrendIcon(row.trend)}
                        <span>{getLocalizedTrend(row.trend)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Localized Disclaimer Note */}
          <div style={{
            background: '#eff6ff',
            border: '1.5px solid #bfdbfe',
            borderRadius: '14px',
            padding: '16px 20px',
            marginTop: '20px',
            fontSize: '0.95rem',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            lineHeight: 1.5
          }}>
            <ShieldCheck size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              {comparisonData.summaryNote || 'These lab values are compared automatically to highlight changes over time. Always discuss your lab progression with your prescribing physician.'}
            </span>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '64px 20px', borderRadius: '18px', color: 'var(--text-muted)' }}>
          <GitCompare size={48} style={{ margin: '0 auto 16px auto', opacity: 0.4 }} />
          <h3 style={{ fontSize: '1.3rem', color: 'var(--navy)' }}>Ready to Compare Lab Reports</h3>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{t('selectDistinctReports') || 'Select two different report dates above to view side-by-side progression.'}</p>
        </div>
      )}
    </div>
  );
};
