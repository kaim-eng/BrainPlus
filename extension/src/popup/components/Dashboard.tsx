import React, { useState } from 'react';
import type { UserPreferences } from '@/lib/types';
import { SecondBrain } from './SecondBrain';
import { ResumeCard } from './ResumeCard';
import { AMA } from './AMA';

interface Props {
  preferences: UserPreferences;
  onNavigate: (view: 'dashboard' | 'settings') => void;
}

const Dashboard: React.FC<Props> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'ama'>('search');

  return (
    <>
      <div className="header">
        <h1>🧠 BrainPlus</h1>
        <div className="header-actions">
          <button className="secondary" onClick={() => onNavigate('settings')}>
            Settings
          </button>
        </div>
      </div>

      {/* Task Continuation Card (appears when session available) */}
      <ResumeCard />

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          🔍 Search
        </button>
        <button
          className={`tab-button ${activeTab === 'ama' ? 'active' : ''}`}
          onClick={() => setActiveTab('ama')}
        >
          🤖 Ask Me Anything
        </button>
      </div>

      {/* Content */}
      {activeTab === 'search' && <SecondBrain />}
      {activeTab === 'ama' && <AMA />}
    </>
  );
};

export default Dashboard;

