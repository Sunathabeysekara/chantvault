import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  ShieldAlert, 
  Copy, 
  Check, 
  Search, 
  ChevronDown, 
  ChevronRight,
  HardDrive,
  Flame,
  Bug
} from 'lucide-react';
import { SystemLogEntry, SystemLogStats } from '../../types.ts';

interface ErrorLogsViewerProps {
  token: string;
}

export const ErrorLogsViewer: React.FC<ErrorLogsViewerProps> = ({ token }) => {
  const [entries, setEntries] = useState<SystemLogEntry[]>([]);
  const [stats, setStats] = useState<SystemLogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchLogs = async (level = selectedLevel) => {
    try {
      setLoading(true);
      const url = `/api/admin/logs-file?limit=250${level !== 'ALL' ? `&level=${level}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(selectedLevel);
  }, [selectedLevel]);

  const handleDownload = () => {
    window.location.href = `/api/admin/logs-file/download?token=${token}`;
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear/rotate the app_errors.log file on disk?')) return;
    try {
      setLoading(true);
      const res = await fetch('/api/admin/logs-file', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage('Log file truncated and reset.');
        fetchLogs(selectedLevel);
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      setActionMessage('Failed to clear: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerTest = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/logs-file/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage('Test error & warning recorded in app_errors.log');
        fetchLogs(selectedLevel);
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      setActionMessage('Failed to trigger test: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyStack = (entry: SystemLogEntry) => {
    const text = entry.raw || `${entry.message}\n${entry.stack || ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredEntries = entries.filter(e => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      e.message.toLowerCase().includes(q) ||
      (e.stack && e.stack.toLowerCase().includes(q)) ||
      (e.route && e.route.toLowerCase().includes(q)) ||
      (e.ip && e.ip.toLowerCase().includes(q))
    );
  });

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/80 text-red-400 border border-red-800/80">
            <AlertCircle className="w-3 h-3" /> ERROR
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 text-amber-400 border border-amber-800/80">
            <AlertTriangle className="w-3 h-3" /> WARN
          </span>
        );
      case 'RATE_LIMIT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/80 text-purple-400 border border-purple-800/80">
            <ShieldAlert className="w-3 h-3" /> RATE LIMIT
          </span>
        );
      case 'SECURITY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80">
            <ShieldAlert className="w-3 h-3" /> SECURITY
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
            <Info className="w-3 h-3" /> INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & File Stats */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/50 text-red-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">System Error Logs File Inspector</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-300">
                  data/logs/app_errors.log
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Persistent on-disk log file capturing uncaught exceptions, database errors, security rejections, and rate limit blocks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleTriggerTest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors"
              title="Write a test error into app_errors.log to verify logging"
            >
              <Bug className="w-3.5 h-3.5 text-amber-400" />
              <span>Test Log</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-medium shadow-md transition-colors"
              title="Download app_errors.log to local machine"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .log</span>
            </button>

            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-red-900/60 text-zinc-300 hover:text-red-200 text-xs font-mono transition-colors"
              title="Clear/truncate the log file"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Log</span>
            </button>

            <button
              onClick={() => fetchLogs(selectedLevel)}
              className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700"
              title="Reload logs from disk"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* File Metrics Strip */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
              <span className="text-zinc-500 text-[10px] block">File Size</span>
              <span className="text-zinc-200 font-bold">{stats.fileSizeKb} KB</span>
              <span className="text-zinc-600 text-[10px] ml-1">({stats.fileSizeBytes} B)</span>
            </div>

            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
              <span className="text-zinc-500 text-[10px] block">Total Log Entries</span>
              <span className="text-zinc-200 font-bold">{stats.totalEntries}</span>
            </div>

            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
              <span className="text-zinc-500 text-[10px] block">Last Modified</span>
              <span className="text-zinc-300 text-[11px] truncate block">
                {stats.lastModified ? new Date(stats.lastModified).toLocaleTimeString() : 'N/A'}
              </span>
            </div>

            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
              <span className="text-zinc-500 text-[10px] block">Target Storage</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Disk Persisted
              </span>
            </div>
          </div>
        )}
      </div>

      {actionMessage && (
        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/70 border border-zinc-800 p-3 rounded-xl">
        {/* Level Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
          {['ALL', 'ERROR', 'WARN', 'RATE_LIMIT', 'SECURITY', 'INFO'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                selectedLevel === lvl
                  ? 'bg-zinc-100 text-zinc-950 font-bold shadow-sm'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Text Search in Log File */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search error message, route, IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Log Entries List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800/80">
        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-500 font-mono">
              {loading ? 'Reading app_errors.log...' : 'No matching error log entries found.'}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isExpanded = expandedId === entry.id;

            return (
              <div 
                key={entry.id} 
                className={`p-3.5 space-y-2 transition-colors ${
                  entry.level === 'ERROR' ? 'hover:bg-red-950/20' : 'hover:bg-zinc-800/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getLevelBadge(entry.level)}

                    <span className="text-[11px] font-mono text-zinc-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>

                    {entry.ip && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-950 text-zinc-400 border border-zinc-800">
                        IP: {entry.ip}
                      </span>
                    )}

                    {entry.route && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-950 text-indigo-300 border border-zinc-800">
                        {entry.method} {entry.route}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopyStack(entry)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                      title="Copy log entry"
                    >
                      {copiedId === entry.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {entry.stack && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                        title={isExpanded ? 'Hide stack trace' : 'View stack trace'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-200" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="font-mono text-xs text-zinc-200 break-words leading-relaxed pl-1">
                  {entry.message}
                </div>

                {/* Expanded Stack Trace */}
                {isExpanded && entry.stack && (
                  <div className="mt-2 p-3 rounded-xl bg-zinc-950 border border-red-900/40 text-[11px] font-mono text-red-300/90 whitespace-pre-wrap overflow-x-auto">
                    {entry.stack}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
