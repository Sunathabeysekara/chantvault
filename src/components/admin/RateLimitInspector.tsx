import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RotateCcw, 
  Lock, 
  RefreshCw, 
  AlertTriangle, 
  Users, 
  CheckCircle2, 
  Activity,
  Flame
} from 'lucide-react';
import { RateLimitStats } from '../../types.ts';

interface RateLimitInspectorProps {
  token: string;
}

export const RateLimitInspector: React.FC<RateLimitInspectorProps> = ({ token }) => {
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/rate-limits', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load rate limits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleResetLimits = async (targetIp?: string) => {
    const confirmMsg = targetIp 
      ? `Reset rate limit bucket for ${targetIp}?` 
      : 'Reset all active rate limit trackers across the platform?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const res = await fetch('/api/admin/rate-limits/reset', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ ip: targetIp })
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice(data.message);
        fetchStats();
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err: any) {
      setActionNotice('Reset failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const configuredLimits = [
    {
      name: 'Admin Passkey Authentication',
      limit: '5 attempts / 15 mins',
      penalty: '15 min lockout',
      purpose: 'Brute-force protection on /adminloginsecret',
      badgeColor: 'border-red-500/30 bg-red-500/10 text-red-300'
    },
    {
      name: 'Anonymous Chant Creation',
      limit: '12 chants / 5 mins',
      penalty: '5 min cooldown',
      purpose: 'Spam prevention on public whispers',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    },
    {
      name: 'Whisper Comments',
      limit: '25 comments / 5 mins',
      penalty: '3 min cooldown',
      purpose: 'Bot harassment suppression',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
    },
    {
      name: 'Encrypted Group Creation',
      limit: '8 rooms / 10 mins',
      penalty: '5 min cooldown',
      purpose: 'Vault proliferation control',
      badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-300'
    },
    {
      name: 'Encrypted Message Sending',
      limit: '45 messages / 1 min',
      penalty: '1 min pause',
      purpose: 'Flood control inside E2EE rooms',
      badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    },
    {
      name: 'Content Reporting',
      limit: '10 reports / 5 mins',
      penalty: '5 min cooldown',
      purpose: 'Prevent report brigading',
      badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-300'
    },
    {
      name: 'General API Traffic',
      limit: '200 requests / 1 min',
      penalty: '30 sec slowdown',
      purpose: 'DDoS & scraping shield on all /api endpoints',
      badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Overview & Security Shield */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/50 text-purple-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Rate Limiting &amp; Anti-Abuse Defenses</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Active Enforcing
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Layered IP-based token buckets guarding against brute-force passkey guessing, message flooding, and denial of service.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleResetLimits()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors"
            title="Reset all in-memory rate limit records"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset All Limits</span>
          </button>

          <button
            onClick={fetchStats}
            className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-zinc-900 border border-emerald-700/60 text-emerald-300 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Metrics Header */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Total Blocked Security Events</span>
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-extrabold text-red-400">
              {stats.totalBlockedEvents}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-1">
              Requests blocked with HTTP 429
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Active Tracked Clients</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              {stats.activeRateLimitedClients.length}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-1">
              Currently in active rate windows
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Security Shield Status</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              7 Active Policies
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-1">
              Zero IP leaks • In-Memory Store
            </div>
          </div>
        </div>
      )}

      {/* Configured Rate Limiting Policies */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <span>Active Policy Boundaries</span>
          <span className="text-xs font-normal text-zinc-500">({configuredLimits.length} enforcers)</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {configuredLimits.map((policy, idx) => (
            <div key={idx} className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800/80 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-xs text-zinc-200">{policy.name}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${policy.badgeColor}`}>
                  {policy.limit}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">{policy.purpose}</p>
              <div className="text-[10px] text-zinc-500 font-mono pt-1 border-t border-zinc-800/60">
                Penalty: <span className="text-amber-400">{policy.penalty}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Tracked IPs Table */}
      {stats && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden space-y-0">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-zinc-400" />
              <h4 className="text-sm font-bold text-white">Active Rate Limited Clients</h4>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              {stats.activeRateLimitedClients.length} tracked records
            </span>
          </div>

          {stats.activeRateLimitedClients.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">
              No clients are currently reaching rate limits. All requests operating smoothly.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-zinc-300">
                <thead className="bg-zinc-950 text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Client IP</th>
                    <th className="px-4 py-2.5 font-medium">Policy</th>
                    <th className="px-4 py-2.5 font-medium">Hits in Window</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {stats.activeRateLimitedClients.map((client, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-2.5 font-semibold text-zinc-200">
                        {client.ip}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-300">
                        {client.limiter}
                      </td>
                      <td className="px-4 py-2.5 text-amber-400 font-bold">
                        {client.count}
                      </td>
                      <td className="px-4 py-2.5">
                        {client.blockedUntil ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-red-950 text-red-400 border border-red-800 font-bold">
                            Blocked
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400">
                            Monitoring
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleResetLimits(client.ip)}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                        >
                          Clear IP
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
