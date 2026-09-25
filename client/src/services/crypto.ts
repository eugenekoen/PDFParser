import encryptedConfig from '../encryptedConfig.json';

const STORAGE_KEY = 'pdfparser_unlocked_gemini_key';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function hasEncryptedPayload(): boolean {
  return Boolean(encryptedConfig && encryptedConfig.isConfigured && encryptedConfig.data);
}

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveUnlockedApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Fallback
  }
}

export function clearUnlockedApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fallback
  }
}

/**
 * Decrypts the embedded API key using the user-provided passphrase
 * via browser native Web Crypto API (PBKDF2 + AES-256-GCM).
 */
export async function decryptApiKeyWithPassphrase(passphrase: string): Promise<string> {
  if (!hasEncryptedPayload()) {
    throw new Error('No encrypted configuration available in this build.');
  }

  const cleanPass = passphrase.trim();
  if (!cleanPass) {
    throw new Error('Please enter the passphrase.');
  }

  const salt = hexToBytes(encryptedConfig.salt!);
  const iv = hexToBytes(encryptedConfig.iv!);
  const ciphertextWithTag = hexToBytes(encryptedConfig.data!);

  const subtle = window.crypto.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API is not supported in this browser.');
  }

  // 1. Import passphrase
  const passKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(cleanPass),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // 2. Derive 256-bit AES-GCM key with 100,000 PBKDF2 iterations
  const derivedKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 3. Decrypt ciphertext & verify auth tag
  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
        tagLength: 128,
      },
      derivedKey,
      ciphertextWithTag as unknown as BufferSource
    );

    const apiKey = new TextDecoder().decode(decryptedBuffer);
    if (!apiKey) {
      throw new Error('Decryption resulted in empty key.');
    }

    saveUnlockedApiKey(apiKey);
    return apiKey;
  } catch (err: any) {
    throw new Error('Incorrect passphrase. Access denied.');
  }
}
