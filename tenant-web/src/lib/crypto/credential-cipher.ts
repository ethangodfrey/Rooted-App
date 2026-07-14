import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_VERSION = 1;

/** Sealed POS credential payload (matches Nest ProviderCredentials intent). */
export interface PosCredentialSecret {
  accessToken: string;
  refreshToken?: string | null;
  merchantId?: string | null;
  locationId?: string | null;
  expiresAt?: string | null;
}

export interface EncryptedSecret {
  secretCipher: string;
  cipherIv: string;
  cipherAuthTag: string;
  keyVersion: number;
}

function resolveKey(): Buffer {
  const raw = process.env.POS_CREDENTIAL_KEY?.trim();
  if (!raw) {
    throw new Error('POS_CREDENTIAL_KEY is not configured');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('POS_CREDENTIAL_KEY must be 32 bytes (base64)');
  }
  return key;
}

/** Encrypt POS tokens with AES-256-GCM. Fresh IV per write. */
export function encryptCredentials(credentials: PosCredentialSecret): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, resolveKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(credentials), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    secretCipher: ciphertext.toString('base64'),
    cipherIv: iv.toString('base64'),
    cipherAuthTag: authTag.toString('base64'),
    keyVersion: KEY_VERSION,
  };
}

/** Decrypt a vault row previously written by encryptCredentials / Nest cipher. */
export function decryptCredentials(secret: EncryptedSecret): PosCredentialSecret {
  const decipher = createDecipheriv(
    ALGORITHM,
    resolveKey(),
    Buffer.from(secret.cipherIv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(secret.cipherAuthTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(secret.secretCipher, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as PosCredentialSecret;
}
