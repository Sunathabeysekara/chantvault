import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  Unlock, 
  Trash2, 
  Eye, 
  EyeOff, 
  Database, 
  Terminal, 
  AlertTriangle, 
  CheckCircle, 
  LogOut, 
  RefreshCw, 
  ArrowLeft,
  FileText,
  Search,
  SlidersHorizontal,
  FolderLock,
  BarChart3,
  ShieldCheck,
  Activity,
  Users
} from 'lucide-react';
import { Chant, AdminStats, ReportItem } from '../types.ts';
import { AnalyticsDashboard } from './admin/AnalyticsDashboard.tsx';
import { ErrorLogsViewer } from './admin/ErrorLogsViewer.tsx';
import { RateLimitInspector } from './admin/RateLimitInspector.tsx';

interface SecretAdminPageProps {
  onExit: () => void;
}

export const SecretAdminPage: React.FC<SecretAdminPageProps> = ({ onExit }) => {
  const [passkeyInput, setPasskeyInput] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin Dashboard State
  const [activeTab, setActiveTab] = useState<'chants' | 'reports' | 'analytics' | 'errorLogs' | 'rateLimits' | 'sql' | 'logs'>('chants');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [allChants, setAllChants] = useState<Chant[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [filterHiddenOnly, setFilterHiddenOnly] = useState(false);

  // SQL Console
  const [sqlQuery, setSqlQuery] = useState('SELECT id, title, author_alias, topic, is_hidden, created_at FROM chants ORDER BY created_at DESC LIMIT 10;');
  const [sqlResults, setSqlResults] = useState<any[] | null>(null);
  const [sqlMessage, setSqlMessage] = useState<string | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  useEffect(() => {
    // Check if session token exists
    const savedToken = sessionStorage.getItem('chantvault_admin_token');
    if (savedToken) {
      setToken(savedToken);
      fetchAdminData(savedToken);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkeyInput.trim()) return;

    try {
      setIsLoggingIn(true);
      setLoginError(null);
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: passkeyInput.trim() })
      });

      const data = await res.json();
      if (data.success && data.token) {
        setToken(data.token);
        sessionStorage.setItem('chantvault_admin_token', data.token);
        fetchAdminData(data.token);
      } else {
        setLoginError(data.error || 'Invalid administrative passkey.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('chantvault_admin_token');
    setToken(null);
    onExit();
  };

  const fetchAdminData = async (authToken: string) => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${authToken}` };

      // Overview
      const resOverview = await fetch('/api/admin/overview', { headers });
      const dataOverview = await resOverview.json();
      if (dataOverview.success) {
        setStats(dataOverview.stats);
        setReports(dataOverview.reports || []);
        setAuditLogs(dataOverview.auditLogs || []);
      }

      // All Chants
      const resChants = await fetch('/api/admin/all-chants', { headers });
      const dataChants = await resChants.json();
      if (dataChants.success) {
        setAllChants(dataChants.chants);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHideChant = async (chantId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/chants/${chantId}/toggle-hide`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAllChants(prev => prev.map(c => c.id === chantId ? { ...c, is_hidden: data.is_hidden } : c));
        fetchAdminData(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteChant = async (chantId: string) => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to permanently delete this chant?')) return;

    try {
      const res = await fetch(`/api/admin/chants/${chantId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAllChants(prev => prev.filter(c => c.id !== chantId));
        fetchAdminData(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteSql = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !sqlQuery.trim()) return;

    try {
      setIsExecutingSql(true);
      setSqlMessage(null);
      setSqlResults(null);

      const res = await fetch('/api/admin/execute-sql', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sql: sqlQuery.trim() })
      });

      const data = await res.json();
      if (data.success) {
        if (data.rows) {
          setSqlResults(data.rows);
          setSqlMessage(`Retrieved ${data.rowCount} rows from database.`);
        } else {
          setSqlMessage(data.message || 'SQL executed successfully');
        }
      } else {
        setSqlMessage('Error: ' + data.error);
      }
    } catch (err: any) {
      setSqlMessage('Execution error: ' + err.message);
    } finally {
      setIsExecutingSql(false);
    }
  };

  const handleResolveReport = async (reportId: string, status: string) => {
    if (!token) return;
    try {
      await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      fetchAdminData(token);
    } catch (err) {
      console.error(err);
    }
  };

  // If unauthenticated: Secret Passkey Login screen
  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />

          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-400 flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Secret Administrative Access
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              Restricted URL endpoint: <code className="text-red-400">/adminloginsecret</code>
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Administrative Passkey
              </label>
              <input
                type="password"
                placeholder="Enter secret passkey..."
                value={passkeyInput}
                onChange={(e) => setPasskeyInput(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs font-mono focus:outline-none focus:border-red-500"
              />
              {/* <p className="text-[11px] text-zinc-500 font-mono mt-1">
                Default configured passkey: <code className="text-zinc-400">shadowvault2026</code>
              </p> */}
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              {isLoggingIn ? 'Authenticating...' : 'Enter Secret Console'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-zinc-800">
            <button
              onClick={onExit}
              className="text-xs text-zinc-400 hover:text-white flex items-center justify-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Public Whispers</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filtered chants
  const filteredChants = allChants.filter(c => {
    if (filterHiddenOnly && c.is_hidden !== 1) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q) ||
        c.author_alias.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-zinc-900 border border-red-900/50 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">ChantVault Administrative Console</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-300 border border-red-500/30">
                Hidden Route Active
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Manage content, inspect storage, hide or delete entries, and audit compliance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => token && fetchAdminData(token)}
            className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 text-xs"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-red-400 text-xs font-mono transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Lock &amp; Exit Admin</span>
          </button>
        </div>
      </div>

      {/* Database Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 block">Total Chants</span>
            <span className="text-xl font-bold text-zinc-100">{stats.totalChants}</span>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 block">Hidden Chants</span>
            <span className="text-xl font-bold text-amber-400">{stats.hiddenChants}</span>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 block">Encrypted Groups</span>
            <span className="text-xl font-bold text-indigo-400">{stats.totalGroups}</span>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 block">Group Messages</span>
            <span className="text-xl font-bold text-emerald-400">{stats.totalMessages}</span>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 block">Pending Reports</span>
            <span className={`text-xl font-bold ${stats.pendingReports > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
              {stats.pendingReports}
            </span>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 block">Page Visits</span>
            <span className="text-xl font-bold text-cyan-400">{stats.totalVisits ?? 0}</span>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 block">Unique Users</span>
            <span className="text-xl font-bold text-purple-400">{stats.uniqueVisitors ?? 0}</span>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1">
            <span className="text-[11px] font-mono text-zinc-500 block">DB File Size</span>
            <span className="text-xl font-bold text-zinc-200">{stats.dbFileSizeKb} KB</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('chants')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'chants'
              ? 'bg-zinc-100 text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Whispers ({allChants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'reports'
              ? 'bg-zinc-100 text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Reports ({reports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          <span>Traffic &amp; Popularity</span>
        </button>

        <button
          onClick={() => setActiveTab('errorLogs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'errorLogs'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <FileText className="w-4 h-4 text-red-400" />
          <span>System Error Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('rateLimits')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'rateLimits'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-purple-400" />
          <span>Rate Limits &amp; Shields</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'sql'
              ? 'bg-zinc-100 text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span>Console</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'logs'
              ? 'bg-zinc-100 text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>
      </div>

      {/* Tab: Chants Moderation */}
      {activeTab === 'chants' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Filter by title, content, alias..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={filterHiddenOnly}
                onChange={(e) => setFilterHiddenOnly(e.target.checked)}
                className="rounded bg-zinc-950 border-zinc-800 text-red-600"
              />
              <span>Show Hidden Chants Only</span>
            </label>
          </div>

          {/* Table / List */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="divide-y divide-zinc-800">
              {filteredChants.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                  No chants match filter criteria.
                </div>
              ) : (
                filteredChants.map((chant) => (
                  <div key={chant.id} className="p-4 hover:bg-zinc-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-zinc-200">
                          {chant.author_alias}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {chant.topic}
                        </span>
                        {chant.is_hidden === 1 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-300 border border-red-500/30">
                            <EyeOff className="w-3 h-3" /> HIDDEN FROM PUBLIC
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                            <Eye className="w-3 h-3" /> VISIBLE
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ID: #{chant.id.slice(-6)}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-zinc-100">{chant.title}</h4>
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {chant.content}
                      </p>
                    </div>

                    {/* Admin Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleHideChant(chant.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                          chant.is_hidden === 1
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/80'
                            : 'bg-amber-950/60 text-amber-300 border border-amber-800/60 hover:bg-amber-900/80'
                        }`}
                      >
                        {chant.is_hidden === 1 ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{chant.is_hidden === 1 ? 'Unhide' : 'Hide'}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteChant(chant.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-950/60 text-red-300 border border-red-800/60 hover:bg-red-900/80 text-xs font-mono"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
            {reports.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                No user reports recorded.
              </div>
            ) : (
              reports.map((rep) => (
                <div key={rep.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-400">{rep.reason}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        Target: {rep.content_type} #{rep.content_id}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        rep.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {rep.status}
                      </span>
                    </div>
                    {rep.details && (
                      <p className="text-xs text-zinc-400">{rep.details}</p>
                    )}
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Logged: {new Date(rep.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {rep.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleResolveReport(rep.id, 'resolved')}
                          className="px-3 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 text-xs font-mono hover:bg-emerald-900"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleResolveReport(rep.id, 'dismissed')}
                          className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-mono hover:bg-zinc-700"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Console */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          <form onSubmit={handleExecuteSql} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-1.5">
                <Terminal className="w-4 h-4" />
                <span>Execute SQL Command.</span>
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                Direct Access
              </span>
            </div>

            <textarea
              rows={4}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
            />

            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSqlQuery('SELECT COUNT(*) as chant_count, topic FROM chants GROUP BY topic;')}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Topic Counts
                </button>
                <button
                  type="button"
                  onClick={() => setSqlQuery('SELECT id, name, topic, encryption_passphrase, passphrase_hash, member_count FROM chat_groups;')}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Encrypted Groups &amp; Keys
                </button>
                <button
                  type="button"
                  onClick={() => setSqlQuery('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 10;')}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Recent Audit Logs
                </button>
              </div>

              <button
                type="submit"
                disabled={isExecutingSql}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold"
              >
                {isExecutingSql ? 'Running...' : 'Execute SQL'}
              </button>
            </div>
          </form>

          {sqlMessage && (
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
              {sqlMessage}
            </div>
          )}

          {sqlResults && sqlResults.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-zinc-300">
                <thead className="bg-zinc-950 text-zinc-500 border-b border-zinc-800">
                  <tr>
                    {Object.keys(sqlResults[0]).map((key) => (
                      <th key={key} className="px-4 py-2 font-medium">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {sqlResults.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/40">
                      {Object.values(row).map((val: any, vIdx) => (
                        <td key={vIdx} className="px-4 py-2 whitespace-nowrap max-w-xs truncate">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Analytics & Popular Options */}
      {activeTab === 'analytics' && token && (
        <AnalyticsDashboard token={token} />
      )}

      {/* Tab: System Error Logs File */}
      {activeTab === 'errorLogs' && token && (
        <ErrorLogsViewer token={token} />
      )}

      {/* Tab: Rate Limits & Security Shields */}
      {activeTab === 'rateLimits' && token && (
        <RateLimitInspector token={token} />
      )}

      {/* Tab: Logs */}
      {activeTab === 'logs' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">
              No audit logs recorded yet.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="font-semibold text-zinc-200">{log.action}</span>
                  <span className="text-zinc-500 ml-2">Target: {log.target_id}</span>
                  {log.note && <span className="text-zinc-400 ml-2 italic">({log.note})</span>}
                </div>
                <span className="text-zinc-500 text-[11px]">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
