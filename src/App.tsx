/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { ChantsFeed } from './components/ChantsFeed.tsx';
import { EncryptedGroups } from './components/EncryptedGroups.tsx';
import { SecretAdminPage } from './components/SecretAdminPage.tsx';
import { CrisisSupportModal } from './components/CrisisSupportModal.tsx';
import { clearAllRoomKeys } from './utils/crypto.ts';
import { 
  HeartHandshake, 
  Database, 
  Lock, 
  EyeOff, 
  CheckCheck
} from 'lucide-react';
import { trackPageView, trackInteraction } from './utils/analytics.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chants' | 'groups'>('chants');
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [isCrisisModalOpen, setIsCrisisModalOpen] = useState(false);
  const [purgeNotice, setPurgeNotice] = useState<string | null>(null);

  // Check URL pathname for /adminloginsecret on mount and popstate
  useEffect(() => {
    const checkAdminRoute = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (
        path === '/adminloginsecret' ||
        path.startsWith('/adminloginsecret') ||
        hash === '#adminloginsecret' ||
        search.includes('adminloginsecret')
      ) {
        setIsAdminRoute(true);
        trackPageView('/adminloginsecret', 'Secret Admin Portal', 'Secret Admin Login Path');
      } else {
        setIsAdminRoute(false);
      }
    };

    checkAdminRoute();
    window.addEventListener('popstate', checkAdminRoute);
    window.addEventListener('hashchange', checkAdminRoute);

    return () => {
      window.removeEventListener('popstate', checkAdminRoute);
      window.removeEventListener('hashchange', checkAdminRoute);
    };
  }, []);

  // Track page views on tab switch
  useEffect(() => {
    if (isAdminRoute) return;
    if (activeTab === 'chants') {
      trackPageView('/', 'Whispers Feed', 'Public Whispers Tab');
    } else if (activeTab === 'groups') {
      trackPageView('/groups', 'Encrypted Groups', 'Encrypted Groups Tab');
    }
  }, [activeTab, isAdminRoute]);

  const handlePanicPurge = () => {
    clearAllRoomKeys();
    trackInteraction('privacy_action', 'panic:purge_keys', 'Triggered Emergency Key Purge');
    setPurgeNotice('🔒 Emergency Purge: All in-memory E2EE keys have been wiped from this session.');
    setActiveTab('chants');
    setTimeout(() => {
      setPurgeNotice(null);
    }, 4000);
  };

  const handleOpenCrisisModal = () => {
    setIsCrisisModalOpen(true);
    trackPageView('/crisis-helpline', 'Crisis Helpline Resources', 'Immediate Crisis Helpline Modal', {
      category: 'helpline_action',
      action_target: 'modal:open_crisis_support',
      label: 'Opened Immediate Crisis Support'
    });
  };

  // If user navigated to /adminloginsecret
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-red-500/30 selection:text-red-200">
        <SecretAdminPage 
          onExit={() => {
            window.history.pushState({}, '', '/');
            setIsAdminRoute(false);
          }} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Purge / Panic Notice Toast */}
      {purgeNotice && (
        <div className="fixed top-18 right-4 z-50 p-4 rounded-2xl bg-red-950/90 border border-red-700/80 text-red-200 text-xs font-mono shadow-2xl flex items-center gap-2 animate-bounce">
          <EyeOff className="w-4 h-4 text-red-400 shrink-0" />
          <span>{purgeNotice}</span>
        </div>
      )}

      {/* Main Navigation */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onPanicPurge={handlePanicPurge} 
      />

      {/* Main Viewport */}
      <main className="flex-1 pb-16">
        {activeTab === 'chants' && (
          <ChantsFeed />
        )}

        {activeTab === 'groups' && (
          <EncryptedGroups 
            onPanicPurge={handlePanicPurge}
          />
        )}
      </main>

      {/* Sanctuary & Crisis Support Floating Footer Bar */}
      <footer className="border-t border-zinc-900 bg-zinc-950/90 py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>Persistent Storage</span>
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>AES-256-GCM Zero-Knowledge E2EE</span>
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Read Receipts Enabled</span>
            </span>
          </div>

          {/* <div className="flex items-center gap-3"> */}
            {/* <button
              onClick={handleOpenCrisisModal}
              className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-medium transition-colors"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Immediate Crisis Helpline Resources</span>
            </button> */}
          {/* </div> */}
        </div>
      </footer>

      {/* Crisis Helpline Modal */}
      <CrisisSupportModal 
        isOpen={isCrisisModalOpen} 
        onClose={() => setIsCrisisModalOpen(false)} 
      />
    </div>
  );
}
