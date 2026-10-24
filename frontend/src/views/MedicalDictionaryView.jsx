import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Filter, ShieldCheck, Info, Sparkles, ExternalLink } from 'lucide-react';
import { api } from '../api/apiClient';

export const MedicalDictionaryView = () => {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLetter, setSelectedLetter] = useState('All');

  const categories = ['All', 'Diagnostic Lab Test', 'Prescription Medication', 'Vital Sign', 'Clinical Emergency', 'Vital Sign / Physiology'];
  const alphabet = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  const fetchDictionary = async () => {
    try {
      setLoading(true);
      const res = await api.getMedicalDictionary({
        q: searchQuery,
        category: selectedCategory !== 'All' ? selectedCategory : undefined
      });
      setTerms(res.terms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDictionary();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  const filteredTerms = terms.filter(t => {
    if (selectedLetter !== 'All') {
      return t.term.toUpperCase().startsWith(selectedLetter);
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={26} color="var(--primary)" />
          Medical Dictionary & Clinical Glossary
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Search standard medical tests, drug pharmacology, anatomical terms, and laboratory reference intervals.
        </p>
      </div>

      {/* Search and Category Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search medical terms (e.g. glucose, lisinopril, hemoglobin, blood pressure)..."
              className="form-input"
              style={{ paddingLeft: '38px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {categories.slice(0, 4).map(cat => (
              <button
                key={cat}
                className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedCategory(cat)}
                style={{ fontSize: '0.78rem' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Alphabetical A-Z Picker */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
          {alphabet.map(letter => (
            <button
              key={letter}
              onClick={() => setSelectedLetter(letter)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: selectedLetter === letter ? 'var(--primary)' : 'var(--bg-alt)',
                color: selectedLetter === letter ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="skeleton" style={{ height: '140px', borderRadius: '16px' }} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredTerms.length === 0 && (
        <div className="empty-state-box">
          <BookOpen size={32} color="var(--text-muted)" />
          <h4 style={{ color: 'var(--navy)', margin: 0 }}>No Medical Terms Found</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Try searching for another keyword or clear the current category filter.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setSelectedLetter('All'); }}>
            Reset Filters
          </button>
        </div>
      )}

      {/* Terms Grid */}
      {!loading && filteredTerms.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '16px' }}>
          {filteredTerms.map((item, idx) => (
            <div key={item.id || item.term || idx} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', margin: 0 }}>
                    {item.term}
                  </h3>
                  <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                    {item.category}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                  {item.definition}
                </p>
              </div>

              <div>
                {item.referenceRange && (
                  <div style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-alt)',
                    fontSize: '0.78rem',
                    color: 'var(--primary-dark)',
                    marginBottom: '8px',
                    fontWeight: 600
                  }}>
                    🎯 {item.referenceRange}
                  </div>
                )}
                {item.clinicalNote && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, fontStyle: 'italic' }}>
                    💡 Clinical Context: {item.clinicalNote}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
