import React, { useState, useEffect } from 'react';
import { 
  Apple, 
  Droplets, 
  Activity, 
  Scale, 
  Flame, 
  Plus, 
  Minus, 
  RotateCcw, 
  Heart, 
  Sparkles, 
  CheckCircle2, 
  Info 
} from 'lucide-react';
import { api } from '../api/apiClient';

export const WellnessNutritionView = () => {
  const [wellnessData, setWellnessData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Custom BMI calculator state
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(74);

  const fetchWellness = async () => {
    try {
      setLoading(true);
      const res = await api.getWellnessSummary();
      setWellnessData(res);
      if (res.bmi) {
        // initialize slider if profile has values
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWellness();
  }, []);

  const handleUpdateWater = async (deltaGlasses) => {
    try {
      const res = await api.logWater({ deltaGlasses, deltaMl: deltaGlasses * 250 });
      setWellnessData(prev => ({
        ...prev,
        wellness: res.wellness,
        hydrationPercentage: res.hydrationPercentage
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetWater = async () => {
    try {
      const res = await api.logWater({ reset: true });
      setWellnessData(prev => ({
        ...prev,
        wellness: res.wellness,
        hydrationPercentage: 0
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // Compute interactive BMI
  const computedHeightM = heightCm / 100;
  const computedBmi = parseFloat((weightKg / (computedHeightM * computedHeightM)).toFixed(1));
  let computedBmiCategory = 'Healthy Weight';
  let bmiColor = '#10b981';

  if (computedBmi < 18.5) {
    computedBmiCategory = 'Underweight';
    bmiColor = '#3b82f6';
  } else if (computedBmi < 24.9) {
    computedBmiCategory = 'Healthy Weight (Normal Range)';
    bmiColor = '#10b981';
  } else if (computedBmi < 29.9) {
    computedBmiCategory = 'Overweight Range';
    bmiColor = '#f59e0b';
  } else {
    computedBmiCategory = 'Obesity Range';
    bmiColor = '#ef4444';
  }

  const nutritionTips = [
    {
      title: 'DASH & Mediterranean Diet Standards',
      desc: 'Emphasize leafy greens, cruciferous vegetables, whole grains, lentils, and healthy fats (extra virgin olive oil, walnuts) while curbing refined sugars.'
    },
    {
      title: 'Plate Method for Blood Sugar Balance',
      desc: 'Fill 50% of your plate with non-starchy vegetables, 25% with lean protein, and 25% with complex carbohydrates to stabilize postprandial glucose surges.'
    },
    {
      title: 'Electrolyte & Sodium Regulation',
      desc: 'Keep table salt under 1 level teaspoon daily (< 2000mg sodium) to support vascular compliance and reduce peripheral fluid retention.'
    }
  ];

  const log = wellnessData?.wellness || {
    waterGlasses: 5,
    waterMl: 1250,
    targetWaterMl: 2500,
    steps: 4250,
    targetSteps: 7000,
    activeMinutes: 35,
    sleepHours: 7.2
  };

  const waterGlasses = log.waterGlasses || 0;
  const hydrationPct = wellnessData?.hydrationPercentage ?? Math.min(100, Math.round((log.waterMl / (log.targetWaterMl || 2500)) * 100));

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Apple size={26} color="var(--teal)" />
          Wellness, Hydration & Nutrition Tracker
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Monitor daily fluid intake, body mass index targets, active movement, and metabolic dietary guidelines.
        </p>
      </div>

      {/* Grid: Hydration Card + Steps/Activity Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Hydration Tracker */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Droplets size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', margin: 0 }}>Daily Hydration</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: 2,500 mL (10 Glasses)</div>
                </div>
              </div>
              <span className="badge badge-blue">{hydrationPct}% Complete</span>
            </div>

            {/* Hydration Progress Bar */}
            <div style={{ height: '12px', background: 'var(--bg-alt)', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
              <div style={{ height: '100%', width: `${hydrationPct}%`, background: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)', transition: 'width 0.4s ease' }} />
            </div>

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
                {log.waterMl || (waterGlasses * 250)}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                / 2,500 mL ({waterGlasses} of 10 glasses)
              </span>
            </div>

            {/* Interactive Glasses Display */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(idx => (
                <div
                  key={idx}
                  onClick={() => handleUpdateWater(idx > waterGlasses ? 1 : -1)}
                  style={{
                    width: '32px',
                    height: '42px',
                    borderRadius: '4px 4px 8px 8px',
                    border: '2px solid #0284c7',
                    background: idx <= waterGlasses ? '#38bdf8' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: idx <= waterGlasses ? '#fff' : '#0284c7',
                    transition: 'all 0.2s ease'
                  }}
                  title={`Glass ${idx} (250 mL)`}
                >
                  🥛
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleUpdateWater(-1)}
              disabled={waterGlasses <= 0}
              style={{ flex: 1 }}
            >
              <Minus size={14} /> Remove Glass
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleUpdateWater(1)}
              style={{ flex: 1.5 }}
            >
              <Plus size={14} /> Add 1 Glass (+250mL)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetWater}
              title="Reset day"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Activity & Movement Tracker */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Flame size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', margin: 0 }}>Daily Physical Activity</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Goal: 7,000 Steps / Day</div>
                </div>
              </div>
              <span className="badge badge-green">
                {Math.round(((log.steps || 4250) / 7000) * 100)}%
              </span>
            </div>

            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <span style={{ fontSize: '2.4rem', fontWeight: 800, color: '#d97706' }}>
                {log.steps?.toLocaleString() || '4,250'}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                steps taken today
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <div style={{ background: 'var(--bg-alt)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Movement</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy)' }}>
                  {log.activeMinutes || 35} mins
                </div>
              </div>
              <div style={{ background: 'var(--bg-alt)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sleep Duration</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy)' }}>
                  {log.sleepHours || 7.2} hrs
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '14px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            💡 30 minutes of brisk daily walking lowers systolic blood pressure by up to 8 mmHg.
          </div>
        </div>
      </div>

      {/* Interactive BMI Calculator */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Scale size={22} color="var(--primary)" />
          <h3 style={{ fontSize: '1.15rem', color: 'var(--navy)', margin: 0 }}>
            Interactive Body Mass Index (BMI) Assessment
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'center' }}>
          <div>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Height: <strong>{heightCm} cm</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>({(heightCm / 30.48).toFixed(1)} ft)</span>
              </label>
              <input
                type="range"
                min="130"
                max="210"
                value={heightCm}
                onChange={(e) => setHeightCm(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Weight: <strong>{weightKg} kg</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>({(weightKg * 2.20462).toFixed(1)} lbs)</span>
              </label>
              <input
                type="range"
                min="40"
                max="140"
                value={weightKg}
                onChange={(e) => setWeightKg(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>
          </div>

          <div style={{ background: 'var(--bg-alt)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Calculated BMI
            </span>
            <div style={{ fontSize: '2.6rem', fontWeight: 900, color: bmiColor, margin: '4px 0' }}>
              {computedBmi}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: bmiColor, marginBottom: '8px' }}>
              {computedBmiCategory}
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              WHO Healthy Reference: <strong>18.5 – 24.9 kg/m²</strong>. Maintaining optimal body mass supports cardiac stroke volume and metabolic insulin sensitivity.
            </p>
          </div>
        </div>
      </div>

      {/* Clinical Nutrition Tips */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '14px' }}>
          🥗 Evidence-Based Nutrition Guidelines
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {nutritionTips.map((tip, idx) => (
            <div key={idx} style={{ background: 'var(--bg-alt)', padding: '14px', borderRadius: '12px' }}>
              <strong style={{ fontSize: '0.88rem', color: 'var(--primary-dark)', display: 'block', marginBottom: '6px' }}>
                ✓ {tip.title}
              </strong>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {tip.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
