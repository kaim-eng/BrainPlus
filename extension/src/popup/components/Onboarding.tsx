import React from 'react';
import type { UserPreferences } from '@/lib/types';

interface Props {
  preferences: UserPreferences;
  onComplete: () => void;
}

const Onboarding: React.FC<Props> = ({ preferences, onComplete }) => {
  return (
    <div className="onboarding">
      <h2>Welcome to BrainPlus! 🧠✨</h2>
      
      <p>
        Your AI-powered knowledge assistant that captures and organizes your browsing history
        with semantic search and Ask Me Anything capabilities - all stored locally on your device.
      </p>

      {preferences.isBraveUser && (
        <div className="brave-tips">
          <h3>🦁 Using Brave?</h3>
          <ul>
            <li>✅ Extension works out of the box</li>
            <li>💡 For private windows: <code>brave://extensions</code> → "Allow in private"</li>
            <li>🔒 We respect your privacy: all data stays local</li>
          </ul>
        </div>
      )}

      <div style={{ marginTop: '32px' }}>
        <h3>Key Features:</h3>
        <ol style={{ textAlign: 'left', lineHeight: '1.8' }}>
          <li>🔍 <strong>Semantic Search</strong>: Find pages by meaning, not just keywords</li>
          <li>🤖 <strong>Ask Me Anything</strong>: Query your browsing history with natural language</li>
          <li>🔐 <strong>Privacy-First</strong>: 75+ sensitive domains blocked (banking, healthcare, email)</li>
          <li>💾 <strong>Local Storage</strong>: All data stays on your device (IndexedDB)</li>
          <li>⚡ <strong>Fast Retrieval</strong>: Passage-level search with hybrid ranking</li>
        </ol>
      </div>

      <button 
        onClick={onComplete}
        style={{ marginTop: '24px', padding: '12px 32px', fontSize: '16px' }}
      >
        Get Started
      </button>

      <p style={{ fontSize: '12px', marginTop: '24px' }}>
        All your browsing data is stored locally. No data is sent to external servers.
      </p>
    </div>
  );
};

export default Onboarding;

