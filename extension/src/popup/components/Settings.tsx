import React from 'react';
import type { UserPreferences } from '@/lib/types';

interface Props {
  preferences: UserPreferences;
  onUpdate: (preferences: UserPreferences) => void;
  onBack: () => void;
}

const Settings: React.FC<Props> = ({ preferences, onUpdate, onBack }) => {
  const handleToggle = (key: keyof UserPreferences['privacy']) => {
    const updated = {
      ...preferences,
      privacy: {
        ...preferences.privacy,
        [key]: !preferences.privacy[key],
      },
    };
    onUpdate(updated);
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    const updated = { ...preferences, theme };
    onUpdate(updated);
  };

  return (
    <>
      <div className="header">
        <button className="secondary" onClick={onBack}>← Back</button>
        <h1>Settings</h1>
      </div>

      <div className="settings">
        <div className="setting-group">
          <h3>Privacy</h3>
          
          <div className="setting-item">
            <div>
              <div className="setting-label">Enable Tracking</div>
              <div className="setting-description">Collect browsing data for rewards</div>
            </div>
            <div 
              className={`toggle ${preferences.privacy.trackingEnabled ? 'active' : ''}`}
              onClick={() => handleToggle('trackingEnabled')}
            >
              <div className="toggle-handle" />
            </div>
          </div>

          <div className="setting-item">
            <div>
              <div className="setting-label">Suppress Rare Categories</div>
              <div className="setting-description">Enhanced k-anonymity protection</div>
            </div>
            <div 
              className={`toggle ${preferences.privacy.suppressRareCategories ? 'active' : ''}`}
              onClick={() => handleToggle('suppressRareCategories')}
            >
              <div className="toggle-handle" />
            </div>
          </div>
        </div>

        <div className="setting-group">
          <h3>Appearance</h3>
          
          <div className="setting-item">
            <div className="setting-label">Theme</div>
            <select 
              value={preferences.theme}
              onChange={(e) => handleThemeChange(e.target.value as any)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        <div className="setting-group">
          <h3>Notifications</h3>
          
          <div className="setting-item">
            <div>
              <div className="setting-label">Enable Notifications</div>
              <div className="setting-description">Get notified about deals and earnings</div>
            </div>
            <div 
              className={`toggle ${preferences.notificationsEnabled ? 'active' : ''}`}
              onClick={() => {
                const updated = {
                  ...preferences,
                  notificationsEnabled: !preferences.notificationsEnabled,
                };
                onUpdate(updated);
              }}
            >
              <div className="toggle-handle" />
            </div>
          </div>
        </div>

        <div className="setting-group">
          <h3>About</h3>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <p>DataPay Assist v1.0.0</p>
            <p>Privacy-preserving browsing data monetization</p>
            <p>
              {preferences.isBraveUser && '🦁 Brave Browser Detected'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;

