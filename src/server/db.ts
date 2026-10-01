import initSqlJs, { Database } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function hashRoomPassphrase(passphrase: string, salt: string): string {
  return crypto.createHash('sha256').update(passphrase.trim() + ':' + salt).digest('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (e) {
      console.error('Failed to read existing DB, creating new:', e);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  saveDb(dbInstance);
  return dbInstance;
}

export function saveDb(db: Database = dbInstance!) {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error persisting to disk:', err);
  }
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS chants (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_alias TEXT NOT NULL,
      topic TEXT NOT NULL,
      tags TEXT NOT NULL,
      image_url TEXT,
      likes_count INTEGER DEFAULT 0,
      flags_count INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      chant_id TEXT NOT NULL,
      author_alias TEXT NOT NULL,
      content TEXT NOT NULL,
      is_hidden INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(chant_id) REFERENCES chants(id)
    );

    CREATE TABLE IF NOT EXISTS chat_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      topic TEXT NOT NULL,
      tags TEXT NOT NULL,
      is_encrypted INTEGER DEFAULT 1,
      encryption_passphrase TEXT,
      passphrase_hash TEXT,
      passphrase_salt TEXT,
      member_count INTEGER DEFAULT 1,
      is_hidden INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      author_alias TEXT NOT NULL,
      content TEXT NOT NULL,
      is_encrypted INTEGER DEFAULT 1,
      image_url TEXT,
      read_by TEXT DEFAULT '[]',
      is_hidden INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(group_id) REFERENCES chat_groups(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      target_id TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_visits (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      page_name TEXT NOT NULL,
      option_name TEXT,
      session_id TEXT,
      referrer TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feature_interactions (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      action_target TEXT NOT NULL,
      label TEXT NOT NULL,
      session_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Migration for read_by column if existing table lacks it
  try {
    db.run("ALTER TABLE group_messages ADD COLUMN read_by TEXT DEFAULT '[]'");
  } catch (e) {
    // Column already exists or table freshly created
  }

  // Migration for encryption_passphrase, passphrase_hash & passphrase_salt columns if existing table lacks them
  try {
    db.run("ALTER TABLE chat_groups ADD COLUMN encryption_passphrase TEXT");
  } catch (e) {}
  try {
    db.run("ALTER TABLE chat_groups ADD COLUMN passphrase_hash TEXT");
  } catch (e) {}
  try {
    db.run("ALTER TABLE chat_groups ADD COLUMN passphrase_salt TEXT");
  } catch (e) {}

  // Backfill seeded groups with encryption_passphrase and cryptographic hashes
  try {
    const wSalt = 'whistleblower_salt_2026';
    const wHash = hashRoomPassphrase('whistleblower2026', wSalt);
    db.run("UPDATE chat_groups SET encryption_passphrase = 'whistleblower2026', passphrase_hash = ?, passphrase_salt = ? WHERE id = 'group-whistleblowers'", [wHash, wSalt]);

    const cSalt = 'caregiver_salt_2026';
    const cHash = hashRoomPassphrase('sanctuary2026', cSalt);
    db.run("UPDATE chat_groups SET encryption_passphrase = 'sanctuary2026', passphrase_hash = ?, passphrase_salt = ? WHERE id = 'group-caregivers'", [cHash, cSalt]);

    const mSalt = 'midnight_salt_2026';
    const mHash = hashRoomPassphrase('midnight2026', mSalt);
    db.run("UPDATE chat_groups SET encryption_passphrase = 'midnight2026', passphrase_hash = ?, passphrase_salt = ? WHERE id = 'group-confessions'", [mHash, mSalt]);
  } catch (e) {}

  // Seed analytics if empty
  try {
    const visitCountResult = db.exec("SELECT COUNT(*) as count FROM page_visits");
    const visitCount = visitCountResult.length > 0 && visitCountResult[0].values[0] ? (visitCountResult[0].values[0][0] as number) : 0;
    if (visitCount === 0) {
      seedAnalytics(db);
    }
  } catch (e) {
    // Table newly created, seed
    seedAnalytics(db);
  }

  // Check if we need to seed
  const countResult = db.exec("SELECT COUNT(*) as count FROM chants");
  const chantCount = countResult.length > 0 && countResult[0].values[0] ? (countResult[0].values[0][0] as number) : 0;

  if (chantCount === 0) {
    seedDatabase(db);
  }
}

function seedDatabase(db: Database) {
  const now = new Date();
  const timeMinus = (mins: number) => new Date(now.getTime() - mins * 60 * 1000).toISOString();

  // Seed chants
  const chants = [
    {
      id: 'chant-gov-01',
      title: 'City Council Silent Subsidies: Redacted Contract Memo 2026',
      content: 'I work inside municipal records. Last month, $14.8M allocated for urgent drinking water pipe remediation in the northern district was quietly shifted into a no-bid automated surveillance & facial scanner contract for privatized toll perimeters under emergency ordinance #49B. All vendor bid memos were stamped "Proprietary Trade Secret" to evade freedom-of-information discovery. People in the North sector are still drinking lead-tainted tap water while city spokespersons claim supply chain delays. Keep your eyes on the public agenda meeting this Tuesday.',
      author_alias: 'Whistleblower-Omega-7',
      topic: 'government_whistleblower',
      tags: JSON.stringify(['whistleblower', 'water-crisis', 'corruption', 'transparency', 'city-council']),
      image_url: null,
      likes_count: 84,
      flags_count: 0,
      is_hidden: 0,
      created_at: timeMinus(120)
    },
    {
      id: 'chant-struggle-01',
      title: 'I have smiled every single day at work while completely drowning inside',
      content: 'For the last 9 months, I have been sole caregiver to my ailing father with progressive dementia while working 55 hours a week in finance. At the office, everyone considers me the "calm rock" who never complains. As soon as I turn the ignition in my car in the parking garage, I break down weeping from pure exhaustion. Nobody in my circle knows how terrifying it is to watch the person who taught you to ride a bicycle forget your name. If anyone else is carrying an invisible mountain today, you are not alone.',
      author_alias: 'SolitaryAnchor_92',
      topic: 'struggles',
      tags: JSON.stringify(['caregiving', 'mentalhealth', 'silent-struggle', 'burnout', 'empathy']),
      image_url: null,
      likes_count: 142,
      flags_count: 0,
      is_hidden: 0,
      created_at: timeMinus(280)
    },
    {
      id: 'chant-secret-01',
      title: 'I secretly paid off my former high school teacher’s insulin debt 4 years ago',
      content: 'She was the only adult who saw I was homeless when I was 16 and left fresh meal vouchers in my locker without ever humiliating me. Years later, after getting lucky in distributed systems engineering, I discovered through a local community clinic board that her retirement insurance had lapsed and she owed $11,400. I worked through an anonymous legal escrow trust to settle it in full with zero recipient disclosure. She still thinks an anonymous medical foundation grant covered it. It remains the proudest secret of my lifetime.',
      author_alias: 'Cipher_Ghost_99',
      topic: 'secrets',
      tags: JSON.stringify(['confession', 'gratitude', 'secret-kindness', 'unspoken']),
      image_url: null,
      likes_count: 219,
      flags_count: 0,
      is_hidden: 0,
      created_at: timeMinus(520)
    },
    {
      id: 'chant-whisper-01',
      title: 'We are slowly replacing authentic human awkwardness with synthetic perfection',
      content: 'Walked into a neighborhood café today. Out of 19 people, 17 had noise-canceling headphones securely on, staring at synchronized glowing rectangles. Nobody caught anyone’s eye; nobody made a clumsy joke about the coffee lid being jammed. We whisper in anonymous boards like this because real physical spaces have turned into silent transit terminals. I miss messy, unoptimized human interaction.',
      author_alias: 'Wandering_Scribe',
      topic: 'daily_whisper',
      tags: JSON.stringify(['philosophy', 'modern-life', 'loneliness', 'connection']),
      image_url: null,
      likes_count: 95,
      flags_count: 0,
      is_hidden: 0,
      created_at: timeMinus(720)
    }
  ];

  for (const c of chants) {
    db.run(
      `INSERT INTO chants (id, title, content, author_alias, topic, tags, image_url, likes_count, flags_count, is_hidden, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.title, c.content, c.author_alias, c.topic, c.tags, c.image_url, c.likes_count, c.flags_count, c.is_hidden, c.created_at]
    );
  }

  // Seed sample comments
  const comments = [
    {
      id: 'comm-1',
      chant_id: 'chant-struggle-01',
      author_alias: 'FellowTraveler_44',
      content: 'I walked the dementia path with my grandmother for 4 years. The car weeping is so familiar it gave me chills. Please make sure you drink water and take 10 minutes to just breathe today. You are doing sacred work.',
      created_at: timeMinus(180)
    },
    {
      id: 'comm-2',
      chant_id: 'chant-gov-01',
      author_alias: 'CivicMonitor_8',
      content: 'I checked the Tuesday agenda item 7C: "Emergency Public Safety Procurement Ratification". You are spot on. Local journalists have been tipped.',
      created_at: timeMinus(60)
    }
  ];

  for (const com of comments) {
    db.run(
      `INSERT INTO comments (id, chant_id, author_alias, content, is_hidden, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [com.id, com.chant_id, com.author_alias, com.content, com.created_at]
    );
  }

  // Seed chat groups (E2EE enabled)
  const groups = [
    {
      id: 'group-whistleblowers',
      name: '🏛️ Public Integrity & Whistleblower Circle',
      description: 'End-to-end encrypted hub for sharing verifiable institutional disclosures, contract leaks, and source protection tips.',
      topic: 'government_whistleblower',
      tags: JSON.stringify(['whistleblower', 'investigation', 'e2ee', 'leaks', 'transparency']),
      is_encrypted: 1,
      encryption_passphrase: 'whistleblower2026',
      passphrase_salt: 'whistleblower_salt_2026',
      passphrase_hash: hashRoomPassphrase('whistleblower2026', 'whistleblower_salt_2026'),
      member_count: 64,
      is_hidden: 0,
      created_at: timeMinus(1440)
    },
    {
      id: 'group-caregivers',
      name: '🛡️ Anonymous Caregiver & Burnout Sanctuary',
      description: 'A zero-judgment safe space for those carrying elderly parents, chronic illness, and silent daily struggles.',
      topic: 'struggles',
      tags: JSON.stringify(['caregiving', 'support', 'burnout', 'mentalhealth', 'e2ee']),
      is_encrypted: 1,
      encryption_passphrase: 'sanctuary2026',
      passphrase_salt: 'caregiver_salt_2026',
      passphrase_hash: hashRoomPassphrase('sanctuary2026', 'caregiver_salt_2026'),
      member_count: 112,
      is_hidden: 0,
      created_at: timeMinus(2880)
    },
    {
      id: 'group-confessions',
      name: '🗝️ The Midnight Vault (Deep Secrets)',
      description: 'Private encrypted room for venting truths you can never say out loud under your real name.',
      topic: 'secrets',
      tags: JSON.stringify(['confessions', 'secrets', 'unfiltered', 'safe-space']),
      is_encrypted: 1,
      encryption_passphrase: 'midnight2026',
      passphrase_salt: 'midnight_salt_2026',
      passphrase_hash: hashRoomPassphrase('midnight2026', 'midnight_salt_2026'),
      member_count: 88,
      is_hidden: 0,
      created_at: timeMinus(4320)
    }
  ];

  for (const g of groups) {
    db.run(
      `INSERT INTO chat_groups (id, name, description, topic, tags, is_encrypted, encryption_passphrase, passphrase_hash, passphrase_salt, member_count, is_hidden, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [g.id, g.name, g.description, g.topic, g.tags, g.is_encrypted, g.encryption_passphrase, g.passphrase_hash, g.passphrase_salt, g.member_count, g.is_hidden, g.created_at]
    );
  }

  // Seed encrypted group messages
  const messages = [
    {
      id: 'msg-w-1',
      group_id: 'group-whistleblowers',
      author_alias: 'CipherOperative_12',
      content: JSON.stringify({
        text: 'Welcome to the integrity vault. All communications in this room use client-side AES-256-GCM encryption. Never upload documents with unscrubbed PDF metadata.',
        is_system: false
      }),
      is_encrypted: 1,
      read_by: JSON.stringify(['DocumentWatch_88']),
      created_at: timeMinus(1200)
    },
    {
      id: 'msg-w-2',
      group_id: 'group-whistleblowers',
      author_alias: 'DocumentWatch_88',
      content: JSON.stringify({
        text: 'We are cross-referencing state campaign finance records against water infrastructure subcontracts. The paper trail is solid.',
        is_system: false
      }),
      is_encrypted: 1,
      read_by: JSON.stringify(['CipherOperative_12']),
      created_at: timeMinus(300)
    },
    {
      id: 'msg-c-1',
      group_id: 'group-caregivers',
      author_alias: 'GentleBreeze_5',
      content: JSON.stringify({
        text: 'To anyone who felt like giving up today: you woke up, you tried, you showed up with compassion. That is enough.',
        is_system: false
      }),
      is_encrypted: 1,
      read_by: JSON.stringify(['SolitaryAnchor_92']),
      created_at: timeMinus(850)
    }
  ];

  for (const m of messages) {
    db.run(
      `INSERT INTO group_messages (id, group_id, author_alias, content, is_encrypted, read_by, is_hidden, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [m.id, m.group_id, m.author_alias, m.content, m.is_encrypted, m.read_by, m.created_at]
    );
  }
}

function seedAnalytics(db: Database) {
  const now = Date.now();
  const timeOffset = (minsAgo: number) => new Date(now - minsAgo * 60 * 1000).toISOString();

  // Seed sample page visits across past 24-48 hours
  const visits = [
    // Whispers feed visits
    { path: '/', page_name: 'Whispers Feed', option_name: 'Topic: All', mins: 12 },
    { path: '/?topic=government_whistleblower', page_name: 'Whispers Feed', option_name: 'Topic: Whistleblower & Leaks', mins: 25 },
    { path: '/?topic=struggles', page_name: 'Whispers Feed', option_name: 'Topic: Life Struggles & Burnout', mins: 38 },
    { path: '/?sort=popular', page_name: 'Whispers Feed', option_name: 'Sort: Most Resonated (Popular)', mins: 50 },
    { path: '/?topic=secrets', page_name: 'Whispers Feed', option_name: 'Topic: Deep Secrets & Confessions', mins: 65 },
    { path: '/?search=water', page_name: 'Whispers Feed', option_name: 'Search: "water"', mins: 80 },
    { path: '/', page_name: 'Whispers Feed', option_name: 'Topic: All', mins: 110 },
    { path: '/?topic=government_whistleblower', page_name: 'Whispers Feed', option_name: 'Topic: Whistleblower & Leaks', mins: 140 },
    { path: '/?topic=struggles', page_name: 'Whispers Feed', option_name: 'Topic: Life Struggles & Burnout', mins: 180 },
    { path: '/?topic=daily_whisper', page_name: 'Whispers Feed', option_name: 'Topic: Daily Whispers', mins: 210 },
    { path: '/?sort=popular', page_name: 'Whispers Feed', option_name: 'Sort: Most Resonated (Popular)', mins: 250 },
    { path: '/?topic=government_whistleblower', page_name: 'Whispers Feed', option_name: 'Topic: Whistleblower & Leaks', mins: 320 },
    { path: '/?topic=secrets', page_name: 'Whispers Feed', option_name: 'Topic: Deep Secrets & Confessions', mins: 420 },
    { path: '/', page_name: 'Whispers Feed', option_name: 'Topic: All', mins: 510 },
    { path: '/?topic=struggles', page_name: 'Whispers Feed', option_name: 'Topic: Life Struggles & Burnout', mins: 620 },
    { path: '/?topic=government_whistleblower', page_name: 'Whispers Feed', option_name: 'Topic: Whistleblower & Leaks', mins: 750 },
    { path: '/', page_name: 'Whispers Feed', option_name: 'Topic: All', mins: 890 },
    { path: '/?sort=popular', page_name: 'Whispers Feed', option_name: 'Sort: Most Resonated (Popular)', mins: 1020 },

    // Encrypted Groups visits
    { path: '/groups', page_name: 'Encrypted Groups', option_name: 'Room: Whistleblower Circle', mins: 18 },
    { path: '/groups', page_name: 'Encrypted Groups', option_name: 'Room: Caregiver Sanctuary', mins: 42 },
    { path: '/groups', page_name: 'Encrypted Groups', option_name: 'Topic: All Encrypted Vaults', mins: 95 },
    { path: '/groups', page_name: 'Encrypted Groups', option_name: 'Room: The Midnight Vault', mins: 160 },
    { path: '/groups', page_name: 'Encrypted Groups', option_name: 'Room: Whistleblower Circle', mins: 290 },
    { path: '/groups', page_name: 'Encrypted Groups', option_name: 'Room: Caregiver Sanctuary', mins: 480 },
    { path: '/groups', page_name: 'Encrypted Groups', option_name: 'Create Encrypted Vault Dialog', mins: 720 },
    { path: '/groups', page_name: 'Encrypted Groups', option_name: 'Topic: Whistleblower', mins: 940 },

    // Crisis Helpline Resource visits
    { path: '/crisis-helpline', page_name: 'Crisis Helpline Resources', option_name: 'View Immediate Helplines', mins: 30 },
    { path: '/crisis-helpline', page_name: 'Crisis Helpline Resources', option_name: 'Crisis Text Line Guide', mins: 190 },
    { path: '/crisis-helpline', page_name: 'Crisis Helpline Resources', option_name: 'View Immediate Helplines', mins: 600 },
    { path: '/crisis-helpline', page_name: 'Crisis Helpline Resources', option_name: 'Emergency De-escalation', mins: 1100 },

    // Secret Admin visits
    { path: '/adminloginsecret', page_name: 'Secret Admin Portal', option_name: 'Passkey Auth Screen', mins: 45 },
    { path: '/adminloginsecret', page_name: 'Secret Admin Portal', option_name: 'Console Overview', mins: 43 },
    { path: '/adminloginsecret', page_name: 'Secret Admin Portal', option_name: 'Whispers Moderation Tab', mins: 40 }
  ];

  let vIdx = 1;
  for (const v of visits) {
    const id = `visit-init-${vIdx++}`;
    const sess = `anon_sess_${Math.floor(100 + (vIdx % 7))}`;
    db.run(
      `INSERT INTO page_visits (id, path, page_name, option_name, session_id, referrer, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, 'direct', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ?)`,
      [id, v.path, v.page_name, v.option_name, sess, timeOffset(v.mins)]
    );
  }

  // Seed popular options / feature interactions
  const interactions = [
    { cat: 'topic_filter', target: 'topic:government_whistleblower', label: 'Topic: Whistleblower & Leaks', count: 18 },
    { cat: 'topic_filter', target: 'topic:struggles', label: 'Topic: Life Struggles & Burnout', count: 24 },
    { cat: 'topic_filter', target: 'topic:secrets', label: 'Topic: Deep Secrets & Confessions', count: 16 },
    { cat: 'topic_filter', target: 'topic:daily_whisper', label: 'Topic: Daily Whispers', count: 11 },
    { cat: 'sort_filter', target: 'sort:popular', label: 'Sort: Most Resonated (Popular)', count: 29 },
    { cat: 'sort_filter', target: 'sort:newest', label: 'Sort: Newest First', count: 35 },
    { cat: 'search_query', target: 'search:water-crisis', label: 'Search: "water-crisis"', count: 7 },
    { cat: 'search_query', target: 'search:caregiver', label: 'Search: "caregiver"', count: 9 },
    { cat: 'group_action', target: 'group:enter_vault', label: 'Entered Encrypted Vault', count: 22 },
    { cat: 'group_action', target: 'group:decrypt_messages', label: 'Decrypted E2EE Messages', count: 31 },
    { cat: 'helpline_action', target: 'modal:open_crisis_support', label: 'Opened Immediate Crisis Support', count: 6 },
    { cat: 'privacy_action', target: 'panic:purge_keys', label: 'Triggered Emergency Key Purge', count: 4 }
  ];

  let iIdx = 1;
  for (const inter of interactions) {
    for (let c = 0; c < inter.count; c++) {
      const id = `inter-init-${iIdx++}`;
      const sess = `anon_sess_${Math.floor(100 + (c % 8))}`;
      const randomMins = Math.floor(Math.random() * 1440);
      db.run(
        `INSERT INTO feature_interactions (id, category, action_target, label, session_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, inter.cat, inter.target, inter.label, sess, timeOffset(randomMins)]
      );
    }
  }
}

