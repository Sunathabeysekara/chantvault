import React, { useState, useEffect } from 'react';
import { 
  Chant, 
  TopicCategory, 
  Comment 
} from '../types.ts';
import { trackInteraction } from '../utils/analytics.ts';
import { 
  Flame, 
  Landmark, 
  HeartHandshake, 
  Key, 
  MessageSquare, 
  Tag as TagIcon, 
  Search, 
  Plus, 
  ThumbsUp, 
  Flag, 
  ShieldCheck, 
  Image as ImageIcon, 
  X, 
  Send, 
  AlertTriangle,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const ChantsFeed: React.FC = () => {
  const [chants, setChants] = useState<Chant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<TopicCategory>('all');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');

  // Modal for new chant
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTopic, setNewTopic] = useState<TopicCategory>('government_whistleblower');
  const [newAlias, setNewAlias] = useState('');
  const [newTagsStr, setNewTagsStr] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active chant comments state
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [activeComments, setActiveComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentAlias, setCommentAlias] = useState('');

  // Flag modal
  const [flaggingChantId, setFlaggingChantId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('Safety Concern');
  const [flagDetails, setFlagDetails] = useState('');
  const [flagSubmitted, setFlagSubmitted] = useState(false);

  // Image zoom modal
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Generate random alias
  const generateRandomAlias = () => {
    const prefixes = ['Cipher', 'Shadow', 'Phantom', 'Echo', 'Whistle', 'Solitary', 'Silent', 'Nomad', 'Apex', 'Beacon'];
    const suffixes = ['Scribe', 'Observer', 'Whistleblower', 'Traveler', 'Witness', 'Seeker', 'Anchor', 'Voice', 'Sentinel'];
    const num = Math.floor(100 + Math.random() * 900);
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]}_${suffixes[Math.floor(Math.random() * suffixes.length)]}_${num}`;
  };

  useEffect(() => {
    fetchChants();
  }, [selectedTopic, selectedTag, sortBy]);

  const fetchChants = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedTopic !== 'all') params.append('topic', selectedTopic);
      if (selectedTag) params.append('tag', selectedTag);
      if (searchQuery) params.append('search', searchQuery);
      if (sortBy === 'popular') params.append('sort', 'popular');

      const res = await fetch(`/api/chants?${params.toString()}`);
      const data = await res.json();
      if (data.chants) {
        setChants(data.chants);
      }
    } catch (err) {
      console.error('Failed to load chants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      trackInteraction('search_query', 'search:' + searchQuery.trim(), 'Search: "' + searchQuery.trim() + '"');
    }
    fetchChants();
  };

  const handleLike = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/chants/${id}/like`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setChants(prev => prev.map(c => c.id === id ? { ...c, likes_count: data.likes_count } : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Image file size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateChant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      alert('Please provide both title and content.');
      return;
    }

    try {
      setIsSubmitting(true);

      const tagsArray = newTagsStr
        .split(/[,\s#]+/)
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      const res = await fetch('/api/chants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          author_alias: newAlias || generateRandomAlias(),
          topic: newTopic,
          tags: tagsArray,
          image_url: attachedImage
        })
      });

      const data = await res.json();
      if (data.success) {
        setChants(prev => [data.chant, ...prev]);
        setIsComposerOpen(false);
        setNewTitle('');
        setNewContent('');
        setNewTagsStr('');
        setAttachedImage(null);
      } else {
        alert(data.error || 'Failed to publish whisper.');
      }
    } catch (err: any) {
      alert(err.message || 'Error publishing');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Comments Handling
  const toggleComments = async (chantId: string) => {
    if (expandedCommentsId === chantId) {
      setExpandedCommentsId(null);
      return;
    }

    setExpandedCommentsId(chantId);
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/chants/${chantId}`);
      const data = await res.json();
      if (data.comments) {
        setActiveComments(data.comments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async (chantId: string) => {
    if (!newCommentText.trim()) return;
    try {
      const res = await fetch(`/api/chants/${chantId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_alias: commentAlias.trim() || generateRandomAlias(),
          content: newCommentText.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setActiveComments(prev => [...prev, data.comment]);
        setNewCommentText('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Flag submission
  const handleSubmitFlag = async () => {
    if (!flaggingChantId) return;
    try {
      const res = await fetch(`/api/chants/${flaggingChantId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: flagReason,
          details: flagDetails
        })
      });
      const data = await res.json();
      if (data.success) {
        setFlagSubmitted(true);
        setTimeout(() => {
          setFlaggingChantId(null);
          setFlagSubmitted(false);
          setFlagDetails('');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper topic labels & styling
  const getTopicMeta = (topic: string) => {
    switch (topic) {
      case 'government_whistleblower':
        return {
          label: 'Whistleblower & Leaks',
          icon: Landmark,
          badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/20'
        };
      case 'struggles':
        return {
          label: 'Life Struggles',
          icon: HeartHandshake,
          badgeColor: 'bg-rose-500/10 text-rose-300 border-rose-500/20'
        };
      case 'secrets':
        return {
          label: 'Deep Secrets',
          icon: Key,
          badgeColor: 'bg-purple-500/10 text-purple-300 border-purple-500/20'
        };
      default:
        return {
          label: 'Daily Whisper',
          icon: Flame,
          badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
        };
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Hero / Header Section */}
      <div className="relative rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 p-6 sm:p-8 border border-zinc-800 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero IP Logging • Persistent Storage • Private &amp; Secure</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Anonymous Whispers &amp; Public Transparency
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
              Disclose government secrets and corporate corruption to inform the public, or share life struggles and buried confessions in a safe sanctuary.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center shrink-0">
            <button
              onClick={() => {
                setNewAlias(generateRandomAlias());
                setIsComposerOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium text-sm hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-600/25 transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Chant Anonymously</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 space-y-4">
        {/* Categories Row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
            <button
              onClick={() => {
                setSelectedTopic('all');
                setSelectedTag('');
                trackInteraction('topic_filter', 'topic:all', 'Topic: All Whispers');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedTopic === 'all' && !selectedTag
                  ? 'bg-zinc-100 text-zinc-900 shadow-sm font-semibold'
                  : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              All Whispers
            </button>

            <button
              onClick={() => {
                setSelectedTopic('government_whistleblower');
                setSelectedTag('');
                trackInteraction('topic_filter', 'topic:government_whistleblower', 'Topic: Whistleblower & Leaks');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedTopic === 'government_whistleblower'
                  ? 'bg-amber-400 text-zinc-950 font-semibold'
                  : 'bg-zinc-800/60 text-amber-400/80 hover:text-amber-300 hover:bg-zinc-800'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Whistleblower &amp; Leaks</span>
            </button>

            <button
              onClick={() => {
                setSelectedTopic('struggles');
                setSelectedTag('');
                trackInteraction('topic_filter', 'topic:struggles', 'Topic: Life Struggles & Burnout');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedTopic === 'struggles'
                  ? 'bg-rose-400 text-zinc-950 font-semibold'
                  : 'bg-zinc-800/60 text-rose-400/80 hover:text-rose-300 hover:bg-zinc-800'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Life Struggles</span>
            </button>

            <button
              onClick={() => {
                setSelectedTopic('secrets');
                setSelectedTag('');
                trackInteraction('topic_filter', 'topic:secrets', 'Topic: Deep Secrets & Confessions');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedTopic === 'secrets'
                  ? 'bg-purple-400 text-zinc-950 font-semibold'
                  : 'bg-zinc-800/60 text-purple-400/80 hover:text-purple-300 hover:bg-zinc-800'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Deep Secrets</span>
            </button>

            <button
              onClick={() => {
                setSelectedTopic('daily_whisper');
                setSelectedTag('');
                trackInteraction('topic_filter', 'topic:daily_whisper', 'Topic: Daily Whispers');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedTopic === 'daily_whisper'
                  ? 'bg-emerald-400 text-zinc-950 font-semibold'
                  : 'bg-zinc-800/60 text-emerald-400/80 hover:text-emerald-300 hover:bg-zinc-800'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Daily Whispers</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-zinc-500 hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                const val = e.target.value as any;
                setSortBy(val);
                trackInteraction('sort_filter', 'sort:' + val, 'Sort: ' + (val === 'popular' ? 'Most Resonated' : 'Latest'));
              }}
              className="bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="newest">Latest Disclosures</option>
              <option value="popular">Most Supported</option>
            </select>
          </div>
        </div>

        {/* Search & Active Tag filter */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-zinc-800/60">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search chants by keywords, aliases, tags, or disclosures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-zinc-950 text-zinc-200 text-xs sm:text-sm border border-zinc-800 focus:outline-none focus:border-indigo-500"
            />
          </form>

          {selectedTag && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
              <TagIcon className="w-3.5 h-3.5" />
              <span>#{selectedTag}</span>
              <button onClick={() => setSelectedTag('')} className="hover:text-white ml-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            onClick={fetchChants}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Refresh feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chants Stream */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm font-mono">Loading...</p>
        </div>
      ) : chants.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/40 rounded-2xl border border-zinc-800 p-8">
          <Eye className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-zinc-200">No whispers found</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto mt-1 mb-4">
            Be the first to step into the clearing and chant your truth anonymously.
          </p>
          <button
            onClick={() => {
              setNewAlias(generateRandomAlias());
              setIsComposerOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
          >
            Chant Anonymously Now
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {chants.map((chant) => {
            const topicMeta = getTopicMeta(chant.topic);
            const Icon = topicMeta.icon;
            const isCommentsOpen = expandedCommentsId === chant.id;

            return (
              <article
                key={chant.id}
                className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 transition-all hover:border-zinc-700/80 shadow-sm"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-mono font-bold text-zinc-300">
                      {chant.author_alias.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-zinc-200">
                          {chant.author_alias}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${topicMeta.badgeColor}`}>
                          <Icon className="w-3 h-3" />
                          <span>{topicMeta.label}</span>
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {new Date(chant.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(chant.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Flag / Report) */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setFlaggingChantId(chant.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Report / Flag for Admin review"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title & Content */}
                <h3 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight mb-2">
                  {chant.title}
                </h3>
                <p className="text-zinc-300 text-sm sm:text-base leading-relaxed whitespace-pre-line mb-4">
                  {chant.content}
                </p>

                {/* Attached Image (if any) */}
                {chant.image_url && (
                  <div className="mb-4">
                    <img
                      src={chant.image_url}
                      alt="Attached evidence or photo"
                      onClick={() => setZoomedImage(chant.image_url)}
                      className="rounded-xl border border-zinc-800 max-h-80 w-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                    />
                  </div>
                )}

                {/* Tags */}
                {chant.tags && chant.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {chant.tags.map((t, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedTag(t)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                      >
                        <TagIcon className="w-2.5 h-2.5" />
                        <span>#{t}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Footer Controls: Like & Comment */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60 text-xs text-zinc-400">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => handleLike(chant.id, e)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 transition-colors"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-mono font-medium">{chant.likes_count}</span>
                      <span className="hidden sm:inline">Echoes</span>
                    </button>

                    <button
                      onClick={() => toggleComments(chant.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Comments</span>
                      {isCommentsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  <span className="text-[11px] text-zinc-500 font-mono">
                     Ref: #{chant.id.slice(-6)}
                  </span>
                </div>

                {/* Expanded Comments Drawer */}
                {isCommentsOpen && (
                  <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                    <div className="space-y-2">
                      {loadingComments ? (
                        <div className="text-center py-3 text-xs text-zinc-500 font-mono">
                          Loading responses ...
                        </div>
                      ) : activeComments.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic py-1">
                          No replies yet. Speak gently and add your voice.
                        </p>
                      ) : (
                        activeComments.map(c => (
                          <div key={c.id} className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/60 text-xs space-y-1">
                            <div className="flex items-center justify-between text-zinc-400">
                              <span className="font-mono font-semibold text-zinc-300">{c.author_alias}</span>
                              <span className="text-[10px] text-zinc-500">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-zinc-300 leading-relaxed">{c.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* New Comment Input */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <input
                        type="text"
                        placeholder="Alias (optional)"
                        value={commentAlias}
                        onChange={(e) => setCommentAlias(e.target.value)}
                        className="sm:w-36 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="Add an anonymous empathetic response..."
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePostComment(chant.id);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => handlePostComment(chant.id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 flex items-center justify-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Reply</span>
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* New Chant Modal */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-white">Chant Anonymously</h2>
              </div>
              <button
                onClick={() => setIsComposerOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChant} className="space-y-4">
              {/* Topic Selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Select Channel / Topic
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'government_whistleblower', label: 'Whistleblower', icon: Landmark },
                    { id: 'struggles', label: 'Life Struggles', icon: HeartHandshake },
                    { id: 'secrets', label: 'Deep Secrets', icon: Key },
                    { id: 'daily_whisper', label: 'Daily Whisper', icon: Flame }
                  ].map(t => {
                    const Icon = t.icon;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setNewTopic(t.id as any)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                          newTopic === t.id
                            ? 'bg-indigo-600/15 border-indigo-500 text-indigo-200'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Alias & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-zinc-300">Cryptographic Alias</label>
                    <button
                      type="button"
                      onClick={() => setNewAlias(generateRandomAlias())}
                      className="text-[10px] text-indigo-400 hover:underline"
                    >
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Headline / Disclosure Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Redacted Municipal Water Contract or Carrying Silent Burnout..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Your Whisper or Disclosure</label>
                <textarea
                  rows={5}
                  placeholder="Share unvarnished truth, life challenges, secret deeds, or whistleblowing details. All data is saved anonymously."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Optional Tags (comma or space separated)</label>
                <input
                  type="text"
                  placeholder="e.g. whistleblower, corruption, city-hall, mentalhealth"
                  value={newTagsStr}
                  onChange={(e) => setNewTagsStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Image Attachment */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">Photo / Document Attachment</span>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>

                {/* Attached image preview */}
                {attachedImage && (
                  <div className="relative inline-block mt-2">
                    <img
                      src={attachedImage}
                      alt="Preview"
                      className="h-28 rounded-lg border border-zinc-700 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setAttachedImage(null)}
                      className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-600/25 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving to Vault...' : 'Release Whisper'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Flag / Report Modal */}
      {flaggingChantId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-white text-base">Report Content to Secret Admin</h3>
            </div>

            {flagSubmitted ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs text-center">
                ✓ Report logged in audit queue. Admin will review.
              </div>
            ) : (
              <>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Help maintain a safe sanctuary. Reports are directly audited by administrators in the secret admin dashboard.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Reason for Concern</label>
                  <select
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs"
                  >
                    <option value="Doxxing / Private Contact Info">Doxxing / Private Contact Info</option>
                    <option value="Direct Violence Threat">Direct Violence Threat</option>
                    <option value="Severe Harassment">Severe Harassment</option>
                    <option value="Immediate Self-Harm Risk">Immediate Self-Harm Risk</option>
                    <option value="Spam / Malicious Payload">Spam / Malicious Payload</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Optional Details</label>
                  <textarea
                    rows={2}
                    placeholder="Provide context for admin review..."
                    value={flagDetails}
                    onChange={(e) => setFlagDetails(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setFlaggingChantId(null)}
                    className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitFlag}
                    className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-500"
                  >
                    Submit Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={zoomedImage} alt="Zoomed" className="rounded-xl max-h-[85vh] w-auto mx-auto object-contain border border-zinc-800" />
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-2 right-2 p-2 bg-zinc-900/80 text-white rounded-full hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
