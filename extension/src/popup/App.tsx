import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Onboarding from './components/Onboarding';
import { getLocal, setLocal } from '@/lib/storage';
import { STORAGE_KEYS } from '@/lib/constants';
import type { UserPreferences } from '@/lib/types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings' | 'onboarding'>('dashboard');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await getLocal<UserPreferences>(STORAGE_KEYS.PREFERENCES);
      setPreferences(prefs);
      
      // Show onboarding if not completed
      if (prefs && !prefs.onboardingCompleted) {
        setCurrentView('onboarding');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async () => {
    if (preferences) {
      const updated = { ...preferences, onboardingCompleted: true };
      await setLocal(STORAGE_KEYS.PREFERENCES, updated);
      setPreferences(updated);
      setCurrentView('dashboard');
    }
  };

  const handleUpdatePreferences = async (updated: UserPreferences) => {
    await setLocal(STORAGE_KEYS.PREFERENCES, updated);
    setPreferences(updated);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app" data-theme={preferences?.theme || 'auto'}>
      {currentView === 'onboarding' && (
        <Onboarding 
          preferences={preferences!} 
          onComplete={handleOnboardingComplete} 
        />
      )}
      
      {currentView === 'dashboard' && (
        <Dashboard 
          preferences={preferences!}
          onNavigate={setCurrentView}
        />
      )}
      
      {currentView === 'settings' && (
        <Settings 
          preferences={preferences!}
          onUpdate={handleUpdatePreferences}
          onBack={() => setCurrentView('dashboard')}
        />
      )}
    </div>
  );
};

export default App;

