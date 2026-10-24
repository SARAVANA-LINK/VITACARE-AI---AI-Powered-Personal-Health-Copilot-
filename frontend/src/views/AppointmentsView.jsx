import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Phone, 
  Plus, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Search, 
  Bell, 
  CalendarCheck,
  RotateCcw
} from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation } from '../i18n/LanguageContext';

export const AppointmentsView = () => {
  const { t, formatDate } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'all' | 'past'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    doctorName: '',
    specialty: 'Cardiology',
    clinicName: 'St. Jude Specialty Care Clinic',
    appointmentDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    appointmentTime: '10:30 AM',
    location: 'Suite 400, Medical Plaza',
    contactPhone: '+1 (555) 234-5678',
    reminderEnabled: true,
    notes: 'Follow-up on lipid profile and blood pressure medication titration.'
  });

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await api.getAppointments();
      setAppointments(res.appointments || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    if (!formData.doctorName.trim() || !formData.appointmentDate) {
      alert('Doctor name and date are required.');
      return;
    }

    try {
      await api.createAppointment(formData);
      setIsModalOpen(false);
      fetchAppointments();
      setFormData({
        doctorName: '',
        specialty: 'Cardiology',
        clinicName: 'St. Jude Specialty Care Clinic',
        appointmentDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        appointmentTime: '10:30 AM',
        location: '',
        contactPhone: '',
        reminderEnabled: true,
        notes: ''
      });
    } catch (err) {
      alert(err.message || 'Failed to save appointment.');
    }
  };

  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Cancel this scheduled appointment?')) return;
    try {
      await api.updateAppointment(id, { status: 'cancelled' });
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment.');
    }
  };

  const filteredAppointments = appointments.filter(a => {
    const appDate = new Date(`${a.appointmentDate}T${a.appointmentTime || '00:00'}`);
    const isPast = appDate < new Date();
    if (activeTab === 'upcoming') return !isPast && a.status !== 'cancelled';
    if (activeTab === 'past') return isPast || a.status === 'completed';
    return true;
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarCheck size={26} color="var(--primary)" />
            {t('appointmentsTitle') || 'Doctor Consultations & Appointments'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('appointmentsSubtitle') || 'Schedule and track clinic visits, specialist check-ups, and diagnostic review dates.'}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setIsModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} /> {t('newAppointment') || 'New Appointment'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('upcoming')}
        >
          {t('upcomingVisits') || 'Upcoming Visits'}
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('all')}
        >
          {t('allAppointments') || 'All Appointments'} ({appointments.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'past' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('past')}
        >
          {t('pastVisits') || 'Past / Completed'}
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="skeleton" style={{ height: '90px', width: '100%' }} />
          <div className="skeleton" style={{ height: '90px', width: '100%' }} />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAppointments.length === 0 && (
        <div className="empty-state-box">
          <div className="empty-state-icon">
            <Calendar size={28} />
          </div>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)' }}>{t('noAppointments') || 'No Appointments Found'}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '400px' }}>
            {t('noAppointmentsMsg') || 'You currently have no scheduled appointments in this category. Click below to add a doctor consultation or lab check.'}
          </p>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={15} /> {t('newAppointment') || 'Book Appointment'}
          </button>
        </div>
      )}

      {/* Appointments List */}
      {!loading && filteredAppointments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredAppointments.map(app => (
            <div
              key={app.id}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                borderLeft: `4px solid ${app.status === 'cancelled' ? '#dc2626' : 'var(--primary)'}`
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--navy)', margin: 0 }}>
                    {app.doctorName}
                  </h4>
                  <span className="badge badge-blue">{app.specialty}</span>
                  {app.status === 'cancelled' && <span className="badge badge-red">Cancelled</span>}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} color="var(--primary)" /> {app.appointmentDate}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} color="var(--primary)" /> {app.appointmentTime}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={14} color="var(--teal)" /> {app.clinicName || 'Clinic'}
                  </span>
                  {app.contactPhone && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={14} color="var(--text-muted)" /> {app.contactPhone}
                    </span>
                  )}
                </div>
                {app.notes && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Note: {app.notes}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {app.status !== 'cancelled' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCancelAppointment(app.id)}
                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Appointment Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3>Schedule Doctor Appointment</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAppointment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Doctor Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Dr. Sarah Lin, MD"
                    value={formData.doctorName}
                    onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Medical Specialty</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Cardiology, Endocrinology"
                      value={formData.specialty}
                      onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Clinic / Hospital</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. St. Jude Clinic"
                      value={formData.clinicName}
                      onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={formData.appointmentDate}
                      onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 10:30 AM"
                      value={formData.appointmentTime}
                      onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Clinic Contact Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. +1 (555) 234-5678"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Consultation Notes / Instructions</label>
                  <textarea
                    rows={2}
                    className="form-input"
                    placeholder="Reason for visit, questions to ask, fasting requirements..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  {t('cancel') || 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t('save') || 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
