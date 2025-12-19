import React, { useEffect, useState } from 'react';

interface TaskSession {
  id: string;
  title: string;
  pageIds: string[];
  pageCount: number;
  coherenceScore: number;
  firstTimestamp: number;
  lastTimestamp: number;
  category: string;
  entities: string[];
  createdAt: number;
  dismissed: boolean;
}

interface PendingSession {
  session: TaskSession;
  detectedAt: number;
}

const TAB_CAP_WARNING = 10;

export const ResumeCard: React.FC = () => {
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadPendingSession();
  }, []);
  
  const loadPendingSession = async () => {
    try {
      const session = await chrome.runtime.sendMessage({
        type: 'GET_PENDING_SESSION',
      });
      setPendingSession(session);
    } catch (error) {
      console.error('[ResumeCard] Failed to load session:', error);
    }
  };
  
  const handleResume = async (limitCount?: number) => {
    if (!pendingSession) return;
    
    // CRITICAL FIX #4: Show confirmation for large sessions
    if (!limitCount && pendingSession.session.pageCount > TAB_CAP_WARNING) {
      const confirmed = window.confirm(
        `This will open ${pendingSession.session.pageCount} tabs. Continue?\n\n` +
        `Tip: Use "Resume Top ${TAB_CAP_WARNING}" to open fewer tabs.`
      );
      if (!confirmed) return;
    }
    
    setLoading(true);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'RESUME_SESSION',
        sessionId: pendingSession.session.id,
        limitCount,
      });
      
      if (result.success) {
        // Show success with details
        if (result.skippedCount > 0) {
          alert(
            `✅ Opened ${result.openedCount} tabs\n\n` +
            `⚠️ ${result.skippedCount} older pages couldn't be restored (from before this update).`
          );
        }
        setPendingSession(null);
      } else {
        // Show error message
        alert(`❌ ${result.message || 'Failed to resume session'}`);
      }
    } catch (error) {
      console.error('[ResumeCard] Resume failed:', error);
      alert('❌ Failed to resume session. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDismiss = async () => {
    if (!pendingSession) return;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'DISMISS_SESSION',
        sessionId: pendingSession.session.id,
      });
      setPendingSession(null);
    } catch (error) {
      console.error('[ResumeCard] Dismiss failed:', error);
    }
  };
  
  if (!pendingSession) {
    return null;
  }
  
  const session = pendingSession.session;
  const ageMinutes = Math.floor((Date.now() - session.lastTimestamp) / (1000 * 60));
  const hasMany = session.pageCount > TAB_CAP_WARNING;
  
  // Coherence indicator
  const coherenceLevel = session.coherenceScore >= 0.85 ? 'high' : 
                         session.coherenceScore >= 0.70 ? 'medium' : 'low';
  const coherenceColor = coherenceLevel === 'high' ? '#4CAF50' : 
                          coherenceLevel === 'medium' ? '#FFC107' : '#FF9800';
  const coherenceLabel = coherenceLevel === 'high' ? 'Focused' : 'Exploratory';
  
  return (
    <div className="resume-card">
      <div className="resume-header">
        <div className="resume-icon">🔄</div>
        <div className="resume-title">
          <h3>{session.title}</h3>
          <p className="resume-meta">
            {session.pageCount} pages • {ageMinutes}m ago
          </p>
        </div>
        <button className="dismiss-btn" onClick={handleDismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
      
      <div className="coherence-indicator">
        <div className="coherence-bar" style={{ backgroundColor: coherenceColor }} />
        <span className="coherence-label">{coherenceLabel} Session</span>
      </div>
      
      <div className="resume-entities">
        {session.entities.slice(0, 3).map((entity, i) => (
          <span key={i} className="entity-tag">{entity}</span>
        ))}
      </div>
      
      {/* CRITICAL FIX #4: Tab cap warning */}
      {hasMany && (
        <div className="tab-warning">
          ⚠️ Large session ({session.pageCount} tabs)
        </div>
      )}
      
      {/* Action buttons with tab cap options */}
      <div className="resume-actions">
        {hasMany ? (
          <>
            <button 
              className="resume-btn primary" 
              onClick={() => handleResume(TAB_CAP_WARNING)}
              disabled={loading}
            >
              Resume Top {TAB_CAP_WARNING}
            </button>
            <button 
              className="resume-btn secondary" 
              onClick={() => handleResume()}
              disabled={loading}
            >
              Resume All ({session.pageCount})
            </button>
          </>
        ) : (
          <button 
            className="resume-btn primary" 
            onClick={() => handleResume()}
            disabled={loading}
          >
            {loading ? 'Opening...' : `Resume ${session.pageCount} Tabs`}
          </button>
        )}
      </div>
    </div>
  );
};

export default ResumeCard;

