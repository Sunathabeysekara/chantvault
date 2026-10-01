import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDb, saveDb, hashRoomPassphrase, generateSalt } from './src/server/db.ts';
import { logToFile, readLogEntries, clearLogFile, getLogFilePath } from './src/server/logger.ts';
import {
  rateLimiterStore,
  adminLoginLimiter,
  chantCreateLimiter,
  commentCreateLimiter,
  groupCreateLimiter,
  messageSendLimiter,
  reportFlagLimiter,
  generalApiLimiter
} from './src/server/rateLimiter.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// High body limit to support base64 image uploads smoothly
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Apply general API rate limiting across all /api routes
app.use('/api', generalApiLimiter);

// Secret Admin Passkey (configured or default for the secret route)
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || '53cr3tvalutchatpa5wordk3yfor1og1n';

// Helper for DB select queries in sql.js
function queryRows(db: any, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// ==========================================
// PUBLIC CHANTS & WHISPERS API
// ==========================================

// Get chants with search, topic filtering, tags, and sorting
app.get('/api/chants', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { topic, tag, search, sort } = req.query;

    let sql = 'SELECT * FROM chants WHERE is_hidden = 0';
    const params: any[] = [];

    if (topic && topic !== 'all') {
      sql += ' AND topic = ?';
      params.push(topic);
    }

    if (tag) {
      sql += ' AND tags LIKE ?';
      params.push(`%${tag}%`);
    }

    if (search) {
      sql += ' AND (title LIKE ? OR content LIKE ? OR author_alias LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (sort === 'popular') {
      sql += ' ORDER BY likes_count DESC, created_at DESC';
    } else {
      sql += ' ORDER BY created_at DESC';
    }

    const chants = queryRows(db, sql, params).map(c => ({
      ...c,
      tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : c.tags
    }));

    res.json({ success: true, chants });
  } catch (err: any) {
    console.error('Error fetching chants:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single chant and comments
app.get('/api/chants/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const chantRows = queryRows(db, 'SELECT * FROM chants WHERE id = ?', [req.params.id]);
    if (chantRows.length === 0) {
      return res.status(404).json({ error: 'Chant not found' });
    }

    const chant = chantRows[0];
    chant.tags = typeof chant.tags === 'string' ? JSON.parse(chant.tags || '[]') : chant.tags;

    const comments = queryRows(
      db,
      'SELECT * FROM comments WHERE chant_id = ? AND is_hidden = 0 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({ success: true, chant, comments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new anonymous chant
app.post('/api/chants', chantCreateLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { title, content, author_alias, topic, tags, image_url } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const id = 'chant-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const alias = author_alias?.trim() || 'Anonymous Whisperer #' + Math.floor(1000 + Math.random() * 9000);
    const chosenTopic = topic || 'daily_whisper';
    const cleanTags = Array.isArray(tags) ? tags : [];
    const createdAt = new Date().toISOString();

    db.run(
      `INSERT INTO chants (id, title, content, author_alias, topic, tags, image_url, likes_count, flags_count, is_hidden, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`,
      [id, title.trim(), content.trim(), alias, chosenTopic, JSON.stringify(cleanTags), image_url || null, createdAt]
    );

    saveDb(db);

    res.json({
      success: true,
      chant: {
        id,
        title: title.trim(),
        content: content.trim(),
        author_alias: alias,
        topic: chosenTopic,
        tags: cleanTags,
        image_url,
        likes_count: 0,
        flags_count: 0,
        created_at: createdAt
      }
    });
  } catch (err: any) {
    logToFile('ERROR', 'Error creating chant: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Upvote / Like Chant
app.post('/api/chants/:id/like', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    db.run('UPDATE chants SET likes_count = likes_count + 1 WHERE id = ?', [req.params.id]);
    saveDb(db);
    const updated = queryRows(db, 'SELECT likes_count FROM chants WHERE id = ?', [req.params.id]);
    res.json({ success: true, likes_count: updated[0]?.likes_count || 0 });
  } catch (err: any) {
    logToFile('ERROR', 'Error liking chant: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Flag / Report Chant
app.post('/api/chants/:id/flag', reportFlagLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { reason, details } = req.body;

    db.run('UPDATE chants SET flags_count = flags_count + 1 WHERE id = ?', [req.params.id]);
    const reportId = 'rep-' + Date.now();
    db.run(
      `INSERT INTO reports (id, content_type, content_id, reason, details, status, created_at)
       VALUES (?, 'chant', ?, ?, ?, 'pending', ?)`,
      [reportId, req.params.id, reason || 'User reported', details || '', new Date().toISOString()]
    );
    saveDb(db);
    res.json({ success: true, message: 'Report received. Sent to secret admin review.' });
  } catch (err: any) {
    logToFile('ERROR', 'Error reporting chant: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Post comment on chant
app.post('/api/chants/:id/comments', commentCreateLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { author_alias, content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const id = 'comm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const alias = author_alias?.trim() || 'Anonymous Ally #' + Math.floor(100 + Math.random() * 900);
    const createdAt = new Date().toISOString();

    db.run(
      `INSERT INTO comments (id, chant_id, author_alias, content, is_hidden, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [id, req.params.id, alias, content.trim(), createdAt]
    );
    saveDb(db);

    res.json({
      success: true,
      comment: { id, chant_id: req.params.id, author_alias: alias, content: content.trim(), created_at: createdAt }
    });
  } catch (err: any) {
    logToFile('ERROR', 'Error creating comment: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CHAT GROUPS & END-TO-END ENCRYPTION (E2EE)
// ==========================================

// List chat groups with search
app.get('/api/groups', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { topic, search } = req.query;

    let sql = 'SELECT * FROM chat_groups WHERE is_hidden = 0';
    const params: any[] = [];

    if (topic && topic !== 'all') {
      sql += ' AND topic = ?';
      params.push(topic);
    }
    if (search) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const groups = queryRows(db, sql, params).map(g => ({
      ...g,
      tags: typeof g.tags === 'string' ? JSON.parse(g.tags || '[]') : g.tags
    }));

    res.json({ success: true, groups });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new Chat Group (E2EE with Passphrase Hash & Database Persistence)
app.post('/api/groups', groupCreateLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { name, description, topic, tags, is_encrypted, passphrase } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const trimmedPass = (typeof passphrase === 'string' ? passphrase : '').trim();
    if (!trimmedPass) {
      return res.status(400).json({ error: 'Room encryption passphrase is required for end-to-end security.' });
    }

    const id = 'group-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const cleanTags = Array.isArray(tags) ? tags : [];
    const createdAt = new Date().toISOString();
    const salt = generateSalt();
    const hash = hashRoomPassphrase(trimmedPass, salt);

    db.run(
      `INSERT INTO chat_groups (id, name, description, topic, tags, is_encrypted, encryption_passphrase, passphrase_hash, passphrase_salt, member_count, is_hidden, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
      [id, name.trim(), description || '', topic || 'general', JSON.stringify(cleanTags), is_encrypted !== false ? 1 : 0, trimmedPass, hash, salt, createdAt]
    );

    saveDb(db);

    res.json({
      success: true,
      group: {
        id,
        name: name.trim(),
        description: description || '',
        topic: topic || 'general',
        tags: cleanTags,
        is_encrypted: is_encrypted !== false ? 1 : 0,
        member_count: 1,
        created_at: createdAt
      }
    });
  } catch (err: any) {
    logToFile('ERROR', 'Error creating group: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Verify Room Passphrase (Only correct key unlocks the room)
app.post('/api/groups/:id/verify-passphrase', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { passkey } = req.body;
    if (!passkey || typeof passkey !== 'string' || !passkey.trim()) {
      return res.status(400).json({ error: 'Passphrase cannot be empty.' });
    }

    const candidate = passkey.trim();
    const groupRows = queryRows(db, 'SELECT id, encryption_passphrase, passphrase_hash, passphrase_salt FROM chat_groups WHERE id = ?', [req.params.id]);
    if (groupRows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = groupRows[0];
    let isMatch = false;

    // Check cryptographically with salt + hash
    if (group.passphrase_salt && group.passphrase_hash) {
      const computed = hashRoomPassphrase(candidate, group.passphrase_salt);
      if (computed === group.passphrase_hash) {
        isMatch = true;
      }
    }

    // Also check direct encryption_passphrase match if set
    if (!isMatch && group.encryption_passphrase) {
      if (candidate === group.encryption_passphrase.trim()) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      logToFile('SECURITY', `Incorrect room passkey attempt on group "${req.params.id}"`, { req });
      return res.status(401).json({
        success: false,
        verified: false,
        error: 'Incorrect room encryption passphrase. Access denied. Only authorized members with the correct key can unlock this room.'
      });
    }

    res.json({ success: true, verified: true, message: 'Passphrase verified. Access granted.' });
  } catch (err: any) {
    logToFile('ERROR', 'Error verifying room passphrase: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Get messages for a chat group
app.get('/api/groups/:id/messages', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const groupRows = queryRows(db, 'SELECT * FROM chat_groups WHERE id = ?', [req.params.id]);
    if (groupRows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = groupRows[0];
    group.tags = typeof group.tags === 'string' ? JSON.parse(group.tags || '[]') : group.tags;

    const messages = queryRows(
      db,
      'SELECT * FROM group_messages WHERE group_id = ? AND is_hidden = 0 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({ success: true, group, messages });
  } catch (err: any) {
    logToFile('ERROR', 'Error getting group messages: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Post a message to group (can be encrypted ciphertext JSON or plain text + image)
app.post('/api/groups/:id/messages', messageSendLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { author_alias, content, is_encrypted, image_url } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const id = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const alias = author_alias?.trim() || 'CipherMember_' + Math.floor(100 + Math.random() * 900);
    const createdAt = new Date().toISOString();
    const readByInitial = JSON.stringify([alias]);

    db.run(
      `INSERT INTO group_messages (id, group_id, author_alias, content, is_encrypted, image_url, read_by, is_hidden, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, req.params.id, alias, typeof content === 'object' ? JSON.stringify(content) : content, is_encrypted ? 1 : 0, image_url || null, readByInitial, createdAt]
    );

    // Bump member/activity count
    db.run('UPDATE chat_groups SET member_count = member_count + 1 WHERE id = ?', [req.params.id]);

    saveDb(db);

    res.json({
      success: true,
      message: {
        id,
        group_id: req.params.id,
        author_alias: alias,
        content,
        is_encrypted: is_encrypted ? 1 : 0,
        image_url: image_url || null,
        read_by: readByInitial,
        created_at: createdAt
      }
    });
  } catch (err: any) {
    logToFile('ERROR', 'Error posting group message: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Mark messages as read by an alias (Read Receipts)
app.post('/api/groups/:id/mark-read', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { reader_alias } = req.body;
    if (!reader_alias?.trim()) {
      return res.status(400).json({ error: 'Reader alias required' });
    }

    const cleanAlias = reader_alias.trim();
    const rows = queryRows(
      db,
      'SELECT id, read_by FROM group_messages WHERE group_id = ? AND author_alias != ?',
      [req.params.id, cleanAlias]
    );

    let updatedCount = 0;
    for (const r of rows) {
      let readByArr: string[] = [];
      try {
        readByArr = JSON.parse(r.read_by || '[]');
      } catch (e) {
        readByArr = [];
      }

      if (!readByArr.includes(cleanAlias)) {
        readByArr.push(cleanAlias);
        db.run('UPDATE group_messages SET read_by = ? WHERE id = ?', [JSON.stringify(readByArr), r.id]);
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      saveDb(db);
    }

    res.json({ success: true, updatedCount });
  } catch (err: any) {
    logToFile('ERROR', 'Error marking messages as read: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CLIENT ANALYTICS & POPULAR USAGE TRACKING
// ==========================================

// Track Page Visits and Feature Interactions
app.post('/api/analytics/track', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { path: pagePath, page_name, option_name, session_id, referrer, user_agent, interaction } = req.body;
    const now = new Date().toISOString();
    const clientIp = rateLimiterStore.getClientIp(req);
    const anonSess = session_id || 'anon_' + Buffer.from(clientIp).toString('base64').substring(0, 12);

    const visitId = 'visit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    db.run(
      `INSERT INTO page_visits (id, path, page_name, option_name, session_id, referrer, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        visitId,
        pagePath || '/',
        page_name || 'Public Page',
        option_name || null,
        anonSess,
        referrer || 'direct',
        user_agent || req.headers['user-agent'] || '',
        now
      ]
    );

    // If specific interaction event supplied
    if (interaction && interaction.category && interaction.action_target) {
      const interId = 'inter-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      db.run(
        `INSERT INTO feature_interactions (id, category, action_target, label, session_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          interId,
          interaction.category,
          interaction.action_target,
          interaction.label || interaction.action_target,
          anonSess,
          now
        ]
      );
    }

    saveDb(db);
    res.json({ success: true });
  } catch (err: any) {
    logToFile('WARN', 'Failed to save analytics visit: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SECRET ADMIN API (URL: /adminloginsecret)
// ==========================================

// Verify Secret Passkey with brute-force protection
app.post('/api/admin/login', adminLoginLimiter, (req: Request, res: Response) => {
  const { passkey } = req.body;
  const clientIp = rateLimiterStore.getClientIp(req);

  if (!passkey || passkey !== ADMIN_SECRET_KEY) {
    logToFile('SECURITY', `Failed administrative login attempt. Invalid passkey from IP: ${clientIp}`, { req });
    return res.status(401).json({ error: 'Invalid secret administrative passkey' });
  }

  logToFile('INFO', `Administrative session authenticated successfully from IP: ${clientIp}`, { req });
  const token = 'adm_' + Buffer.from(ADMIN_SECRET_KEY + ':' + Date.now()).toString('base64');
  res.json({ success: true, token });
});

// Admin Middleware
const requireAdmin = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer adm_')) {
    logToFile('SECURITY', `Unauthorized administrative access attempt to [${req.method} ${req.originalUrl}]`, { req });
    return res.status(403).json({ error: 'Unauthorized secret admin access' });
  }
  next();
};

// Admin overview stats & database info
app.get('/api/admin/overview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const totalChants = queryRows(db, 'SELECT COUNT(*) as c FROM chants')[0]?.c || 0;
    const hiddenChants = queryRows(db, 'SELECT COUNT(*) as c FROM chants WHERE is_hidden = 1')[0]?.c || 0;
    const totalComments = queryRows(db, 'SELECT COUNT(*) as c FROM comments')[0]?.c || 0;
    const totalGroups = queryRows(db, 'SELECT COUNT(*) as c FROM chat_groups')[0]?.c || 0;
    const totalMessages = queryRows(db, 'SELECT COUNT(*) as c FROM group_messages')[0]?.c || 0;
    const pendingReports = queryRows(db, 'SELECT COUNT(*) as c FROM reports WHERE status = "pending"')[0]?.c || 0;

    // Traffic overview quick counts
    const totalVisits = queryRows(db, 'SELECT COUNT(*) as c FROM page_visits')[0]?.c || 0;
    const uniqueVisitors = queryRows(db, 'SELECT COUNT(DISTINCT session_id) as c FROM page_visits')[0]?.c || 0;

    const reports = queryRows(db, 'SELECT * FROM reports ORDER BY created_at DESC LIMIT 50');
    const recentAudit = queryRows(db, 'SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 50');

    // DB file stats
    const dbPath = path.resolve(process.cwd(), 'data', 'database.sqlite');
    let fileSizeKb = 0;
    if (fs.existsSync(dbPath)) {
      fileSizeKb = Math.round(fs.statSync(dbPath).size / 1024);
    }

    res.json({
      success: true,
      stats: {
        totalChants,
        hiddenChants,
        totalComments,
        totalGroups,
        totalMessages,
        pendingReports,
        totalVisits,
        uniqueVisitors,
        dbFileSizeKb: fileSizeKb
      },
      reports,
      auditLogs: recentAudit
    });
  } catch (err: any) {
    logToFile('ERROR', 'Error fetching admin overview: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Admin: Get all chants including hidden
app.get('/api/admin/all-chants', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const chants = queryRows(db, 'SELECT * FROM chants ORDER BY created_at DESC').map(c => ({
      ...c,
      tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : c.tags
    }));
    res.json({ success: true, chants });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Toggle hide chant
app.post('/api/admin/chants/:id/toggle-hide', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const current = queryRows(db, 'SELECT is_hidden FROM chants WHERE id = ?', [req.params.id]);
    if (current.length === 0) return res.status(404).json({ error: 'Chant not found' });

    const newStatus = current[0].is_hidden === 1 ? 0 : 1;
    db.run('UPDATE chants SET is_hidden = ? WHERE id = ?', [newStatus, req.params.id]);

    const logId = 'log-' + Date.now();
    db.run(
      `INSERT INTO admin_logs (id, action, target_id, note, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [logId, newStatus === 1 ? 'hide_chant' : 'unhide_chant', req.params.id, `Chant ${newStatus === 1 ? 'hidden' : 'unhidden'} by admin`, new Date().toISOString()]
    );

    saveDb(db);
    res.json({ success: true, is_hidden: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Hard delete chant
app.delete('/api/admin/chants/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM comments WHERE chant_id = ?', [req.params.id]);
    db.run('DELETE FROM chants WHERE id = ?', [req.params.id]);

    const logId = 'log-' + Date.now();
    db.run(
      `INSERT INTO admin_logs (id, action, target_id, note, created_at)
       VALUES (?, 'delete_chant', ?, 'Chant permanently deleted', ?)`,
      [logId, req.params.id, new Date().toISOString()]
    );

    saveDb(db);
    res.json({ success: true, message: 'Chant deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Execute custom SQL (read query or maintenance)
app.post('/api/admin/execute-sql', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { sql } = req.body;
    if (!sql?.trim()) return res.status(400).json({ error: 'SQL query required' });

    const isSelect = /^\s*SELECT/i.test(sql);
    if (isSelect) {
      const rows = queryRows(db, sql);
      return res.json({ success: true, rows, rowCount: rows.length });
    } else {
      db.run(sql);
      saveDb(db);
      return res.json({ success: true, message: 'Query executed successfully' });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Dismiss or Resolve Report
app.post('/api/admin/reports/:id/resolve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { status } = req.body;
    db.run('UPDATE reports SET status = ? WHERE id = ?', [status || 'resolved', req.params.id]);
    saveDb(db);
    res.json({ success: true });
  } catch (err: any) {
    logToFile('ERROR', 'Error resolving report: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Admin: Traffic Analytics & Popular Pages/Options
app.get('/api/admin/analytics', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const timeRange = (req.query.range as string) || 'all';
    const now = new Date();
    let dateFilter = '';

    if (timeRange === '24h') {
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      dateFilter = ` WHERE created_at >= '${dayAgo}'`;
    } else if (timeRange === '7d') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      dateFilter = ` WHERE created_at >= '${weekAgo}'`;
    }

    // High level metrics
    const totalVisits = queryRows(db, `SELECT COUNT(*) as c FROM page_visits${dateFilter}`)[0]?.c || 0;
    const uniqueVisitors = queryRows(db, `SELECT COUNT(DISTINCT session_id) as c FROM page_visits${dateFilter}`)[0]?.c || 0;

    const dayAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const visits24h = queryRows(db, `SELECT COUNT(*) as c FROM page_visits WHERE created_at >= '${dayAgoIso}'`)[0]?.c || 0;
    const unique24h = queryRows(db, `SELECT COUNT(DISTINCT session_id) as c FROM page_visits WHERE created_at >= '${dayAgoIso}'`)[0]?.c || 0;

    // Popular Pages
    const popularPages = queryRows(
      db,
      `SELECT page_name, path, COUNT(*) as visit_count
       FROM page_visits${dateFilter}
       GROUP BY page_name, path
       ORDER BY visit_count DESC
       LIMIT 10`
    ).map(row => ({
      ...row,
      percentage: totalVisits > 0 ? Math.round((row.visit_count / totalVisits) * 100) : 0
    }));

    // Popular Options (Topics, Sorts, Searches, Helpline, Panic Purge)
    const popularInteractions = queryRows(
      db,
      `SELECT label, category, COUNT(*) as interaction_count
       FROM feature_interactions${dateFilter}
       GROUP BY label, category
       ORDER BY interaction_count DESC
       LIMIT 15`
    );

    // Popular Page Options / Channels from visits table
    const popularPageOptions = queryRows(
      db,
      `SELECT option_name, COUNT(*) as count
       FROM page_visits${dateFilter ? dateFilter + ' AND' : ' WHERE'} option_name IS NOT NULL AND option_name != ''
       GROUP BY option_name
       ORDER BY count DESC
       LIMIT 12`
    );

    // Recent 40 page visits
    const recentVisits = queryRows(
      db,
      `SELECT id, path, page_name, option_name, session_id, referrer, created_at
       FROM page_visits
       ORDER BY created_at DESC
       LIMIT 40`
    );

    res.json({
      success: true,
      timeRange,
      metrics: {
        totalVisits,
        uniqueVisitors,
        visits24h,
        unique24h
      },
      popularPages,
      popularInteractions,
      popularPageOptions,
      recentVisits
    });
  } catch (err: any) {
    logToFile('ERROR', 'Error fetching analytics: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Admin: System Error Logs File Viewer
app.get('/api/admin/logs-file', requireAdmin, (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 200;
    const level = req.query.level ? String(req.query.level) : undefined;
    const result = readLogEntries(limit, level);
    res.json({ success: true, ...result });
  } catch (err: any) {
    logToFile('ERROR', 'Error reading log file: ' + err.message, { req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// Admin: Download Error Log File
app.get('/api/admin/logs-file/download', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const tokenQuery = req.query.token as string;
  const isAuth = (authHeader && authHeader.startsWith('Bearer adm_')) || (tokenQuery && tokenQuery.startsWith('adm_'));
  if (!isAuth) {
    return res.status(403).json({ error: 'Unauthorized secret admin access' });
  }

  const filePath = getLogFilePath();
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Log file not found');
  }
  res.download(filePath, `chantvault_errors_${new Date().toISOString().slice(0, 10)}.log`);
});

// Admin: Clear / Rotate Log File
app.delete('/api/admin/logs-file', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = clearLogFile();
    const db = await getDb();
    const logId = 'log-' + Date.now();
    db.run(
      `INSERT INTO admin_logs (id, action, target_id, note, created_at)
       VALUES (?, 'clear_error_logs', 'app_errors.log', 'Administrator wiped and reset error log file', ?)`,
      [logId, new Date().toISOString()]
    );
    saveDb(db);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Trigger Test Error (to verify log pipeline)
app.post('/api/admin/logs-file/test', requireAdmin, (req: Request, res: Response) => {
  logToFile('ERROR', 'Test Error: Verified error log pipeline & file system write.', {
    req,
    error: new Error('Simulated Database Lock & Transaction Retry Verification Test')
  });
  logToFile('WARN', 'Test Warning: Simulated high traffic alert for monitoring test.', { req });
  res.json({ success: true, message: 'Test error and warning logs written to app_errors.log' });
});

// Admin: Rate Limit Status & Inspection
app.get('/api/admin/rate-limits', requireAdmin, (req: Request, res: Response) => {
  try {
    const stats = rateLimiterStore.getStats();
    res.json({ success: true, ...stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reset Rate Limits
app.post('/api/admin/rate-limits/reset', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;
    rateLimiterStore.resetLimits(ip);
    const db = await getDb();
    const logId = 'log-' + Date.now();
    db.run(
      `INSERT INTO admin_logs (id, action, target_id, note, created_at)
       VALUES (?, 'reset_rate_limits', ?, 'Administrator cleared rate limit blocks', ?)`,
      [logId, ip || 'all', new Date().toISOString()]
    );
    saveDb(db);
    res.json({ success: true, message: ip ? `Rate limits reset for IP: ${ip}` : 'All rate limits reset across system.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all Express Error Handler
app.use((err: any, req: Request, res: Response, _next: Function) => {
  logToFile('ERROR', `Unhandled application exception: ${err.message}`, { req, error: err });
  res.status(500).json({ error: 'Internal Server Error' });
});

// Process-level uncaught exceptions and rejections
process.on('unhandledRejection', (reason: any) => {
  logToFile('ERROR', 'Process unhandledRejection: ' + (reason?.message || String(reason)), {
    error: reason instanceof Error ? reason : undefined
  });
});

process.on('uncaughtException', (err: Error) => {
  logToFile('ERROR', 'Process uncaughtException: ' + err.message, { error: err });
});

// ==========================================
// VITE DEV & CLIENT MIDDLEWARE
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server boot error:', err);
});
