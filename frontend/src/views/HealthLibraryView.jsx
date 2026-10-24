import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Search, 
  BookOpen, 
  Clock, 
  CheckCircle, 
  Calendar, 
  ChevronRight, 
  Sparkles,
  Share2
} from 'lucide-react';
import { api } from '../api/apiClient';

export const HealthLibraryView = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeArticle, setActiveArticle] = useState(null);

  const categories = ['All', 'Cardiovascular Health', 'Diabetes & Metabolism', 'Medication Safety', 'Nutrition & Wellness', 'First Aid & Emergency'];

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const res = await api.getHealthArticles({
        q: searchQuery,
        category: selectedCategory !== 'All' ? selectedCategory : undefined
      });
      setArticles(res.articles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [searchQuery, selectedCategory]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GraduationCap size={26} color="var(--primary)" />
          Health Education Library & Wellness Guides
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Evidence-based clinical guides on chronic disease management, nutrition science, medication safety, and preventative longevity.
        </p>
      </div>

      {/* Search and Category Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search guides (e.g. blood pressure, stroke, diabetes, sodium, hydration)..."
              className="form-input"
              style={{ paddingLeft: '38px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCategory(cat)}
              style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} className="skeleton" style={{ height: '110px', borderRadius: '16px' }} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && articles.length === 0 && (
        <div className="empty-state-box">
          <BookOpen size={32} color="var(--text-muted)" />
          <h4 style={{ color: 'var(--navy)', margin: 0 }}>No Articles Found</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Try searching for a different health condition or topic.</p>
        </div>
      )}

      {/* Articles Feed */}
      {!loading && articles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {articles.map(art => (
            <div
              key={art.id}
              className="card"
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderLeft: '4px solid var(--primary)'
              }}
              onClick={() => setActiveArticle(art)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-blue">{art.category}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> {art.readTime}
                </span>
              </div>

              <h3 style={{ fontSize: '1.15rem', color: 'var(--navy)', marginBottom: '6px' }}>
                {art.title}
              </h3>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                {art.summary}
              </p>

              {/* Key Takeaways Preview */}
              <div style={{ background: 'var(--bg-alt)', padding: '10px 14px', borderRadius: '10px' }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--navy)', display: 'block', marginBottom: '4px' }}>
                  Key Clinical Highlights:
                </strong>
                <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {(art.keyPoints || []).slice(0, 2).map((kp, idx) => (
                    <li key={idx}>{kp}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Read Complete Article <ChevronRight size={14} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Article Detail Modal */}
      {activeArticle && (
        <div className="modal-backdrop" onClick={() => setActiveArticle(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <span className="badge badge-blue" style={{ marginBottom: '6px' }}>{activeArticle.category}</span>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{activeArticle.title}</h3>
              </div>
              <button className="btn-close" onClick={() => setActiveArticle(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                <span>⏱️ {activeArticle.readTime}</span>
                <span>📅 Updated: {activeArticle.updatedAt}</span>
                <span>🩺 Medically Reviewed</span>
              </div>

              <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: '18px' }}>
                {activeArticle.summary}
              </p>

              <div style={{ background: 'var(--bg-alt)', padding: '16px', borderRadius: '14px', marginBottom: '18px' }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--navy)', marginBottom: '10px' }}>
                  Essential Takeaways & Evidence-Based Rules:
                </h4>
                <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {activeArticle.keyPoints.map((kp, idx) => (
                    <li key={idx} style={{ marginBottom: '8px' }}>{kp}</li>
                  ))}
                </ul>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '12px', lineHeight: 1.4 }}>
                ⚖️ <strong>Educational Notice:</strong> Health education content is authored for patient empowerment and wellness awareness. It should not be used as individual clinical directive without physician oversight.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveArticle(null)}>
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
