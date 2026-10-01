import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.resolve(process.cwd(), 'data', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app_errors.log');

// Ensure log directory exists
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    const initialHeader = `[${new Date().toISOString()}] [INFO] System error log initialized.\n`;
    fs.writeFileSync(LOG_FILE, initialHeader, 'utf8');
  }
}

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'RATE_LIMIT' | 'SECURITY';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  ip?: string;
  method?: string;
  route?: string;
  message: string;
  stack?: string;
  raw: string;
}

export function logToFile(
  level: LogLevel,
  message: string,
  options?: {
    req?: any;
    error?: any;
    ip?: string;
    route?: string;
    method?: string;
  }
) {
  try {
    ensureLogDir();
    const timestamp = new Date().toISOString();
    const ip = options?.ip || options?.req?.headers['x-forwarded-for'] || options?.req?.socket?.remoteAddress || 'unknown';
    const method = options?.method || options?.req?.method || '-';
    const route = options?.route || options?.req?.originalUrl || options?.req?.url || '-';
    
    let stackStr = '';
    if (options?.error instanceof Error && options.error.stack) {
      stackStr = '\n    ' + options.error.stack.split('\n').slice(1).join('\n    ');
    } else if (options?.error && typeof options.error === 'object') {
      stackStr = '\n    Details: ' + JSON.stringify(options.error);
    }

    const logLine = `[${timestamp}] [${level}] [${ip}] [${method} ${route}] ${message}${stackStr}\n`;
    
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');

    // Also output to server console for dev awareness
    if (level === 'ERROR' || level === 'SECURITY') {
      console.error(`[${level}] ${message}`, options?.error || '');
    } else if (level === 'WARN' || level === 'RATE_LIMIT') {
      console.warn(`[${level}] ${message}`);
    } else {
      console.log(`[${level}] ${message}`);
    }
  } catch (e) {
    console.error('Failed to write to app_errors.log:', e);
  }
}

export function readLogEntries(limit = 200, filterLevel?: string): {
  entries: LogEntry[];
  stats: {
    totalEntries: number;
    fileSizeBytes: number;
    fileSizeKb: number;
    filePath: string;
    lastModified: string | null;
  };
} {
  ensureLogDir();

  let fileSizeBytes = 0;
  let lastModified: string | null = null;

  try {
    const stat = fs.statSync(LOG_FILE);
    fileSizeBytes = stat.size;
    lastModified = stat.mtime.toISOString();
  } catch (e) {
    // Ignore
  }

  let content = '';
  try {
    content = fs.readFileSync(LOG_FILE, 'utf8');
  } catch (e) {
    return {
      entries: [],
      stats: {
        totalEntries: 0,
        fileSizeBytes,
        fileSizeKb: Math.round(fileSizeBytes / 1024),
        filePath: LOG_FILE,
        lastModified
      }
    };
  }

  // Split lines into entries (each entry starts with [YYYY-MM...)
  const lines = content.split('\n');
  const entries: LogEntry[] = [];
  let currentEntry: LogEntry | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const match = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+\[(.*?)\]\s+\[(.*?)\s+(.*?)\]\s+(.*)$/);
    if (match) {
      if (currentEntry) {
        entries.push(currentEntry);
      }
      currentEntry = {
        id: 'log-' + entries.length + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: match[1],
        level: (match[2] as LogLevel) || 'INFO',
        ip: match[3],
        method: match[4],
        route: match[5],
        message: match[6],
        raw: line
      };
    } else if (currentEntry) {
      // Continuation of previous stack trace or multiline detail
      currentEntry.stack = (currentEntry.stack ? currentEntry.stack + '\n' : '') + line;
      currentEntry.raw += '\n' + line;
    } else {
      // Fallback simple line
      entries.push({
        id: 'log-' + entries.length + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: line,
        raw: line
      });
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  const totalEntries = entries.length;

  let filtered = entries;
  if (filterLevel && filterLevel !== 'ALL') {
    filtered = filtered.filter(e => e.level === filterLevel);
  }

  // Return newest first, capped to limit
  const returned = filtered.reverse().slice(0, limit);

  return {
    entries: returned,
    stats: {
      totalEntries,
      fileSizeBytes,
      fileSizeKb: Math.round(fileSizeBytes / 1024),
      filePath: LOG_FILE,
      lastModified
    }
  };
}

export function clearLogFile(): { success: boolean; message: string } {
  try {
    ensureLogDir();
    const timestamp = new Date().toISOString();
    const resetContent = `[${timestamp}] [INFO] [system] [- -] Log file cleared by Administrator.\n`;
    fs.writeFileSync(LOG_FILE, resetContent, 'utf8');
    return { success: true, message: 'Log file successfully cleared.' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export function getLogFilePath(): string {
  ensureLogDir();
  return LOG_FILE;
}
