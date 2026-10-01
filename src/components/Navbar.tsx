import React from 'react';
import { 
  Shield, 
  MessageSquareLock, 
  Flame, 
  EyeOff,
  Radio
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'chants' | 'groups';
  setActiveTab: (tab: 'chants' | 'groups') => void;
  onPanicPurge: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onPanicPurge }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('chants')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-emerald-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-zinc-100 tracking-tight">ChantVault</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 mr-1 animate-pulse" /> E2EE Active
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Anonymous Whistleblower &amp; Life Sanctuary
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('chants')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'chants'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Whispers</span>
            </button>

            <button
              onClick={() => setActiveTab('groups')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'groups'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <MessageSquareLock className="w-4 h-4 text-indigo-400" />
              <span>Encrypted Groups</span>
            </button>
          </nav>

          {/* Panic / Quick Privacy Action */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPanicPurge}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-red-950/40 text-red-300 border border-red-800/40 hover:bg-red-900/60 hover:text-red-100 transition-all shadow-sm"
              title="Instantly purges local encryption keys from memory and locks active chats"
            >
              <EyeOff className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Purge Keys</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
