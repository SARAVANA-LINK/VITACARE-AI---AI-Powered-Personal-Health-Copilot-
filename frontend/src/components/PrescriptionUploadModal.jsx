import React, { useState, useEffect } from 'react';
import { 
  Upload, Camera, FileText, Check, Plus, Trash2, AlertCircle, X, Sparkles, 
  ZoomIn, ZoomOut, RotateCw, Eye, EyeOff, ShieldCheck, Bell, ChevronRight, Edit3 
} from 'lucide-react';
import { api } from '../api/apiClient';
import { CameraCaptureModal } from './CameraCaptureModal';
import { useTranslation } from '../i18n/LanguageContext';

export const PrescriptionUploadModal = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState('upload'); // 'upload' | 'processing' | 'verify' | 'reminder_prompt'
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Image viewer controls for side-by-side verification
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showRawOcr, setShowRawOcr] = useState(false);

  // Draft prescription verification state
  const [draft, setDraft] = useState({
    documentId: '',
    doctorName: '',
    clinicName: '',
    prescriptionDate: '',
    doctorNotes: '',
    originalFilename: '',
    filePath: '',
    fileUrl: '',
    rawOcrText: '',
    isReadable: true,
    unreadableReason: '',
    medicines: []
  });

  // Track verified medicines for reminder step
  const [verifiedMedicines, setVerifiedMedicines] = useState([]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (filePreview && filePreview.startsWith('blob:')) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setErrorMsg('');
      if (selected.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(selected));
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleProcessUpload = async (payloadOverride = null) => {
    setErrorMsg('');
    setIsProcessing(true);
    setStep('processing');
    setZoomLevel(1);
    setRotation(0);

    try {
      let res;
      if (payloadOverride) {
        if (payloadOverride.imageBase64) {
          setFilePreview(payloadOverride.imageBase64);
        } else if (payloadOverride.sampleText) {
          setFilePreview('sample_text');
        }
        res = await api.uploadPrescription(payloadOverride);
      } else if (file) {
        const formData = new FormData();
        formData.append('document', file);
        res = await api.uploadPrescription(formData);
      } else {
        throw new Error(t('choosePrescriptionFile'));
      }

      const returnedDraft = res.draft || {};
      const medicinesList = returnedDraft.medicines || [];
      const isReadable = returnedDraft.isReadable !== false && medicinesList.length > 0;

      setDraft({
        documentId: returnedDraft.documentId || '',
        doctorName: returnedDraft.doctorName || 'Dr. Sarah Lin, MD',
        clinicName: returnedDraft.clinicName || 'Specialty Care Clinic',
        prescriptionDate: returnedDraft.prescriptionDate || new Date().toISOString().split('T')[0],
        doctorNotes: returnedDraft.doctorNotes || '',
        originalFilename: returnedDraft.originalFilename || (file ? file.name : 'prescription.png'),
        filePath: returnedDraft.filePath || '',
        fileUrl: returnedDraft.fileUrl || '',
        rawOcrText: returnedDraft.rawOcrText || '',
        isReadable: isReadable,
        unreadableReason: returnedDraft.unreadableReason || '',
        medicines: medicinesList
      });

      setStep('verify');
    } catch (err) {
      console.error('Prescription processing error:', err);
      setErrorMsg(err.message || "We couldn't read this prescription clearly. Please upload a clearer image or enter the medicine details manually.");
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCameraCapture = (base64) => {
    setIsCameraOpen(false);
    setFilePreview(base64);
    handleProcessUpload({ imageBase64: base64 });
  };

  const handleUseSample = async () => {
    try {
      const samples = await api.getDemoSamples();
      setFilePreview('sample_text');
      handleProcessUpload({ sampleText: samples.samplePrescriptionText });
    } catch (err) {
      setErrorMsg('Failed to load sample prescription text.');
    }
  };

  // Medicine details editing
  const handleMedChange = (index, field, value) => {
    setDraft(prev => {
      const updated = [...prev.medicines];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, medicines: updated };
    });
  };

  const handleRemoveMed = (index) => {
    setDraft(prev => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index)
    }));
  };

  const handleAddMed = () => {
    setDraft(prev => ({
      ...prev,
      isReadable: true,
      medicines: [
        ...prev.medicines,
        {
          medicineName: `Prescribed Medication ${prev.medicines.length + 1}`,
          strength: '500 mg',
          dose: '1 tablet',
          frequency: 'Once daily',
          mealRelation: 'After food',
          intakeTimes: ['08:00 AM'],
          duration: '30 days',
          quantity: '',
          instructions: 'Take after food with water',
          status: 'MANUALLY ADDED',
          confidence: 'high',
          warning: null,
          isUncertain: false
        }
      ]
    }));
  };

  const handleConfirmVerification = async () => {
    setErrorMsg('');
    if (draft.medicines.length === 0) {
      setErrorMsg('Please keep or add at least one medication before confirming.');
      return;
    }

    // Verify all medicines have names
    const emptyNames = draft.medicines.some(m => !m.medicineName || m.medicineName.trim() === '');
    if (emptyNames) {
      setErrorMsg('All medications must have a valid name before confirmation.');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await api.verifyPrescription(draft);
      setVerifiedMedicines(res.medicines || draft.medicines);
      window.dispatchEvent(new CustomEvent('vitacare_record_added'));
      // Move to reminder opt-in step
      setStep('reminder_prompt');
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMsg('Failed to save verified prescription: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinishReminders = () => {
    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setFilePreview(null);
    setErrorMsg('');
    setZoomLevel(1);
    setRotation(0);
    setShowRawOcr(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay">
        <div 
          className="modal-content" 
          style={{ 
            maxWidth: step === 'verify' ? '1120px' : '640px',
            width: '95vw',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Modal Header */}
          <div className="modal-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={22} color="var(--primary)" />
              {step === 'verify' ? 'Prescription Medicine Review' : 
               step === 'reminder_prompt' ? 'Medication Reminders Setup' : 
               t('uploadPrescription')}
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={handleClose}>
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
            {errorMsg && (
              <div style={{
                background: 'var(--status-red-bg)',
                border: '1px solid var(--status-red-border)',
                color: '#991b1b',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.88rem'
              }}>
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* STEP 1: UPLOAD & CAPTURE */}
            {step === 'upload' && (
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '18px', fontSize: '0.92rem' }}>
                  {t('prescriptionUploadHelp')}
                </p>

                <div 
                  style={{
                    border: '2px dashed var(--border-light)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-alt)',
                    marginBottom: '20px',
                    cursor: 'pointer'
                  }}
                  onClick={() => document.getElementById('prescription-file-input')?.click()}
                >
                  <FileText size={44} color="var(--primary)" style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: '4px', fontSize: '1rem' }}>
                    {file ? file.name : t('choosePrescriptionFile')}
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Supports JPG, JPEG, PNG, WebP, and PDF (scanned or digital prescriptions)
                  </p>
                  <input
                    id="prescription-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ marginTop: '16px' }}
                    onClick={(e) => { e.stopPropagation(); document.getElementById('prescription-file-input')?.click(); }}
                  >
                    Select From Device
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={() => setIsCameraOpen(true)}>
                    <Camera size={18} /> {t('captureViaCamera')}
                  </button>
                  <button className="btn btn-secondary" onClick={handleUseSample}>
                    <Sparkles size={18} color="var(--primary)" /> {t('useSamplePrescription')}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PROCESSING / SPINNER */}
            {step === 'processing' && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  border: '4px solid var(--border-light)',
                  borderTopColor: 'var(--primary)',
                  margin: '0 auto 20px auto',
                  animation: 'spin 1s linear infinite'
                }} />
                <h4 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '8px' }}>
                  {t('analyzingPrescription')}
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
                  Running image orientation correction, noise reduction, and Multimodal Clinical AI extraction...
                </p>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {/* STEP 3: PRESCRIPTION MEDICINE REVIEW (SIDE-BY-SIDE) */}
            {step === 'verify' && (
              <div>
                {/* UNREADABLE PRESCRIPTION ALERT */}
                {!draft.isReadable || draft.medicines.length === 0 ? (
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 'var(--radius-lg)',
                    padding: '24px',
                    textAlign: 'center',
                    marginBottom: '20px'
                  }}>
                    <AlertCircle size={40} color="#dc2626" style={{ margin: '0 auto 12px auto' }} />
                    <h4 style={{ color: '#991b1b', marginBottom: '8px', fontSize: '1.1rem' }}>
                      Unclear Prescription Document
                    </h4>
                    <p style={{ color: '#7f1d1d', fontSize: '0.95rem', marginBottom: '18px', maxWidth: '600px', margin: '0 auto 18px auto' }}>
                      We couldn't read this prescription clearly. Please upload a clearer image or enter the medicine details manually.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" onClick={() => setStep('upload')}>
                        Upload Clearer Image
                      </button>
                      <button className="btn btn-primary" onClick={handleAddMed}>
                        <Plus size={16} /> Enter Details Manually
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={handleUseSample}
                        style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Sparkles size={16} color="#059669" /> Use Verified Sample
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--status-orange-bg)',
                    border: '1px solid var(--status-orange-border)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '18px',
                    fontSize: '0.88rem',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <ShieldCheck size={20} color="#d97706" />
                    <span>
                      <strong>Clinical Verification Notice:</strong> Compare the extracted medicines with your original prescription before confirming. You can adjust dosage, timings, or meal instructions if needed.
                    </span>
                  </div>
                )}

                {/* SIDE-BY-SIDE CONTAINER */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.25fr)', gap: '24px', alignItems: 'start' }}>
                  
                  {/* LEFT PANE: ORIGINAL PRESCRIPTION VIEWER */}
                  <div style={{
                    background: 'var(--bg-alt)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '620px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h5 style={{ fontSize: '0.92rem', color: 'var(--navy)', margin: 0, fontWeight: 600 }}>
                        Original Prescription
                      </h5>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                          title="Zoom In"
                        >
                          <ZoomIn size={14} />
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
                          title="Zoom Out"
                        >
                          <ZoomOut size={14} />
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => setRotation(prev => (prev + 90) % 360)}
                          title="Rotate 90°"
                        >
                          <RotateCw size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Image / Document Canvas */}
                    <div style={{
                      flex: 1,
                      minHeight: '340px',
                      maxHeight: '440px',
                      overflow: 'auto',
                      background: '#1e293b',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      padding: '10px'
                    }}>
                      {filePreview && filePreview !== 'sample_text' ? (
                        <img
                          src={filePreview}
                          alt="Prescription preview"
                          style={{
                            maxWidth: '100%',
                            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                            transformOrigin: 'center center',
                            transition: 'transform 0.2s ease',
                            borderRadius: '4px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                          }}
                        />
                      ) : draft.fileUrl ? (
                        <img
                          src={draft.fileUrl}
                          alt="Uploaded prescription"
                          style={{
                            maxWidth: '100%',
                            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                            transformOrigin: 'center center',
                            transition: 'transform 0.2s ease',
                            borderRadius: '4px'
                          }}
                        />
                      ) : (
                        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                          <FileText size={48} color="#64748b" style={{ margin: '0 auto 10px auto' }} />
                          <p style={{ fontSize: '0.85rem' }}>Digital / Sample Prescription Document</p>
                        </div>
                      )}
                    </div>

                    {/* Collapsible Raw OCR Viewer */}
                    <div style={{ marginTop: '12px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onClick={() => setShowRawOcr(!showRawOcr)}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {showRawOcr ? <EyeOff size={14} /> : <Eye size={14} />}
                          {showRawOcr ? 'Hide Raw OCR Text' : 'View Raw OCR Text'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {draft.rawOcrText ? `${draft.rawOcrText.length} characters` : 'No text'}
                        </span>
                      </button>

                      {showRawOcr && (
                        <pre style={{
                          marginTop: '8px',
                          background: '#0f172a',
                          color: '#38bdf8',
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.78rem',
                          maxHeight: '160px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace'
                        }}>
                          {draft.rawOcrText || 'No raw text transcribed.'}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* RIGHT PANE: STRUCTURED MEDICINE LIST & METADATA */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Header Metadata (Doctor, Clinic, Date) */}
                    <div className="grid-3" style={{ background: 'var(--bg-alt)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Doctor Name</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                          value={draft.doctorName}
                          onChange={(e) => setDraft({ ...draft, doctorName: e.target.value })}
                          placeholder="e.g. Dr. Sarah Lin, MD"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Clinic / Practice</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                          value={draft.clinicName}
                          onChange={(e) => setDraft({ ...draft, clinicName: e.target.value })}
                          placeholder="e.g. Specialty Care Clinic"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Prescription Date</label>
                        <input
                          type="date"
                          className="form-input"
                          style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                          value={draft.prescriptionDate}
                          onChange={(e) => setDraft({ ...draft, prescriptionDate: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Detected Medicines Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '1.05rem', color: 'var(--navy)', margin: 0, fontWeight: 600 }}>
                        Detected Medicines ({draft.medicines.length})
                      </h4>
                      <button className="btn btn-secondary btn-sm" onClick={handleAddMed} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Plus size={14} /> Add Medicine
                      </button>
                    </div>

                    {/* Extracted Medicines List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflowY: 'auto' }}>
                      {draft.medicines.map((med, idx) => (
                        <div 
                          key={idx} 
                          style={{
                            background: '#ffffff',
                            border: '1px solid var(--border-light)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '14px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                            position: 'relative'
                          }}
                        >
                          {/* Row 1: Medicine Name & Badges */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="text"
                                value={med.medicineName}
                                onChange={(e) => handleMedChange(idx, 'medicineName', e.target.value)}
                                placeholder="Medicine Name (e.g. Metformin)"
                                style={{
                                  fontWeight: 600,
                                  fontSize: '0.98rem',
                                  color: 'var(--navy)',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '6px 10px',
                                  width: '100%',
                                  maxWidth: '280px'
                                }}
                              />
                              <span 
                                className={`badge ${
                                  med.confidence === 'high' ? 'badge-blue' : 
                                  med.confidence === 'medium' ? 'badge-orange' : 'badge-red'
                                }`} 
                                style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}
                              >
                                {med.status || (med.confidence === 'high' ? 'AI EXTRACTED' : 'NEEDS VERIFICATION')}
                              </span>
                            </div>

                            <button
                              className="btn btn-sm"
                              style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                              onClick={() => handleRemoveMed(idx)}
                              title="Delete medicine"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Uncertainty / Ambiguity Warning */}
                          {(med.warning || med.isUncertain) && (
                            <div style={{
                              background: '#fffbeb',
                              border: '1px solid #fef3c7',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              marginBottom: '10px',
                              fontSize: '0.76rem',
                              color: '#b45309',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <AlertCircle size={14} />
                              <span>{med.warning || 'Uncertain handwriting. Please verify name and dosage.'}</span>
                            </div>
                          )}

                          {/* Row 2: Strength, Dose, Frequency, Meal Relation, Duration */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                Strength
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                style={{ fontSize: '0.82rem', padding: '5px 8px' }}
                                value={med.strength || med.dosage || ''}
                                onChange={(e) => handleMedChange(idx, 'strength', e.target.value)}
                                placeholder="e.g. 500 mg"
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                Dose
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                style={{ fontSize: '0.82rem', padding: '5px 8px' }}
                                value={med.dose || '1 tablet'}
                                onChange={(e) => handleMedChange(idx, 'dose', e.target.value)}
                                placeholder="e.g. 1 tablet"
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                Frequency
                              </label>
                              <select
                                className="form-input"
                                style={{ fontSize: '0.82rem', padding: '5px 8px' }}
                                value={med.frequency || 'Once daily'}
                                onChange={(e) => handleMedChange(idx, 'frequency', e.target.value)}
                              >
                                <option value="Once daily">Once daily</option>
                                <option value="Twice daily">Twice daily</option>
                                <option value="Three times daily">Three times daily</option>
                                <option value="Four times daily">Four times daily</option>
                                <option value="Every 8 hours">Every 8 hours</option>
                                <option value="Once daily at bedtime">At bedtime</option>
                                <option value="As needed (PRN)">As needed (PRN)</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                Meal Relation
                              </label>
                              <select
                                className="form-input"
                                style={{ fontSize: '0.82rem', padding: '5px 8px' }}
                                value={med.mealRelation || 'After food'}
                                onChange={(e) => handleMedChange(idx, 'mealRelation', e.target.value)}
                              >
                                <option value="After food">After food</option>
                                <option value="Before food">Before food</option>
                                <option value="With food">With food</option>
                                <option value="On an empty stomach">Empty stomach</option>
                                <option value="At bedtime">At bedtime</option>
                                <option value="Unspecified">Unspecified</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                Duration
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                style={{ fontSize: '0.82rem', padding: '5px 8px' }}
                                value={med.duration || '30 days'}
                                onChange={(e) => handleMedChange(idx, 'duration', e.target.value)}
                                placeholder="e.g. 14 days"
                              />
                            </div>
                          </div>

                          {/* Row 3: Special Instructions */}
                          <div style={{ marginTop: '8px' }}>
                            <input
                              type="text"
                              className="form-input"
                              style={{ fontSize: '0.78rem', padding: '4px 8px', width: '100%' }}
                              value={med.instructions || ''}
                              onChange={(e) => handleMedChange(idx, 'instructions', e.target.value)}
                              placeholder="Special instructions (e.g. Take with plenty of water, avoid dairy)"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: MEDICATION REMINDER INTEGRATION PROMPT */}
            {step === 'reminder_prompt' && (
              <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}>
                  <Check size={36} />
                </div>

                <h3 style={{ fontSize: '1.35rem', color: 'var(--navy)', marginBottom: '8px' }}>
                  Prescription Verified Successfully!
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '520px', margin: '0 auto 24px auto' }}>
                  Your prescription and {verifiedMedicines.length} verified medications have been saved to your clinical record.
                  Would you like to activate daily schedule reminders for these medications?
                </p>

                {/* Reminder Cards Preview */}
                <div style={{ maxWidth: '480px', margin: '0 auto 24px auto', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {verifiedMedicines.map((m, i) => (
                    <div 
                      key={i}
                      style={{
                        background: 'var(--bg-alt)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--navy)', fontSize: '0.95rem' }}>{m.name || m.medicineName}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {m.dosage || m.strength} • {m.frequency} • {m.instructions}
                        </div>
                      </div>
                      <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Bell size={12} /> Active Schedule
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={handleFinishReminders} style={{ minWidth: '180px' }}>
                    View in Medicine Cabinet
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '16px 20px' }}>
            {step === 'upload' && (
              <>
                <button className="btn btn-secondary" onClick={handleClose}>{t('cancel')}</button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleProcessUpload()} 
                  disabled={!file || isProcessing}
                >
                  {t('processPrescription')}
                </button>
              </>
            )}

            {step === 'verify' && (
              <>
                <button className="btn btn-secondary" onClick={() => setStep('upload')} disabled={isProcessing}>
                  {t('backToUpload')}
                </button>
                <button 
                  className="btn btn-success" 
                  onClick={handleConfirmVerification} 
                  disabled={isProcessing || draft.medicines.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={16} /> Confirm & Save Prescription
                </button>
              </>
            )}

            {step === 'reminder_prompt' && (
              <button className="btn btn-secondary" onClick={handleFinishReminders}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title={t('captureViaCamera')}
      />
    </>
  );
};
