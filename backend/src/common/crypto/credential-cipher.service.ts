import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ProviderCredentials } from '../../modules/pos/types/provider.types';

export interface EncryptedSecret {
  secretCipher: string;
  cipherIv: string;
  cipherAuthTag: string;
  keyVersion: number;
}

const ALGORITHM = 'aes-256-gcm';
const KEY_VERSION = 1;

/**
 * Encrypts/decrypts POS provider credentials at rest using AES-256-GCM.
 * The 32-byte key is supplied (base64) via POS_CREDENTIAL_KEY and never stored
 * with the ciphertext. Each encryption uses a fresh random IV.
 */
@Injectable()
export class CredentialCipherService {
  private key?: Buffer;

  constructor(private readonly config: ConfigService) {}

  /**
   * Resolves and caches the encryption key lazily so the app can boot without
   * POS_CREDENTIAL_KEY configured — the error only surfaces when POS credentials
   * are actually encrypted/decrypted, not at startup.
   */
  private resolveKey(): Buffer {
    if (this.key) return this.key;
    const raw = this.config.get<string>('POS_CREDENTIAL_KEY');
    if (!raw) {
      throw new InternalServerErrorException('POS_CREDENTIAL_KEY is not configured.');
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new InternalServerErrorException('POS_CREDENTIAL_KEY must be 32 bytes (base64).');
    }
    this.key = key;
    return key;
  }

  encrypt(credentials: ProviderCredentials): EncryptedSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.resolveKey(), iv);
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

  decrypt(secret: EncryptedSecret): ProviderCredentials {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.resolveKey(),
      Buffer.from(secret.cipherIv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(secret.cipherAuthTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(secret.secretCipher, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString('utf8')) as ProviderCredentials;
  }
}
