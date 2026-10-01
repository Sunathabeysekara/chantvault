/**
 * Client-Side End-to-End Encryption (E2EE) using Web Crypto API.
 * Uses AES-256-GCM with PBKDF2 (100,000 SHA-256 iterations) key derivation.
 * The server only receives ciphertext, IV, and salt. Plaintext is decrypted purely in the browser.
 */

// Helper to convert ArrayBuffer to Base64 string
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 string to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Derive a 256-bit AES-GCM CryptoKey from a user-supplied passphrase
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
  is_e2ee: boolean;
}

// Encrypt plaintext with passphrase
export async function encryptE2E(plainText: string, passphrase: string): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);

  // Generate 16 bytes salt and 12 bytes IV
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(passphrase, salt);
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    data
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    is_e2ee: true
  };
}

// Decrypt ciphertext with passphrase
export async function decryptE2E(payload: { ciphertext: string; iv: string; salt: string }, passphrase: string): Promise<string> {
  try {
    const salt = base64ToBuffer(payload.salt);
    const iv = base64ToBuffer(payload.iv);
    const ciphertext = base64ToBuffer(payload.ciphertext);

    const key = await deriveKey(passphrase, salt);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      ciphertext as any
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    throw new Error('Decryption failed: Incorrect key or corrupted ciphertext.');
  }
}

// Generate high-entropy mnemonic room passkey
export function generateRandomRoomPass(): string {
  const words = [
    'whisper', 'shadow', 'vault', 'cipher', 'echo', 'solitude', 'sanctuary',
    'beacon', 'aurora', 'phantom', 'shield', 'quiet', 'truth', 'nebula', 'glacier',
    'horizon', 'haven', 'solace', 'ember', 'vortex', 'obsidian', 'pulse'
  ];
  const selected: string[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * words.length);
    selected.push(words[idx]);
  }
  const num = Math.floor(100 + Math.random() * 900);
  return `${selected.join('-')}-${num}`;
}

// Session Key Vault storage (in memory/sessionStorage)
const SESSION_PREFIX = 'chantvault_key_';

export function saveRoomKey(groupId: string, passkey: string): void {
  try {
    sessionStorage.setItem(SESSION_PREFIX + groupId, passkey);
  } catch (e) {
    // Ignore storage issues
  }
}

export function getRoomKey(groupId: string): string | null {
  try {
    return sessionStorage.getItem(SESSION_PREFIX + groupId);
  } catch (e) {
    return null;
  }
}

export function clearAllRoomKeys(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(SESSION_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch (e) {
    // Ignore
  }
}

/**
 * Robust clipboard copy with multi-tier fallback for iframe / restricted browser environments
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern async clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Proceed to fallback on security / focus / permission exception
    }
  }

  // 2. Fallback using temporary textarea in viewport
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '10px';
    textArea.style.left = '10px';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0.01';
    textArea.style.zIndex = '-1000';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
  }

  return false;
}

