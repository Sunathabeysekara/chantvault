import React from 'react';
import { HeartHandshake, Phone, MessageSquare, Shield, X, ExternalLink } from 'lucide-react';

interface CrisisSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CrisisSupportModal: React.FC<CrisisSupportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Life Sanctuary &amp; Immediate Support
            </h2>
            <p className="text-xs text-zinc-400">
              You are not alone. Confidential, free, and 24/7 human care is available.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300">Suicide &amp; Crisis Lifeline (US &amp; Canada)</span>
              <span className="text-xs font-mono font-bold text-white bg-rose-900/40 px-2 py-0.5 rounded">Call or Text 988</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Free, confidential emotional support available 24/7.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300">Crisis Text Line</span>
              <span className="text-xs font-mono font-bold text-white bg-indigo-900/40 px-2 py-0.5 rounded">Text HOME to 741741</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Connect with a trained crisis counselor via SMS anytime.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300">International Helplines</span>
              <span className="text-xs font-mono text-emerald-400">Befrienders Worldwide</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Find free confidential emotional support in over 32 countries globally.
            </p>
          </div>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium"
          >
            I Understand &amp; Return to Sanctuary
          </button>
        </div>
      </div>
    </div>
  );
};
