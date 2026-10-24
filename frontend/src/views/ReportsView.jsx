import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  GitCompare, 
  Eye, 
  Trash2, 
  Calendar, 
  Building, 
  CheckCircle2, 
  Volume2, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation } from '../i18n/LanguageContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { ReportViewerModal } from '../components/ReportViewerModal';

// Plain language descriptions for common lab test categories
const getReportPlainDescription = (reportType = '') => {
  const lower = reportType.toLowerCase();
  if (lower.includes('lipid')) {
    return 'Cholesterol & Heart Health (measures fats and cholesterol in your bloodstream)';
  }
  if (lower.includes('metabolic') || lower.includes('cmp') || lower.includes('bmp')) {
    return 'Blood Sugar, Liver & Kidneys (checks how your major organs are filtering and processing energy)';
  }
  if (lower.includes('blood count') || lower.includes('cbc')) {
    return 'Complete Blood Count (checks oxygen-carrying cells and immune defense levels)';
  }
  if (lower.includes('thyroid')) {
    return 'Thyroid Function (regulates body energy, metabolism, and temperature)';
  }
  if (lower.includes('hba1c') || lower.includes('sugar') || lower.includes('glucose')) {
    return 'Blood Sugar Level (checks average glucose over the past 2 to 3 months)';
  }
  return 'General Health & Diagnostic Lab Evaluation';
};

export const ReportsView = ({ onAddReport, onCompareReports }) => {
  const { t, language } = useTranslation();
  const { speak } = useAccessibility();
  const [reports, setReports] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.getReports({ search: searchTerm, type: typeFilter });
      setReports(res.reports || []);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [searchTerm, typeFilter, language]);

  const handleOpenDetails = (rep) => {
    setSelectedReport(rep);
  };

  const handleSpeakReport = (e, rep) => {
    e.stopPropagation();
    const plainDesc = getReportPlainDescription(rep.reportType);
    const textToSpeak = `Health report for ${rep.reportType || 'lab test'}, dated ${rep.reportDate || 'recently'}. Issued by ${rep.labName || 'medical lab'}. This test checks ${plainDesc}. Contains ${rep.metricsCount || 'several'} recorded health values.`;
    speak(textToSpeak, language);
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteReport(id);
      setDeleteConfirmId(null);
      fetchReports();
      if (selectedReport?.id === id) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  return (
    <div className="reports-view-container" style={{ paddingBottom: '40px' }}>
      {/* Page Title & Main Action Buttons */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '24px', 
        flexWrap: 'wrap', 
        gap: '16px' 
      }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--navy)', margin: '0 0 6px 0' }}>
            {t('healthReports') || 'Health Reports'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', margin: 0 }}>
            {t('reportsSubtitle') || 'Easy-to-read records of your lab tests, doctor summaries, and health scans.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {reports.length >= 2 && (
            <button 
              className="btn btn-secondary" 
              onClick={onCompareReports}
              style={{ minHeight: '52px', padding: '12px 20px', fontSize: '1.05rem', fontWeight: 600 }}
              aria-label="Compare previous and recent lab reports"
            >
              <GitCompare size={20} /> 
              <span>{t('compareReports') || 'Compare Reports'}</span>
            </button>
          )}

          <button 
            className="btn btn-primary" 
            onClick={onAddReport}
            style={{ 
              minHeight: '52px', 
              padding: '12px 24px', 
              fontSize: '1.05rem', 
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)' 
            }}
            aria-label="Upload a new health report document"
          >
            <Plus size={22} /> 
            <span>{t('addHealthReport') || 'Upload Health Report'}</span>
          </button>
        </div>
      </div>

      {/* Elder-Friendly Guidance Banner */}
      <div 
        className="card"
        style={{
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          padding: '18px 22px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          borderRadius: '16px'
        }}
      >
        <ShieldCheck size={28} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '4px' }}>
            {t('howReportsWorkHeading') || 'Clear, Plain-Language Health Summaries'}
          </div>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            {t('howReportsWorkBody') || 'All numeric lab values come directly from your official medical paperwork. Descriptions are written in simple words to help you understand what your results mean before speaking with your doctor.'}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <label htmlFor="report-search-input" className="sr-only">Search reports</label>
            <Search 
              size={20} 
              style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-secondary)' }} 
            />
            <input
              id="report-search-input"
              type="text"
              className="form-input"
              style={{ 
                paddingLeft: '48px', 
                minHeight: '52px', 
                fontSize: '1.05rem',
                border: '1.5px solid var(--border)' 
              }}
              placeholder={t('searchReportsPlaceholder') || 'Search by test name (e.g. Blood Count, Lipid, Sugar)...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ minWidth: '220px' }}>
            <label htmlFor="report-type-filter" className="sr-only">Filter by test type</label>
            <select
              id="report-type-filter"
              className="form-select"
              style={{ 
                minHeight: '52px', 
                fontSize: '1.05rem',
                border: '1.5px solid var(--border)' 
              }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">{t('allTestTypes') || 'All Lab Categories'}</option>
              <option value="metabolic">Metabolic Panel (Liver/Kidney/Sugar)</option>
              <option value="lipid">Lipid Profile (Cholesterol)</option>
              <option value="blood">Blood Count (CBC)</option>
              <option value="checkup">Comprehensive Full Checkup</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Listing */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '16px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: '4px solid var(--border)',
            borderTopColor: 'var(--primary)',
            margin: '0 auto 16px auto',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', margin: 0 }}>
            {t('loadingReports') || 'Loading your health reports safely...'}
          </p>
        </div>
      ) : reports.length === 0 ? (
        /* Empty State */
        <div className="card" style={{ textAlign: 'center', padding: '64px 24px', borderRadius: '20px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(37, 99, 235, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto'
          }}>
            <FileText size={42} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '8px' }}>
            {t('noReportsFound') || 'No Health Reports Saved Yet'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '540px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
            {t('emptyReportsExplanation') || 'Keep all your medical reports organized in one simple, secure place. Upload a doctor prescription, lab report, or scan to view explanations and health trends.'}
          </p>
          <button 
            className="btn btn-primary btn-lg" 
            onClick={onAddReport}
            style={{ padding: '14px 28px', fontSize: '1.1rem', fontWeight: 700 }}
          >
            <Plus size={22} /> {t('addFirstReport') || 'Upload Your First Health Report'}
          </button>
        </div>
      ) : (
        /* Reports Grid / Cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {reports.map((rep, idx) => {
            const plainDescription = getReportPlainDescription(rep.reportType);

            return (
              <div
                key={rep.id || idx}
                className="card"
                style={{
                  padding: '24px',
                  borderRadius: '18px',
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                {/* Top Row: Badges, Title, Audio Speaker */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-blue" style={{ fontSize: '0.85rem', padding: '4px 10px', fontWeight: 700 }}>
                        <Calendar size={13} style={{ marginRight: '4px' }} />
                        {rep.reportDate || 'Recent'}
                      </span>
                      <span className="badge badge-green" style={{ fontSize: '0.85rem', padding: '4px 10px', fontWeight: 700 }}>
                        <CheckCircle2 size={13} style={{ marginRight: '4px' }} />
                        {t('verified') || 'Verified Lab'}
                      </span>
                      {rep.metricsCount > 0 && (
                        <span className="badge" style={{ background: '#f1f5f9', color: 'var(--navy)', fontSize: '0.85rem', padding: '4px 10px' }}>
                          {rep.metricsCount} {t('healthValues') || 'Values Recorded'}
                        </span>
                      )}
                    </div>

                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy)', margin: '0 0 6px 0' }}>
                      {rep.reportType || 'Lab Report'}
                    </h2>
                    
                    <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                      {plainDescription}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building size={16} color="var(--primary)" />
                        <strong>{rep.labName || 'Laboratory / Clinic'}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Read Aloud Button */}
                  <button
                    className="btn btn-secondary"
                    onClick={(e) => handleSpeakReport(e, rep)}
                    style={{
                      minHeight: '44px',
                      padding: '8px 14px',
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Read report summary out loud"
                    aria-label={`Read out loud details of ${rep.reportType}`}
                  >
                    <Volume2 size={18} color="var(--primary)" />
                    <span>{t('readAloud') || 'Listen'}</span>
                  </button>
                </div>

                {/* Bottom Actions Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border)',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} color="var(--teal)" />
                    <span>{t('officialMedicalDocArchived') || 'Official medical document safely archived'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {onCompareReports && reports.length >= 2 && (
                      <button
                        className="btn btn-secondary"
                        style={{ minHeight: '48px', padding: '10px 18px', fontSize: '1rem', fontWeight: 600 }}
                        onClick={() => onCompareReports(rep.id)}
                        aria-label={`Compare ${rep.reportType} with previous report`}
                      >
                        <GitCompare size={17} />
                        <span>{t('compare') || 'Compare'}</span>
                      </button>
                    )}

                    <button
                      className="btn btn-primary"
                      style={{ minHeight: '48px', padding: '10px 22px', fontSize: '1rem', fontWeight: 700 }}
                      onClick={() => handleOpenDetails(rep)}
                      aria-label={`Open and inspect ${rep.reportType}`}
                    >
                      <Eye size={18} />
                      <span>{t('viewReportDetails') || 'View Full Report'}</span>
                    </button>

                    <button
                      className="btn"
                      style={{ 
                        minHeight: '48px', 
                        minWidth: '48px', 
                        color: 'var(--status-red)', 
                        background: 'transparent', 
                        border: '1.5px solid transparent',
                        borderRadius: '12px',
                        padding: '10px'
                      }}
                      onClick={() => setDeleteConfirmId(rep.id)}
                      title={t('deleteReport') || 'Delete report'}
                      aria-label={`Delete report ${rep.reportType}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation In-Card */}
                {deleteConfirmId === rep.id && (
                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--status-red)' }}>
                      <AlertCircle size={20} />
                      <span style={{ fontSize: '1rem', fontWeight: 600 }}>
                        {t('confirmDeleteReportQuestion') || 'Are you sure you want to remove this report?'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setDeleteConfirmId(null)}
                        style={{ minHeight: '40px', padding: '8px 14px' }}
                      >
                        {t('cancel') || 'Cancel'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(rep.id)}
                        style={{ minHeight: '40px', padding: '8px 16px' }}
                      >
                        {t('yesDelete') || 'Yes, Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Advanced Health Report Viewer Modal */}
      {selectedReport && (
        <ReportViewerModal
          isOpen={Boolean(selectedReport)}
          onClose={() => setSelectedReport(null)}
          reportId={selectedReport.id}
          reportSummary={selectedReport}
        />
      )}
    </div>
  );
};

