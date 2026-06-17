import { randomBytes } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';

import { CredentialCipherService } from './credential-cipher.service';

function configWith(key?: string): ConfigService {
  return {
    get: (name: string) => (name === 'POS_CREDENTIAL_KEY' ? key : undefined),
  } as unknown as ConfigService;
}

describe('CredentialCipherService', () => {
  const key = randomBytes(32).toString('base64');

  it('boots without a key but throws on use when missing', () => {
    const cipher = new CredentialCipherService(configWith(undefined));
    expect(() => cipher.encrypt({ apiKey: 'x' })).toThrow();
  });

  it('throws on use when the key is not 32 bytes', () => {
    const cipher = new CredentialCipherService(configWith('c2hvcnQ='));
    expect(() => cipher.encrypt({ apiKey: 'x' })).toThrow();
  });

  it('round-trips credentials through encrypt/decrypt', () => {
    const cipher = new CredentialCipherService(configWith(key));
    const creds = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expiresAt: '2030-01-01T00:00:00.000Z',
    };

    const encrypted = cipher.encrypt(creds);
    expect(encrypted.secretCipher).not.toContain('access-123');
    expect(encrypted.keyVersion).toBe(1);

    const decrypted = cipher.decrypt(encrypted);
    expect(decrypted).toEqual(creds);
  });

  it('uses a fresh IV per encryption', () => {
    const cipher = new CredentialCipherService(configWith(key));
    const a = cipher.encrypt({ apiKey: 'same' });
    const b = cipher.encrypt({ apiKey: 'same' });
    expect(a.cipherIv).not.toEqual(b.cipherIv);
    expect(a.secretCipher).not.toEqual(b.secretCipher);
  });

  it('rejects tampered ciphertext (GCM auth tag)', () => {
    const cipher = new CredentialCipherService(configWith(key));
    const encrypted = cipher.encrypt({ apiKey: 'secret' });
    const tampered = {
      ...encrypted,
      secretCipher: Buffer.from('tampered-bytes').toString('base64'),
    };
    expect(() => cipher.decrypt(tampered)).toThrow();
  });
});
