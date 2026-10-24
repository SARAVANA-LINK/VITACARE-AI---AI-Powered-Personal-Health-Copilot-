import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Navigation, 
  Search, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { api } from '../api/apiClient';

export const HospitalsFinderView = ({ onOpenSos }) => {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedHospital, setSelectedHospital] = useState(null);

  const cities = ['All', 'Chennai', 'Bengaluru', 'New Delhi', 'Gurugram', 'Coimbatore'];

  const fetchHospitals = async () => {
    try {
      setLoading(true);
      const res = await api.getHospitals({
        q: searchQuery,
        city: selectedCity !== 'All' ? selectedCity : undefined
      });
      setHospitals(res.hospitals || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, [searchQuery, selectedCity]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={26} color="var(--primary)" />
            Nearby Hospitals & 24/7 Emergency Centers
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Locate acute trauma emergency departments, tertiary multi-specialty care, and outpatient clinics.
          </p>
        </div>

        {onOpenSos && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onOpenSos}
            style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 700 }}
          >
            Emergency SOS (108 / 911)
          </button>
        )}
      </div>

      {/* Emergency Dispatch Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        border: '1px solid #fecaca',
        borderRadius: '16px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Phone size={20} />
          </div>
          <div>
            <strong style={{ fontSize: '0.95rem', color: '#991b1b' }}>National Emergency Helplines</strong>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#7f1d1d' }}>
              For acute medical, cardiac, or trauma emergencies, call direct dispatch without delay.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="tel:108" className="btn btn-primary btn-sm" style={{ background: '#dc2626', borderColor: '#dc2626' }}>
            Call 108 (India)
          </a>
          <a href="tel:112" className="btn btn-secondary btn-sm" style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
            Call 112 (Universal)
          </a>
          <a href="tel:911" className="btn btn-secondary btn-sm" style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
            Call 911 (US/CA)
          </a>
        </div>
      </div>

      {/* Search and City Filter Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search hospitals by name, specialty, or landmark..."
              className="form-input"
              style={{ paddingLeft: '38px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
            {cities.map(city => (
              <button
                key={city}
                className={`btn btn-sm ${selectedCity === city ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedCity(city)}
                style={{ fontSize: '0.78rem' }}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hospital Cards Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '16px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} className="skeleton" style={{ height: '180px', borderRadius: '16px' }} />
          ))}
        </div>
      ) : hospitals.length === 0 ? (
        <div className="empty-state-box">
          <Building2 size={32} color="var(--text-muted)" />
          <h4 style={{ color: 'var(--navy)', margin: 0 }}>No Healthcare Facilities Found</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Try searching in a different city or clearing your query.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '16px' }}>
          {hospitals.map(hosp => (
            <div key={hosp.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', margin: 0 }}>
                    {hosp.name}
                  </h3>
                  <span className="badge badge-green" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {hosp.distanceKm}
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--teal-dark)', fontWeight: 600, marginBottom: '8px' }}>
                  {hosp.type}
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '8px' }}>
                  <MapPin size={15} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{hosp.address}, {hosp.city}, {hosp.state} - {hosp.pincode}</span>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <Clock size={13} color="var(--teal)" />
                  <span>{hosp.openStatus}</span>
                </div>

                {/* Specialties chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '14px' }}>
                  {hosp.specialties.map((spec, i) => (
                    <span key={i} style={{ fontSize: '0.7rem', background: 'var(--bg-alt)', padding: '2px 8px', borderRadius: '4px', color: 'var(--navy)' }}>
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                <a
                  href={`tel:${hosp.emergencyPhone.replace(/\D/g, '')}`}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.78rem' }}
                >
                  <Phone size={13} /> Call ER: {hosp.hotline || hosp.emergencyPhone}
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hosp.name} ${hosp.address} ${hosp.city}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}
                  title="Open GPS Navigation"
                >
                  <Navigation size={13} /> Directions
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
