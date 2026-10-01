import React, { useState, useEffect, useRef } from 'react';
import { ChatGroup, GroupMessage, TopicCategory } from '../types.ts';
import { trackPageView, trackInteraction } from '../utils/analytics.ts';
import { 
  encryptE2E, 
  decryptE2E, 
  generateRandomRoomPass, 
  saveRoomKey, 
  getRoomKey,
  copyToClipboard
} from '../utils/crypto.ts';
import { 
  MessageSquareLock, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Send, 
  Plus, 
  Image as ImageIcon, 
  X, 
  Key, 
  Copy, 
  Check, 
  CheckCheck,
  RefreshCw, 
  Tag as TagIcon, 
  Users, 
  ArrowLeft,
  Search,
  Eye,
  EyeOff,
  Share2,
  SlidersHorizontal,
  AlertTriangle
} from 'lucide-react';

interface EncryptedGroupsProps {
  onPanicPurge: () => void;
}

interface DecryptedMessageItem {
  id: string;
  group_id: string;
  author_alias: string;
  decryptedText: string;
  decryptionError: boolean;
  image_url: string | null;
  read_by: string[];
  created_at: string;
}

export const EncryptedGroups: React.FC<EncryptedGroupsProps> = ({ onPanicPurge }) => {
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);

  // Group search & topic filter
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupTopicFilter, setGroupTopicFilter] = useState<string>('all');

  // In-chat message search
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);

  // Group creation modal
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupTopic, setNewGroupTopic] = useState<TopicCategory | 'general'>('government_whistleblower');
  const [newGroupTags, setNewGroupTags] = useState('');
  const [newGroupPass, setNewGroupPass] = useState('');
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  // Active chat state
  const [messages, setMessages] = useState<DecryptedMessageItem[]>([]);
  const [rawMessages, setRawMessages] = useState<GroupMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [currentKey, setCurrentKey] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isVerifyingPass, setIsVerifyingPass] = useState(false);
  const [unlockPasswordVisible, setUnlockPasswordVisible] = useState(false);

  // Passphrase visibility and sharing
  const [isKeyRevealed, setIsKeyRevealed] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedKeyNotice, setCopiedKeyNotice] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Message composer
  const [messageText, setMessageText] = useState('');
  const [myAlias, setMyAlias] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Read receipts info modal/popover
  const [viewingReceiptsMsgId, setViewingReceiptsMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate random alias
  const getRandomAlias = () => {
    const prefixes = ['CipherGhost', 'ShadowNode', 'SilentVessel', 'EchoAgent', 'SanctuarySeeker'];
    const num = Math.floor(100 + Math.random() * 900);
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]}_${num}`;
  };

  useEffect(() => {
    fetchGroups();
    const storedAlias = sessionStorage.getItem('chantvault_my_alias');
    if (storedAlias) {
      setMyAlias(storedAlias);
    } else {
      const generated = getRandomAlias();
      setMyAlias(generated);
      sessionStorage.setItem('chantvault_my_alias', generated);
    }
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (groupTopicFilter !== 'all') params.append('topic', groupTopicFilter);
      if (groupSearchQuery) params.append('search', groupSearchQuery);

      const res = await fetch(`/api/groups?${params.toString()}`);
      const data = await res.json();
      if (data.groups) {
        setGroups(data.groups);
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGroup = async (group: ChatGroup) => {
    setSelectedGroup(group);
    setUnlockError(null);
    setKeyInput('');
    setChatSearchQuery('');
    setIsChatSearchOpen(false);

    trackInteraction('group_action', 'group:enter_vault', 'Entered Room: ' + group.name);
    trackPageView('/groups/' + group.id, 'Encrypted Group Chat', 'Room: ' + group.name);

    // Check if key is already in session and verify it
    const stored = getRoomKey(group.id);
    if (stored) {
      try {
        const verifyRes = await fetch(`/api/groups/${group.id}/verify-passphrase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passkey: stored })
        });
        const vData = await verifyRes.json();
        if (vData.success && vData.verified) {
          setCurrentKey(stored);
          setIsUnlocked(true);
          loadGroupMessages(group.id, stored);
          return;
        }
      } catch (e) {
        // Fallback to locked
      }
      saveRoomKey(group.id, '');
    }

    setCurrentKey('');
    setIsUnlocked(false);
    loadGroupMessages(group.id, null);
  };

  const loadGroupMessages = async (groupId: string, passkey: string | null) => {
    try {
      setLoadingChat(true);
      const res = await fetch(`/api/groups/${groupId}/messages`);
      const data = await res.json();
      if (data.messages) {
        setRawMessages(data.messages);
        if (passkey) {
          await decryptAllMessages(data.messages, passkey);
          // Send read receipt if alias set
          if (myAlias) {
            markMessagesAsRead(groupId, myAlias);
          }
        } else {
          setMessages(data.messages.map((m: GroupMessage) => {
            let readByList: string[] = [];
            try {
              readByList = JSON.parse(m.read_by || '[]');
            } catch (e) {
              readByList = [];
            }
            return {
              id: m.id,
              group_id: m.group_id,
              author_alias: m.author_alias,
              decryptedText: '🔒 [Encrypted Payload - AES-256-GCM Locked]',
              decryptionError: false,
              image_url: null,
              read_by: readByList,
              created_at: m.created_at
            };
          }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChat(false);
      scrollToBottom();
    }
  };

  const markMessagesAsRead = async (groupId: string, readerAlias: string) => {
    try {
      await fetch(`/api/groups/${groupId}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reader_alias: readerAlias })
      });
    } catch (e) {
      // Non-fatal
    }
  };

  const decryptAllMessages = async (rawList: GroupMessage[], passkey: string) => {
    const list: DecryptedMessageItem[] = [];

    for (const m of rawList) {
      let readByList: string[] = [];
      try {
        readByList = typeof m.read_by === 'string' ? JSON.parse(m.read_by || '[]') : (m.read_by || []);
      } catch (e) {
        readByList = [];
      }

      if (m.is_encrypted) {
        try {
          let payload = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
          if (payload && payload.ciphertext && payload.iv && payload.salt) {
            const decryptedString = await decryptE2E(payload, passkey);
            let parsedText = decryptedString;
            let parsedImage = m.image_url;

            try {
              const inner = JSON.parse(decryptedString);
              if (inner.text !== undefined) parsedText = inner.text;
              if (inner.image) parsedImage = inner.image;
            } catch (e) {
              // Plain string
            }

            list.push({
              id: m.id,
              group_id: m.group_id,
              author_alias: m.author_alias,
              decryptedText: parsedText,
              decryptionError: false,
              image_url: parsedImage,
              read_by: readByList,
              created_at: m.created_at
            });
          } else if (payload && payload.text) {
            list.push({
              id: m.id,
              group_id: m.group_id,
              author_alias: m.author_alias,
              decryptedText: payload.text,
              decryptionError: false,
              image_url: m.image_url,
              read_by: readByList,
              created_at: m.created_at
            });
          } else {
            list.push({
              id: m.id,
              group_id: m.group_id,
              author_alias: m.author_alias,
              decryptedText: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
              decryptionError: false,
              image_url: m.image_url,
              read_by: readByList,
              created_at: m.created_at
            });
          }
        } catch (err) {
          list.push({
            id: m.id,
            group_id: m.group_id,
            author_alias: m.author_alias,
            decryptedText: '🔒 [Decryption Failed: Key Mismatch]',
            decryptionError: true,
            image_url: null,
            read_by: readByList,
            created_at: m.created_at
          });
        }
      } else {
        list.push({
          id: m.id,
          group_id: m.group_id,
          author_alias: m.author_alias,
          decryptedText: m.content,
          decryptionError: false,
          image_url: m.image_url,
          read_by: readByList,
          created_at: m.created_at
        });
      }
    }

    setMessages(list);
  };

  const handleUnlockRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim() || !selectedGroup) return;

    const testKey = keyInput.trim();
    setUnlockError(null);
    setIsVerifyingPass(true);

    try {
      // 1. Verify with server-stored cryptographic hash
      const verifyRes = await fetch(`/api/groups/${selectedGroup.id}/verify-passphrase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: testKey })
      });

      const vData = await verifyRes.json();
      if (!verifyRes.ok || !vData.verified) {
        setUnlockError(vData.error || 'Incorrect room encryption passphrase. Access denied. Only authorized members with the correct key can unlock this room.');
        setIsUnlocked(false);
        setIsVerifyingPass(false);
        return;
      }

      // 2. Verified! Save key in session and decrypt
      saveRoomKey(selectedGroup.id, testKey);
      setCurrentKey(testKey);
      setIsUnlocked(true);
      setKeyInput('');
      setUnlockError(null);

      await decryptAllMessages(rawMessages, testKey);
      if (myAlias) {
        markMessagesAsRead(selectedGroup.id, myAlias);
      }
    } catch (err: any) {
      setUnlockError('Verification error: ' + (err.message || 'Unable to connect to vault.'));
      setIsUnlocked(false);
    } finally {
      setIsVerifyingPass(false);
    }
  };

  const handleLockRoom = () => {
    if (!selectedGroup) return;
    saveRoomKey(selectedGroup.id, '');
    setCurrentKey('');
    setIsUnlocked(false);
    loadGroupMessages(selectedGroup.id, null);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageText.trim() && !attachedImage) || !selectedGroup || !isUnlocked || !currentKey) return;

    try {
      setIsSending(true);

      const payloadString = JSON.stringify({
        text: messageText.trim(),
        image: attachedImage,
        timestamp: Date.now()
      });

      // Encrypt client-side using AES-256-GCM
      const encryptedPayload = await encryptE2E(payloadString, currentKey);

      const senderAlias = myAlias || getRandomAlias();
      const res = await fetch(`/api/groups/${selectedGroup.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_alias: senderAlias,
          content: encryptedPayload,
          is_encrypted: true,
          image_url: null
        })
      });

      const data = await res.json();
      if (data.success) {
        setMessages(prev => [
          ...prev,
          {
            id: data.message.id,
            group_id: selectedGroup.id,
            author_alias: data.message.author_alias,
            decryptedText: messageText.trim(),
            decryptionError: false,
            image_url: attachedImage,
            read_by: [senderAlias],
            created_at: data.message.created_at
          }
        ]);
        setMessageText('');
        setAttachedImage(null);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to encrypt or deliver message');
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File exceeds 5MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupPass.trim()) {
      alert('Group name and encryption passphrase are required.');
      return;
    }

    try {
      setIsSubmittingGroup(true);
      const tagsArray = newGroupTags
        .split(/[,\s#]+/)
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      const pass = newGroupPass.trim();

      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          topic: newGroupTopic,
          tags: tagsArray,
          is_encrypted: true,
          passphrase: pass
        })
      });

      const data = await res.json();
      if (data.success && data.group) {
        setGroups(prev => [data.group, ...prev]);
        saveRoomKey(data.group.id, pass);
        const copied = await copyToClipboard(pass);
        if (copied) {
          setCopiedKeyNotice('Vault established & room passphrase copied to clipboard! Share with trusted peers.');
        } else {
          setCopiedKeyNotice('Vault established! Use "Share Key" inside the room to copy and share with trusted peers.');
        }
        setTimeout(() => setCopiedKeyNotice(null), 5000);

        setIsCreatingGroup(false);
        setNewGroupName('');
        setNewGroupDesc('');
        setNewGroupTags('');
        
        // Select and enter unlocked
        setSelectedGroup(data.group);
        setCurrentKey(pass);
        setIsUnlocked(true);
        loadGroupMessages(data.group.id, pass);
      } else {
        alert(data.error || 'Failed to create group');
      }
    } catch (err: any) {
      console.error(err);
      alert('Group creation failed: ' + err.message);
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const copyRoomPassphrase = async () => {
    if (!currentKey) return;
    const ok = await copyToClipboard(currentKey);
    setCopiedKey(true);
    if (ok) {
      setCopiedKeyNotice('Room passphrase copied to clipboard! Share with trusted peers.');
    } else {
      setCopiedKeyNotice('Clipboard write restricted. Opening Share panel for manual copy.');
      setIsShareModalOpen(true);
    }
    setTimeout(() => {
      setCopiedKey(false);
      setCopiedKeyNotice(null);
    }, 3500);
  };

  const copyFullInvitation = async () => {
    if (!selectedGroup || !currentKey) return;
    const inviteText = `Join the end-to-end encrypted room "${selectedGroup.name}" on ChantVault.\n\nRoom Topic: ${selectedGroup.topic}\nRoom Passphrase: ${currentKey}\n\nAll messages in this room use zero-knowledge client-side AES-256-GCM encryption. Keep this key safe and share only with trusted peers.`;
    const ok = await copyToClipboard(inviteText);
    setCopiedInvite(true);
    if (ok) {
      setCopiedKeyNotice('Full room invitation copied to clipboard! Ready to share with peers.');
    } else {
      setCopiedKeyNotice('Please select and copy the invitation text in the Share box.');
    }
    setTimeout(() => {
      setCopiedInvite(false);
      setCopiedKeyNotice(null);
    }, 3500);
  };

  // Filter messages in chat by search query
  const displayedMessages = messages.filter(m => {
    if (!chatSearchQuery.trim()) return true;
    const q = chatSearchQuery.toLowerCase();
    return (
      m.decryptedText.toLowerCase().includes(q) ||
      m.author_alias.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* If viewing a selected group */}
      {selectedGroup ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[750px]">
          {/* Group Header */}
          <div className="px-5 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedGroup(null)}
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
                title="Back to groups"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {selectedGroup.name}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3" />
                    <span>AES-256-GCM E2EE</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-1">
                  {selectedGroup.description || 'Private encrypted sanctuary chat'}
                </p>
              </div>
            </div>

            {/* Key & Room Controls */}
            <div className="flex items-center gap-2">
              {isUnlocked && (
                <button
                  onClick={() => setIsChatSearchOpen(!isChatSearchOpen)}
                  className={`p-2 rounded-lg text-xs font-mono transition-colors ${
                    isChatSearchOpen ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:text-white'
                  }`}
                  title="Search messages in this encrypted room"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}

              {isUnlocked ? (
                <>
                  <button
                    onClick={copyRoomPassphrase}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors shadow-sm"
                    title="Copy room encryption key to share with trusted members"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
                  </button>
                  <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-mono transition-all shadow-md shadow-indigo-600/20"
                    title="Share room passkey and invite peers"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Key</span>
                  </button>
                  <button
                    onClick={handleLockRoom}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-950/40 text-red-300 border border-red-800/40 text-xs hover:bg-red-900/60"
                    title="Lock room and purge key from memory"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Lock Room</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Locked</span>
                </div>
              )}
            </div>
          </div>

          {/* Copy Notice Alert Banner */}
          {copiedKeyNotice && (
            <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono">{copiedKeyNotice}</span>
              </div>
              <button 
                onClick={() => setCopiedKeyNotice(null)} 
                className="text-emerald-400 hover:text-emerald-200 ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* In-Chat Message Search Bar */}
          {isUnlocked && isChatSearchOpen && (
            <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search messages, decrypted content, or aliases..."
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
                autoFocus
              />
              {chatSearchQuery && (
                <span className="text-[10px] font-mono text-zinc-400">
                  {displayedMessages.length} found
                </span>
              )}
              <button
                onClick={() => { setChatSearchQuery(''); setIsChatSearchOpen(false); }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Main Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-zinc-950/50">
            {!isUnlocked ? (
              <div className="h-full flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Unlock Encrypted Room</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      All messages in this room are end-to-end encrypted with AES-256-GCM. The database strictly validates the correct room passkey before granting access.
                    </p>
                  </div>

                  <form onSubmit={handleUnlockRoom} className="space-y-3.5">
                    <div className="relative">
                      <input
                        type={unlockPasswordVisible ? 'text' : 'password'}
                        placeholder="Enter room secret passphrase..."
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        required
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setUnlockPasswordVisible(!unlockPasswordVisible)}
                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-200"
                        title={unlockPasswordVisible ? 'Hide passkey' : 'Show passkey'}
                      >
                        {unlockPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {unlockError && (
                      <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono text-left flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span>{unlockError}</span>
                      </div>
                    )}

                    {/* Quick demo helper for seeded default rooms */}
                    {selectedGroup.id === 'group-whistleblowers' && (
                      <p className="text-[11px] text-zinc-500 font-mono text-left bg-zinc-950/60 p-2 rounded-lg border border-zinc-800">
                        Default seed passkey:{' '}
                        <button
                          type="button"
                          onClick={() => setKeyInput('whistleblower2026')}
                          className="text-indigo-400 hover:underline font-bold cursor-pointer"
                        >
                          whistleblower2026
                        </button>
                      </p>
                    )}
                    {selectedGroup.id === 'group-caregivers' && (
                      <p className="text-[11px] text-zinc-500 font-mono text-left bg-zinc-950/60 p-2 rounded-lg border border-zinc-800">
                        Default seed passkey:{' '}
                        <button
                          type="button"
                          onClick={() => setKeyInput('sanctuary2026')}
                          className="text-indigo-400 hover:underline font-bold cursor-pointer"
                        >
                          sanctuary2026
                        </button>
                      </p>
                    )}
                    {selectedGroup.id === 'group-confessions' && (
                      <p className="text-[11px] text-zinc-500 font-mono text-left bg-zinc-950/60 p-2 rounded-lg border border-zinc-800">
                        Default seed passkey:{' '}
                        <button
                          type="button"
                          onClick={() => setKeyInput('midnight2026')}
                          className="text-indigo-400 hover:underline font-bold cursor-pointer"
                        >
                          midnight2026
                        </button>
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isVerifyingPass}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                    >
                      {isVerifyingPass && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isVerifyingPass ? 'Verifying with Database...' : 'Decrypt & Enter Vault'}</span>
                    </button>
                  </form>
                </div>
              </div>
            ) : loadingChat ? (
              <div className="flex items-center justify-center h-full text-zinc-500 text-xs font-mono">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-indigo-400" />
                <span>Decrypting messages with Web Crypto API...</span>
              </div>
            ) : displayedMessages.length === 0 ? (
              <div className="text-center py-20 text-zinc-500 text-xs font-mono">
                {chatSearchQuery ? 'No messages match search query.' : 'No messages yet. Send the first end-to-end encrypted whisper.'}
              </div>
            ) : (
              displayedMessages.map((m) => {
                const isMe = m.author_alias === myAlias;
                const otherReaders = m.read_by.filter(r => r !== m.author_alias);
                const isReadByOthers = otherReaders.length > 0;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono mb-1">
                      <span className={isMe ? 'text-indigo-400 font-bold' : 'text-zinc-300'}>
                        {m.author_alias}
                      </span>
                      <span>•</span>
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                    </div>

                    <div
                      className={`max-w-xl p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : m.decryptionError
                          ? 'bg-red-950/40 text-red-300 border border-red-800/40 rounded-tl-none font-mono text-xs'
                          : 'bg-zinc-800/90 text-zinc-200 border border-zinc-700/60 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-line">{m.decryptedText}</p>

                      {m.image_url && (
                        <div className="mt-2.5">
                          <img
                            src={m.image_url}
                            alt="Encrypted attachment"
                            className="rounded-lg max-h-60 w-auto object-cover border border-black/20"
                          />
                        </div>
                      )}
                    </div>

                    {/* Read Receipts Indicator */}
                    <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 mt-1 cursor-pointer hover:text-zinc-300"
                      onClick={() => setViewingReceiptsMsgId(viewingReceiptsMsgId === m.id ? null : m.id)}
                    >
                      {isMe ? (
                        isReadByOthers ? (
                          <span className="flex items-center gap-1 text-emerald-400" title={`Read by ${otherReaders.join(', ')}`}>
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Read by {otherReaders.length}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-zinc-400" title="Delivered to encrypted vault">
                            <Check className="w-3.5 h-3.5" />
                            <span>Sent</span>
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-zinc-500">
                          {m.read_by.includes(myAlias) ? 'Read' : 'Unread'}
                        </span>
                      )}
                    </div>

                    {/* Read Receipts Popover */}
                    {viewingReceiptsMsgId === m.id && (
                      <div className="mt-1 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400 max-w-xs">
                        <span className="font-semibold text-zinc-300 block mb-1">Read by ({m.read_by.length}):</span>
                        {m.read_by.length === 0 ? (
                          <span className="italic">No receipts logged yet</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {m.read_by.map((r, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Composer */}
          {isUnlocked && (
            <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-zinc-950 border-t border-zinc-800 space-y-2">
              {attachedImage && (
                <div className="relative inline-block">
                  <img src={attachedImage} alt="Attachment" className="h-16 rounded border border-zinc-700" />
                  <button
                    type="button"
                    onClick={() => setAttachedImage(null)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="p-2 text-zinc-400 hover:text-white cursor-pointer bg-zinc-900 border border-zinc-800 rounded-xl" title="Attach encrypted image">
                  <ImageIcon className="w-4 h-4" />
                  <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>

                <input
                  type="text"
                  placeholder={`Whisper encrypted as ${myAlias}...`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs sm:text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                />

                <button
                  type="submit"
                  disabled={isSending || (!messageText.trim() && !attachedImage)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isSending ? 'Encrypting...' : 'Send'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* Groups List View */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  End-to-End Encrypted Rooms
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  AES-256-GCM
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Read Receipts
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Zero-knowledge topic rooms with in-chat search and read receipts. Passphrases never touch the server.
              </p>
            </div>

            <button
              onClick={() => {
                setNewGroupPass(generateRandomRoomPass());
                setIsCreatingGroup(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs sm:text-sm font-medium hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-600/25"
            >
              <Plus className="w-4 h-4" />
              <span>Create Encrypted Room</span>
            </button>
          </div>

          {/* Group Search & Filter Bar */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search rooms by name, topic, or tags..."
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchGroups();
                }}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={groupTopicFilter}
              onChange={(e) => {
                setGroupTopicFilter(e.target.value);
                setTimeout(() => fetchGroups(), 0);
              }}
              className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none"
            >
              <option value="all">All Topics</option>
              <option value="government_whistleblower">Whistleblower</option>
              <option value="struggles">Life Struggles</option>
              <option value="secrets">Deep Secrets</option>
              <option value="general">General</option>
            </select>

            <button
              onClick={fetchGroups}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200"
            >
              Search
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-zinc-500 text-xs font-mono">
              <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-400" />
              <span>Loading encrypted chat rooms ...</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 bg-zinc-900/40 rounded-2xl border border-zinc-800 p-8">
              <MessageSquareLock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-zinc-200">No rooms found</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                Establish the first encrypted safe circle for your whistleblowers or support peers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => {
                const storedKey = getRoomKey(group.id);
                const isGroupUnlocked = Boolean(storedKey);

                return (
                  <div
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 hover:border-indigo-500/50 transition-all cursor-pointer shadow-sm hover:shadow-indigo-500/10 flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-zinc-100 text-base group-hover:text-indigo-300 transition-colors">
                          {group.name}
                        </h3>
                        <span className={`p-1.5 rounded-lg text-xs ${
                          isGroupUnlocked ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {isGroupUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                        {group.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-zinc-800/60">
                      {group.tags && group.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {group.tags.map((t, i) => (
                            <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{group.member_count} peers</span>
                        </span>
                        <span className="text-indigo-400 group-hover:underline">
                          Enter Vault →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Group Modal */}
      {isCreatingGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <MessageSquareLock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Create Encrypted Room</h3>
              </div>
              <button onClick={() => setIsCreatingGroup(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Room Name</label>
                <input
                  type="text"
                  placeholder="e.g. 🏛️ Public Contract Forensic Taskforce"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Topic / Category</label>
                <select
                  value={newGroupTopic}
                  onChange={(e) => setNewGroupTopic(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs"
                >
                  <option value="government_whistleblower">Whistleblower &amp; Leaks</option>
                  <option value="struggles">Life Struggles &amp; Caregiving</option>
                  <option value="secrets">Deep Secrets</option>
                  <option value="general">General Anonymous Circle</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Description / Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Briefly state purpose and rules of this encrypted room..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. whistleblower, leaks, water-rights"
                  value={newGroupTags}
                  onChange={(e) => setNewGroupTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono"
                />
              </div>

              {/* Passphrase Generator */}
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5" />
                    <span>Room Encryption Passphrase</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewGroupPass(generateRandomRoomPass())}
                    className="text-[10px] text-indigo-400 hover:underline"
                  >
                    Regenerate Mnemonic
                  </button>
                </div>
                <input
                  type="text"
                  value={newGroupPass}
                  onChange={(e) => setNewGroupPass(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono text-emerald-400 font-semibold"
                />
                <p className="text-[10px] text-zinc-400 leading-normal">
                  🔒 This room encryption passphrase is saved in the database to verify authorized peer access. Only members who provide this exact key will be allowed to unlock the vault and read messages. Inside the room, you can copy or share this key with trusted peers at any time.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingGroup(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGroup}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25"
                >
                  {isSubmittingGroup ? 'Establishing...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Key & Invite Peers Modal */}
      {isShareModalOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Share Room Passphrase</h3>
                  <p className="text-[11px] text-zinc-400 font-mono">Vault: {selectedGroup.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsShareModalOpen(false)} 
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-indigo-200 leading-relaxed">
                <p className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Peer-to-Peer Zero-Knowledge Security</span>
                </p>
                Only members who enter this exact room passphrase can unlock this room and decrypt messages. You can copy the passphrase directly or share the pre-formatted invitation with trusted peers.
              </div>

              {/* Passphrase Copy Card */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">Room Encryption Passphrase</label>
                  <button
                    type="button"
                    onClick={() => setIsKeyRevealed(!isKeyRevealed)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    {isKeyRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isKeyRevealed ? 'Hide' : 'Reveal'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type={isKeyRevealed ? 'text' : 'password'}
                    readOnly
                    value={currentKey}
                    onClick={(e) => e.currentTarget.select()}
                    title="Click to select all text for manual copy"
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono text-emerald-400 font-semibold tracking-wider select-all cursor-pointer focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={copyRoomPassphrase}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition-colors"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Tip: Click inside the box to select all text for manual copy (Ctrl+C / Cmd+C).
                </p>
              </div>

              {/* Full Invitation Card */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">Pre-formatted Peer Invitation</label>
                <textarea
                  readOnly
                  rows={4}
                  value={`Join the end-to-end encrypted room "${selectedGroup.name}" on ChantVault.\n\nRoom Topic: ${selectedGroup.topic}\nRoom Passphrase: ${currentKey}\n\nAll messages in this room use zero-knowledge client-side AES-256-GCM encryption. Keep this key safe and share only with trusted peers.`}
                  onClick={(e) => e.currentTarget.select()}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[11px] leading-relaxed resize-none cursor-pointer focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={copyFullInvitation}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors"
                >
                  {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>{copiedInvite ? 'Invitation Copied to Clipboard!' : 'Copy Full Peer Invitation'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
