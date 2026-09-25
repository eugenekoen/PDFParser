import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse key from .env file directly without external dependencies
function readEnvKey(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('GEMINI_API_KEY=')) {
      return trimmed.substring('GEMINI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
    }
  }
  return '';
}

const envServerKey = readEnvKey(path.resolve(__dirname, '../server/.env'));
const apiKey = (process.env.GEMINI_API_KEY || envServerKey || '').trim();
const passphrase = (process.env.APP_PASSPHRASE || 'Khfs-server1').trim();

const targetPath = path.resolve(__dirname, '../client/src/encryptedConfig.json');

if (!apiKey) {
  console.log('[encrypt-key] No GEMINI_API_KEY found. Writing placeholder.');
  fs.writeFileSync(targetPath, JSON.stringify({ isConfigured: false }, null, 2));
  process.exit(0);
}

// Encrypt apiKey with AES-256-GCM derived from passphrase
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');

const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();

// Combined ciphertext + 16-byte authTag for Web Crypto API compatibility
const combined = Buffer.concat([encrypted, tag]);

const payload = {
  isConfigured: true,
  salt: salt.toString('hex'),
  iv: iv.toString('hex'),
  data: combined.toString('hex'),
};

fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2));
console.log(`[encrypt-key] Successfully encrypted GEMINI_API_KEY with passphrase '${passphrase}' into client/src/encryptedConfig.json!`);
