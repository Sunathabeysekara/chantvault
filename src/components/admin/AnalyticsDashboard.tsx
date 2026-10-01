import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  Eye, 
  Flame, 
  TrendingUp, 
  RefreshCw, 
  Clock, 
  Compass, 
  Globe, 
  ArrowUpRight,
  Sparkles,
  Shield
} from 'lucide-react';
import { AnalyticsData } from '../../types.ts';

interface AnalyticsDashboardProps {
  token: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ token }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'all' | '7d' | '24h'>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (range: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || 'Failed to fetch analytics');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeRange);
  }, [timeRange]);

  const formatTimeAgo = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/70 border border-zinc-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>Traffic &amp; Popularity Intelligence</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300">
                Stored
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Live page visits, popular whispers/topics, and feature resonance metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Range Pills */}
          <div className="inline-flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 text-xs">
            <button
              onClick={() => setTimeRange('24h')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                timeRange === '24h'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Last 24h
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                timeRange === '7d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                timeRange === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={() => fetchAnalytics(timeRange)}
            className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
            title="Refresh traffic data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Metric Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span className="font-medium">Total Page Visits</span>
              <Eye className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">
              {data.metrics.totalVisits.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-1">
              {timeRange === '24h' ? 'Past 24 hours' : timeRange === '7d' ? 'Past 7 days' : 'Lifetime visits'}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span className="font-medium">Unique Visitors</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400">
              {data.metrics.uniqueVisitors.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-1">
              Distinct anonymized sessions
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span className="font-medium">24h Activity</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold text-cyan-300">
              {data.metrics.visits24h.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-1">
              Visits in last 24 hours
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span className="font-medium">24h Unique Visitors</span>
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-extrabold text-purple-300">
              {data.metrics.unique24h.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-1">
              Unique users today
            </div>
          </div>
        </div>
      )}

      {/* Main Insights Columns */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most Popular Pages */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Most Popular Pages &amp; Tabs</h4>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">By visits</span>
            </div>

            {data.popularPages.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-4">No page visits recorded in this range.</p>
            ) : (
              <div className="space-y-3">
                {data.popularPages.map((page, idx) => {
                  const maxCount = data.popularPages[0]?.visit_count || 1;
                  const barWidth = Math.max(8, Math.round((page.visit_count / maxCount) * 100));

                  return (
                    <div key={idx} className="space-y-1.5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-zinc-800 text-zinc-400 font-mono text-[10px] flex items-center justify-center font-bold">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-zinc-200">{page.page_name}</span>
                          <code className="text-[10px] text-zinc-500 font-mono">{page.path}</code>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-white font-bold">{page.visit_count}</span>
                          <span className="text-[10px] text-indigo-400 font-semibold">({page.percentage}%)</span>
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Most Popular Options & Topics */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-white">Most Popular Options &amp; Actions</h4>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">By resonance</span>
            </div>

            {data.popularInteractions.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-4">No interactions recorded in this range.</p>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {data.popularInteractions.map((item, idx) => {
                  const maxInter = data.popularInteractions[0]?.interaction_count || 1;
                  const barWidth = Math.max(8, Math.round((item.interaction_count / maxInter) * 100));

                  const getBadge = (cat: string) => {
                    switch (cat) {
                      case 'topic_filter':
                        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                      case 'sort_filter':
                        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
                      case 'search_query':
                        return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
                      case 'group_action':
                        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                      case 'helpline_action':
                        return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                      case 'privacy_action':
                        return 'bg-red-500/10 text-red-300 border-red-500/20';
                      default:
                        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
                    }
                  };

                  return (
                    <div key={idx} className="bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${getBadge(item.category)}`}>
                            {item.category.replace('_', ' ')}
                          </span>
                          <span className="font-medium text-zinc-200 text-[12px]">{item.label}</span>
                        </div>
                        <span className="font-mono font-bold text-zinc-100">{item.interaction_count} hits</span>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popular Sub-options / Channels from Visits Table */}
      {data && data.popularPageOptions && data.popularPageOptions.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">Popular Navigated Channels &amp; Options</h4>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {data.popularPageOptions.map((opt, i) => (
              <div key={i} className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-zinc-300 truncate max-w-[170px]" title={opt.option_name}>
                  {opt.option_name}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[11px] font-bold shrink-0">
                  {opt.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real-Time Recent Visits Feed */}
      {data && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden space-y-0">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <h4 className="text-sm font-bold text-white">Live Page Visits Stream</h4>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              Showing recent {data.recentVisits.length} visits
            </span>
          </div>

          {data.recentVisits.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">
              No recent page visit records.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-zinc-300">
                <thead className="bg-zinc-950 text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Page Name</th>
                    <th className="px-4 py-2.5 font-medium">Path</th>
                    <th className="px-4 py-2.5 font-medium">Selected Option</th>
                    <th className="px-4 py-2.5 font-medium">Anonymous Session</th>
                    <th className="px-4 py-2.5 font-medium text-right">Visited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {data.recentVisits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-zinc-200">
                        {visit.page_name}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400">
                        <code>{visit.path}</code>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-300">
                        {visit.option_name ? (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">
                            {visit.option_name}
                          </span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-[11px]">
                        {visit.session_id}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-400 text-[11px]">
                        {formatTimeAgo(visit.created_at)}
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
