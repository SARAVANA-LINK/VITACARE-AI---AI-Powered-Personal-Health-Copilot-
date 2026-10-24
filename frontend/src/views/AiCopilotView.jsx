import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  User, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle, 
  Trash2, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Plus, 
  Search, 
  Edit3, 
  Paperclip, 
  X, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw, 
  MessageSquare,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  BookOpen,
  FolderOpen,
  StopCircle,
  Play
} from 'lucide-react';
import { api } from '../api/apiClient';
import { useTranslation, SUPPORTED_LANGUAGES } from '../i18n/LanguageContext';

export const AiCopilotView = () => {
  const { t, language, setLanguage, bcp47 } = useTranslation();
  
  // Threads state
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState('default');
  const [threadSearchQuery, setThreadSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [renamingThreadId, setRenamingThreadId] = useState(null);
  const [newThreadTitle, setNewThreadTitle] = useState('');

  // Messages state
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [mode, setMode] = useState('simple'); // 'simple' (Short Answer) | 'standard' (Explain More) | 'detailed' (Detailed Explanation)
  const [loading, setLoading] = useState(false);
  const [analyzingDoc, setAnalyzingDoc] = useState(false);
  const [errorState, setErrorState] = useState(null);

  // File Attachment & Saved Document State
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const [isSavedDocsOpen, setIsSavedDocsOpen] = useState(false);
  const [userSavedDocs, setUserSavedDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);

  // Expanded explanations toggle state (map of msgIndex -> boolean)
  const [expandedExplanations, setExpandedExplanations] = useState({});

  // Voice Assistant state
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  const chatBottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const activeRequestIdRef = useRef(0);

  const samplePrompts = [
    t('suggestedMedsToday') || 'What medicines do I have today?',
    'What does this blood test mean?',
    'Explain my prescription and doses',
    'How can I improve my sleep and hydration?',
    'What are normal blood pressure ranges?',
    'What should I ask my doctor about my HbA1c?'
  ];

  // 1. Fetch Threads
  const fetchThreads = async () => {
    try {
      const res = await api.getAiThreads();
      if (res.threads && res.threads.length > 0) {
        setThreads(res.threads);
        if (activeThreadId === 'default' && res.threads[0]) {
          setActiveThreadId(res.threads[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load threads:', err.message);
    }
  };

  // 2. Fetch Messages for Active Thread
  const fetchMessages = async (threadId) => {
    try {
      const res = await api.getAiThreadMessages(threadId);
      if (res.messages && res.messages.length > 0) {
        setMessages(res.messages);
      } else {
        // Welcoming medical-focused assistant introduction
        setMessages([
          {
            id: 'welcome_1',
            role: 'assistant',
            content: `👋 **Welcome to AI Health Copilot!**\n\nI specialize in healthcare education, lab report understanding, prescription guidance, and preventive health communication.\n\n• **Short & Sweet**: Concise 2–5 sentence answers by default.\n• **Document Grounding**: Attach a report or prescription for direct analysis.\n• **Voice Ready**: Speak directly in English, Tamil, Hindi, or Telugu.\n\n*Emergency Notice*: In urgent situations, call **112** (India) or your local emergency services immediately.`,
            mode: 'simple',
            createdAt: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.warn('Failed to load messages:', err.message);
    }
  };

  // 3. Fetch User's Saved Documents for Picker
  const fetchUserSavedDocs = async () => {
    try {
      const res = await api.getUserChatDocuments();
      if (res.documents) {
        setUserSavedDocs(res.documents);
      }
    } catch (err) {
      console.warn('Could not fetch saved documents:', err);
    }
  };

  useEffect(() => {
    fetchThreads();
    fetchUserSavedDocs();
  }, []);

  useEffect(() => {
    if (activeThreadId) {
      fetchMessages(activeThreadId);
    }
  }, [activeThreadId, language]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, analyzingDoc]);

  const handleCreateThread = async () => {
    try {
      const title = `Consultation ${threads.length + 1}`;
      const res = await api.createAiThread(title);
      if (res.thread) {
        setThreads(prev => [res.thread, ...prev]);
        setActiveThreadId(res.thread.id);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameThread = async (id) => {
    if (!newThreadTitle.trim()) {
      setRenamingThreadId(null);
      return;
    }
    try {
      await api.updateAiThread(id, { title: newThreadTitle.trim() });
      setThreads(prev => prev.map(t => t.id === id ? { ...t, title: newThreadTitle.trim() } : t));
    } catch (err) {
      console.error(err);
    } finally {
      setRenamingThreadId(null);
      setNewThreadTitle('');
    }
  };

  const handleDeleteThread = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Delete this conversation thread?')) return;
    try {
      await api.deleteAiThread(id);
      const remaining = threads.filter(t => t.id !== id);
      setThreads(remaining);
      if (activeThreadId === id) {
        if (remaining.length > 0) {
          setActiveThreadId(remaining[0].id);
        } else {
          setActiveThreadId('default');
          setMessages([]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------------------------------------------------------------------
  // Voice Assistant Workflow (Speech-to-Text & Text-to-Speech)
  // ----------------------------------------------------------------------------
  const startVoiceRecording = () => {
    setVoiceError(null);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Speech recognition is not supported in this browser. Please use the keyboard text input.');
      setIsVoiceModalOpen(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = bcp47 || 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const spoken = final || interim;
        setVoiceTranscript(spoken);
        setInputMessage(spoken); // Show voice question directly ON the text bar
      };

      recognition.onerror = (e) => {
        console.warn('Speech error:', e.error);
        setIsListening(false);
        if (e.error === 'not-allowed') {
          setVoiceError('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else if (e.error !== 'no-speech') {
          setVoiceError(`Voice recognition notice: ${e.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition exception:', err);
      setIsListening(false);
      setVoiceError('Microphone could not be activated. Please try again or type your question.');
    }
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const cancelVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    setIsListening(false);
    setVoiceTranscript('');
    setIsVoiceModalOpen(false);
    setVoiceError(null);
  };

  const confirmVoiceTranscriptAndSend = () => {
    if (voiceTranscript.trim()) {
      handleSendMessage(voiceTranscript.trim());
    }
    cancelVoiceRecording();
  };

  // Text-to-Speech Playback with Replay & Mute
  const handleReadAloud = (text, messageId = null) => {
    if (!('speechSynthesis' in window)) return;

    if (isMuted) return;

    if (isSpeaking && (!messageId || speakingMessageId === messageId)) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[*_#`•📎]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = bcp47 || 'en-US';
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const prefix = (bcp47 || 'en').split('-')[0].toLowerCase();
    const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingMessageId(messageId);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const toggleMute = () => {
    if (!isMuted && isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
    setIsMuted(!isMuted);
  };

  // ----------------------------------------------------------------------------
  // Document File Attachment & Selection
  // ----------------------------------------------------------------------------
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        rawFile: file,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        size: (file.size / 1024).toFixed(1) + ' KB',
        dataUrl: reader.result
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSavedDocument = (doc) => {
    setSelectedDocId(doc.id);
    setIsSavedDocsOpen(false);
    const msg = `Please analyze my saved ${doc.documentType || 'document'}: "${doc.title}"`;
    handleSendMessage(msg, doc.id);
  };

  // ----------------------------------------------------------------------------
  // Send Chat Message or Trigger Document OCR Analysis
  // ----------------------------------------------------------------------------
  const handleSendMessage = async (textToSend = null, docId = null) => {
    const text = textToSend || inputMessage;
    if ((!text || !text.trim()) && !attachment && !docId) return;
    if (loading || analyzingDoc) return;

    const sentAttachment = attachment;
    setAttachment(null);
    setInputMessage('');
    setErrorState(null);

    const userMsg = {
      role: 'user',
      content: text || (sentAttachment ? `Analyze attached document: ${sentAttachment.name}` : 'Analyze document'),
      attachment: sentAttachment ? { name: sentAttachment.name, type: sentAttachment.type, size: sentAttachment.size } : null,
      mode: mode,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);

    const requestId = ++activeRequestIdRef.current;

    // Check if sending with a real uploaded file
    if (sentAttachment && sentAttachment.rawFile) {
      try {
        setAnalyzingDoc(true);
        const formData = new FormData();
        formData.append('file', sentAttachment.rawFile);
        const fileNameLower = sentAttachment.rawFile.name.toLowerCase();
        formData.append('document_type', fileNameLower.includes('prescription') || fileNameLower.includes('rx') ? 'prescription' : 'report');
        formData.append('mode', mode);
        formData.append('language', language);
        formData.append('thread_id', activeThreadId);

        const res = await api.analyzeDocumentInChat(formData);
        if (requestId !== activeRequestIdRef.current) return;

        const assistantMsg = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          mode: mode,
          clinicalBreakdown: res.clinicalBreakdown,
          citations: res.citations || [],
          documentAnalysis: res.extractedData ? {
            documentType: res.documentType,
            filename: res.filename,
            ...res.extractedData
          } : null,
          hasEmergencyWarning: false,
          createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMsg]);
        fetchUserSavedDocs(); // Refresh saved documents list

        // Auto read aloud if voice was used or unmuted
        if (!isMuted && isSpeaking) {
          handleReadAloud(res.reply, assistantMsg.id);
        }
      } catch (err) {
        if (requestId !== activeRequestIdRef.current) return;
        console.error('Document analysis error:', err);
        setErrorState('Unable to process the document. Please verify the file is a valid PDF or image and retry.');
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setAnalyzingDoc(false);
        }
      }
      return;
    }

    // Normal Text / Follow-up Query
    try {
      setLoading(true);
      const recentHistory = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await api.askAiChat({
        message: userMsg.content,
        threadId: activeThreadId,
        mode,
        language,
        history: recentHistory,
        documentId: docId || selectedDocId
      });

      if (requestId !== activeRequestIdRef.current) return;

      const assistantMsg = {
        id: res.messageId || `msg_${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        mode: res.mode,
        clinicalBreakdown: res.clinicalBreakdown,
        citations: res.citations || [],
        hasEmergencyWarning: res.hasEmergencyWarning || false,
        emergencyNumber: res.emergencyNumber || null,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (!isMuted && isSpeaking) {
        handleReadAloud(res.reply, assistantMsg.id);
      }
    } catch (err) {
      if (requestId !== activeRequestIdRef.current) return;
      console.error('Chat error:', err);
      setErrorState('Communication error. Please check your network connection and retry.');
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const toggleExplanation = (idx) => {
    setExpandedExplanations(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const filteredThreads = threads.filter(t => 
    !threadSearchQuery.trim() || t.title.toLowerCase().includes(threadSearchQuery.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 4px 0' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0f766e 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Bot size={20} />
            </div>
            AI Health Copilot
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: 0 }}>
            Healthcare education, medical report understanding & prescription guidance
          </p>
        </div>

        {/* Action Controls: Language, Length Controls, Voice Mute & Threads Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Quick Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="form-select"
            style={{ width: 'auto', fontSize: '0.8rem', padding: '6px 10px', borderRadius: 'var(--radius-pill)' }}
            title="Conversation Language"
          >
            {SUPPORTED_LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
            ))}
          </select>

          {/* Response Length Controls (Requirement 5) */}
          <div className="mode-pills" title="Response Length Control">
            <button
              className={`mode-pill-btn ${mode === 'simple' ? 'active' : ''}`}
              onClick={() => setMode('simple')}
            >
              Short Answer
            </button>
            <button
              className={`mode-pill-btn ${mode === 'standard' ? 'active' : ''}`}
              onClick={() => setMode('standard')}
            >
              Explain More
            </button>
            <button
              className={`mode-pill-btn ${mode === 'detailed' ? 'active' : ''}`}
              onClick={() => setMode('detailed')}
            >
              Detailed Explanation
            </button>
          </div>

          {/* Global Mute Toggle */}
          <button
            type="button"
            className={`btn btn-sm ${isMuted ? 'btn-secondary' : 'btn-outline-primary'}`}
            onClick={toggleMute}
            title={isMuted ? 'Voice output muted' : 'Voice output active'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Conversations Drawer Button */}
          <button
            className={`btn btn-sm ${isSidebarOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <MessageSquare size={14} /> Chats ({threads.length})
          </button>
        </div>
      </div>

      {/* Main Copilot Container with Sidebar */}
      <div style={{ display: 'flex', gap: '16px', minHeight: '620px' }}>
        {/* Threads Drawer / Sidebar */}
        {isSidebarOpen && (
          <div style={{
            width: '280px',
            flexShrink: 0,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--navy)' }}>Consultations</strong>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleCreateThread}
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '999px' }}
              >
                <Plus size={13} /> New Chat
              </button>
            </div>

            {/* Thread Search Box */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search consultations..."
                className="form-input"
                style={{ fontSize: '0.78rem', paddingLeft: '28px', height: '34px' }}
                value={threadSearchQuery}
                onChange={(e) => setThreadSearchQuery(e.target.value)}
              />
            </div>

            {/* Threads List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredThreads.map(t => (
                <div
                  key={t.id}
                  onClick={() => setActiveThreadId(t.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: activeThreadId === t.id ? 'var(--primary-subtle)' : 'var(--bg-alt)',
                    border: `1px solid ${activeThreadId === t.id ? 'var(--primary)' : 'var(--border-light)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {renamingThreadId === t.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={newThreadTitle}
                        onChange={(e) => setNewThreadTitle(e.target.value)}
                        onBlur={() => handleRenameThread(t.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameThread(t.id)}
                        style={{ fontSize: '0.8rem', width: '90%' }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.82rem', fontWeight: activeThreadId === t.id ? 700 : 500, color: 'var(--navy)' }}>
                        {t.title}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setRenamingThreadId(t.id); setNewThreadTitle(t.title); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                      title="Rename"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteThread(t.id, e)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px' }}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Copilot Chat Panel */}
        <div className="copilot-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div className="copilot-header" style={{ padding: '12px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)'
              }} />
              <div>
                <strong style={{ fontSize: '0.95rem', color: 'var(--navy)' }}>AI Health Copilot</strong>
                <div style={{ fontSize: '0.72rem', color: 'var(--primary-dark)', fontWeight: 600 }}>
                  Medical RAG Active • Mode: {mode === 'simple' ? 'Short Answer (2–5 sentences)' : mode === 'standard' ? 'Explain More' : 'Detailed Explanation'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Document Picker Button */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { fetchUserSavedDocs(); setIsSavedDocsOpen(true); }}
                style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Select from previously uploaded health reports and prescriptions"
              >
                <FolderOpen size={13} color="var(--primary)" />
                My Saved Documents ({userSavedDocs.length})
              </button>

              <span className="badge badge-green" style={{ fontWeight: 700 }}>CLINICAL GUARDRAILS</span>
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div className="copilot-chat-feed" style={{ flex: 1, overflowY: 'auto', minHeight: '380px', padding: '16px' }}>
            {messages.map((m, i) => (
              <div
                key={m.id || i}
                className={`chat-bubble ${m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}
                style={{
                  border: m.hasEmergencyWarning ? '2px solid var(--status-red)' : undefined,
                  background: m.hasEmergencyWarning ? '#fef2f2' : undefined
                }}
              >
                {/* Emergency SOS Banner */}
                {m.hasEmergencyWarning && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#dc2626',
                    color: '#fff',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 700,
                    fontSize: '0.82rem'
                  }}>
                    <AlertTriangle size={18} />
                    <span>EMERGENCY ALERT: Call {m.emergencyNumber || '112'} or seek immediate medical care!</span>
                  </div>
                )}

                {/* User Attachment Preview */}
                {m.attachment && (
                  <div style={{
                    marginBottom: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.78rem'
                  }}>
                    {m.attachment.type === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />}
                    <span>{m.attachment.name} ({m.attachment.size})</span>
                  </div>
                )}

                {/* Structured Document Analysis Card (If present) */}
                {m.documentAnalysis && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px',
                    marginBottom: '12px',
                    color: 'var(--navy)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px', color: 'var(--primary-dark)' }}>
                      <FileText size={16} />
                      Verified {m.documentAnalysis.documentType === 'prescription' ? 'Prescription Extraction' : 'Diagnostic Report Analysis'}
                    </div>

                    {/* Prescription Structured Extraction */}
                    {m.documentAnalysis.medicines && m.documentAnalysis.medicines.length > 0 && (
                      <div style={{ fontSize: '0.8rem', marginBottom: '6px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: '4px' }}>Extracted Medications:</div>
                        <ul style={{ margin: 0, paddingLeft: '18px' }}>
                          {m.documentAnalysis.medicines.map((med, medIdx) => (
                            <li key={medIdx} style={{ marginBottom: '4px' }}>
                              <strong>{med.name || 'Uncertain'}</strong> — {med.dosage || med.strength || 'Confirm with pharmacist'} ({med.frequency || 'As directed'})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Lab Report Structured Extraction */}
                    {m.documentAnalysis.labResults && m.documentAnalysis.labResults.length > 0 && (
                      <div style={{ fontSize: '0.8rem', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.76rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #cbd5e1', color: 'var(--text-muted)' }}>
                              <th style={{ padding: '4px' }}>Test</th>
                              <th style={{ padding: '4px' }}>Result</th>
                              <th style={{ padding: '4px' }}>Ref Range</th>
                              <th style={{ padding: '4px' }}>Flag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {m.documentAnalysis.labResults.map((r, rIdx) => (
                              <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '4px', fontWeight: 600 }}>{r.testName || r.name}</td>
                                <td style={{ padding: '4px' }}>{r.result || r.value} {r.unit}</td>
                                <td style={{ padding: '4px', color: 'var(--text-muted)' }}>{r.referenceRange || 'Standard'}</td>
                                <td style={{ padding: '4px' }}>
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    background: r.flag === 'abnormal' ? '#fee2e2' : '#f0fdf4',
                                    color: r.flag === 'abnormal' ? '#dc2626' : '#16a34a'
                                  }}>
                                    {r.flag || 'Normal'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Content Text */}
                <div style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>{m.content}</div>

                {/* Citations Box for Authoritative Grounding (WHO, ICMR, CDC, NICE) */}
                {m.citations && m.citations.length > 0 && (
                  <div className="chat-citation-box" style={{ marginTop: '10px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                      <BookOpen size={14} color="var(--primary)" /> Authoritative Clinical References Grounding:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {m.citations.map((c, idx) => (
                        <div key={idx} style={{ fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--navy)', fontWeight: 600 }}>• {c.sourceName}</span>
                          <span style={{ color: 'var(--text-muted)' }}>({c.authoritativeBody}, {c.publicationDate})</span>
                          {c.sourceUrl && (
                            <a
                              href={c.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                            >
                              <ExternalLink size={11} /> Source
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expandable Detailed Explanation */}
                {m.role === 'assistant' && m.clinicalBreakdown && (
                  <div className="explanation-accordion" style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      className="explanation-summary-btn"
                      onClick={() => toggleExplanation(i)}
                    >
                      <span>🔬 Clinical Breakdown & Recommended Physician Questions</span>
                      {expandedExplanations[i] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedExplanations[i] && (
                      <div className="explanation-details-body">
                        {m.clinicalBreakdown.possibleEtiologies && (
                          <div style={{ margin: '0 0 6px 0' }}>
                            <strong>Potential Physiological Context:</strong>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                              {m.clinicalBreakdown.possibleEtiologies.map((item, eIdx) => (
                                <li key={eIdx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {m.clinicalBreakdown.questionsForDoctor && (
                          <div style={{ margin: '0 0 6px 0' }}>
                            <strong>Questions to Ask Your Doctor:</strong>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                              {m.clinicalBreakdown.questionsForDoctor.map((q, qIdx) => (
                                <li key={qIdx}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {m.clinicalBreakdown.safeNextSteps && (
                          <div>
                            <strong>Safe Patient Next Steps:</strong>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                              {m.clinicalBreakdown.safeNextSteps.map((s, sIdx) => (
                                <li key={sIdx}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Assistant Voice Audio Controls & Timestamp */}
                {m.role === 'assistant' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => handleReadAloud(m.content, m.id || i)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          padding: 0
                        }}
                        title={isSpeaking && speakingMessageId === (m.id || i) ? 'Stop audio' : 'Read aloud'}
                      >
                        {isSpeaking && speakingMessageId === (m.id || i) ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        <span>{isSpeaking && speakingMessageId === (m.id || i) ? 'Stop' : 'Read aloud'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          window.speechSynthesis.cancel();
                          handleReadAloud(m.content, m.id || i);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.72rem',
                          padding: 0
                        }}
                        title="Replay spoken response"
                      >
                        <Play size={12} /> Replay
                      </button>
                    </div>

                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )}

                {m.role === 'user' && (
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px', textAlign: 'right' }}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            ))}

            {analyzingDoc && (
              <div className="chat-bubble chat-bubble-assistant" style={{ fontStyle: 'italic', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="spinner" style={{ width: '16px', height: '16px' }} />
                <span>Running optical character recognition (OCR) and analyzing medical document...</span>
              </div>
            )}

            {loading && (
              <div className="chat-bubble chat-bubble-assistant" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                Consulting medical knowledge sources & drafting guidance...
              </div>
            )}

            {errorState && (
              <div className="error-state-box" style={{ margin: '10px 0' }}>
                <span>{errorState}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSendMessage()}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RotateCcw size={12} /> Retry
                </button>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Sample Health Prompt Chips */}
          <div style={{
            padding: '8px 16px',
            background: 'var(--bg-alt)',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                className="btn btn-secondary btn-sm"
                onClick={() => handleSendMessage(p)}
                style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 'var(--radius-pill)', flexShrink: 0 }}
              >
                <Sparkles size={12} color="var(--primary)" /> {p}
              </button>
            ))}
          </div>

          {/* Attachment Preview Box */}
          {attachment && (
            <div style={{
              padding: '8px 16px',
              background: '#eff6ff',
              borderTop: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Paperclip size={14} color="var(--primary)" />
                <strong>Ready for OCR:</strong> {attachment.name} ({attachment.size})
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Hidden File Input (Accepts PDF, JPG, JPEG, PNG) */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.jpg,.jpeg,.png,image/*"
            onChange={handleFileSelect}
          />

          {/* Input Form Bar */}
          <form
            className="copilot-input-area"
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          >
            {/* Attachment Button */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              style={{ borderRadius: 'var(--radius-pill)', padding: '0 12px' }}
              title="Upload prescription or lab report for OCR analysis"
            >
              <Paperclip size={16} />
            </button>

            {/* Voice Assistant Microphone Button */}
            <button
              type="button"
              className={`btn btn-secondary ${isListening ? 'active' : ''}`}
              onClick={isListening ? stopVoiceRecording : startVoiceRecording}
              style={{
                borderRadius: 'var(--radius-pill)',
                padding: '0 12px',
                background: isListening ? '#fee2e2' : undefined,
                borderColor: isListening ? '#fca5a5' : undefined,
                color: isListening ? '#dc2626' : undefined
              }}
              title={isListening ? "Stop listening" : "Speak question (English, தமிழ், Tanglish, हिन्दी, తెలుగు)"}
            >
              <Mic size={16} />
            </button>

            <input
              type="text"
              className="form-input"
              style={{ borderRadius: 'var(--radius-pill)' }}
              placeholder={isListening ? 'Listening to speech...' : 'Ask about your medications, lab results, symptoms...'}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={loading || analyzingDoc}
            />

            <button
              type="submit"
              className="btn btn-primary"
              style={{ borderRadius: 'var(--radius-pill)', padding: '0 20px' }}
              disabled={loading || analyzingDoc || (!inputMessage.trim() && !attachment)}
            >
              <Send size={16} />
            </button>
          </form>

          {/* Voice Question Display Card - Directly BELOW the Text Bar */}
          {(isListening || (voiceTranscript && voiceTranscript.trim().length > 0)) && (
            <div
              className="voice-question-below-bar"
              style={{
                margin: '0 16px 12px 16px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-lg)',
                background: isListening ? '#fef2f2' : 'var(--primary-subtle)',
                border: `1.5px solid ${isListening ? '#fca5a5' : 'var(--primary-light)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                animation: 'fadeIn 0.2s ease-in-out'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: isListening ? '#dc2626' : 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: isListening ? '0 0 0 4px rgba(220, 38, 38, 0.2)' : 'none'
                }}>
                  <Mic size={16} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: isListening ? '#dc2626' : 'var(--teal-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isListening ? (
                      <>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' }} />
                        LISTENING TO VOICE QUESTION (Speak in {SUPPORTED_LANGUAGES.find(l => l.code === language)?.name || 'English'})...
                      </>
                    ) : (
                      '🎙️ SPOKEN VOICE QUESTION'
                    )}
                  </div>
                  <div style={{
                    fontSize: '0.92rem',
                    color: 'var(--navy)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    "{voiceTranscript || inputMessage}"
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {isListening ? (
                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    className="btn btn-secondary btn-sm"
                    style={{ minHeight: '32px', padding: '4px 10px', fontSize: '0.8rem', color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    <StopCircle size={14} /> Stop
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const msgToSend = voiceTranscript.trim() || inputMessage.trim();
                        if (msgToSend) {
                          handleSendMessage(msgToSend);
                          setVoiceTranscript('');
                          setInputMessage('');
                        }
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ minHeight: '32px', padding: '4px 12px', fontSize: '0.8rem' }}
                    >
                      <Send size={14} /> Send
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceTranscript('');
                        setInputMessage('');
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ minHeight: '32px', padding: '4px 8px' }}
                      title="Clear voice question"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Disclaimers & Emergency Footer */}
          <div style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '8px 14px',
            background: 'var(--bg-alt)',
            borderTop: '1px solid var(--border-light)'
          }}>
            ⚖️ <strong>Medical Disclaimer:</strong> I'm an AI health assistant, not a doctor. I can help explain health information, but a qualified healthcare professional should make medical decisions. In an emergency, call <strong>112</strong>.
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------
          Voice Assistant Modal / Interactive Speech Interface (Requirement 6)
      ------------------------------------------------------------------------ */}
      {isVoiceModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '440px', textAlign: 'center', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--navy)' }}>
                <Mic size={18} color={isListening ? '#dc2626' : 'var(--primary)'} />
                Voice Health Assistant
              </div>
              <button
                type="button"
                onClick={cancelVoiceRecording}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Pulsing Mic Wave Animation */}
            <div style={{ margin: '20px 0' }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: isListening ? '#fee2e2' : 'var(--primary-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isListening ? '0 0 0 10px rgba(239, 68, 68, 0.2)' : 'none',
                transition: 'all 0.3s ease'
              }}>
                <Mic size={32} color={isListening ? '#dc2626' : 'var(--primary)'} />
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.88rem', fontWeight: 600, color: isListening ? '#dc2626' : 'var(--navy)' }}>
                {isListening ? 'Listening... Speak your healthcare question now' : 'Ready to transcribe'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Selected Language: {SUPPORTED_LANGUAGES.find(l => l.code === language)?.name || 'English'}
              </div>
            </div>

            {/* Error or Fallback Notice */}
            {voiceError && (
              <div style={{
                padding: '8px 12px',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '0.78rem',
                marginBottom: '14px',
                textAlign: 'left'
              }}>
                {voiceError}
              </div>
            )}

            {/* Speech Transcript Preview & Editable Box */}
            <div style={{ textAlign: 'left', marginBottom: '16px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy)', marginBottom: '4px', display: 'block' }}>
                Recognized Speech (Review or edit before sending):
              </label>
              <textarea
                className="form-input"
                rows={3}
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                placeholder="Spoken words will appear here in real-time..."
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            {/* Voice Action Controls */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {isListening ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={stopVoiceRecording}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <StopCircle size={14} color="#dc2626" /> Stop Recording
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={startVoiceRecording}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Mic size={14} color="var(--primary)" /> Start Speaking
                </button>
              )}

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={confirmVoiceTranscriptAndSend}
                disabled={!voiceTranscript.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={14} /> Send to Copilot
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={cancelVoiceRecording}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------
          Saved Documents Picker Modal (Requirement 7)
      ------------------------------------------------------------------------ */}
      {isSavedDocsOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--navy)' }}>
                <FolderOpen size={18} color="var(--primary)" />
                Select a Saved Document to Discuss
              </div>
              <button
                type="button"
                onClick={() => setIsSavedDocsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {userSavedDocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                <FileText size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No personal health documents uploaded yet.</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem' }}>Attach a prescription or report using the paperclip button below.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                {userSavedDocs.map(d => (
                  <div
                    key={d.id}
                    onClick={() => handleSelectSavedDocument(d)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-alt)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
                  >
                    <div>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--navy)' }}>{d.title}</strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {d.documentType?.toUpperCase()} • Uploaded on {d.uploadedAt}
                      </div>
                    </div>
                    <button type="button" className="btn btn-outline-primary btn-sm" style={{ fontSize: '0.75rem' }}>
                      Ask Copilot
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
