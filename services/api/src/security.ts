import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export class PhoneProtector {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly lookupSecret: string,
    encryptionKeyBase64: string,
  ) {
    this.encryptionKey = Buffer.from(encryptionKeyBase64, 'base64');
    if (this.encryptionKey.length !== 32) {
      throw new Error('PHONE_ENCRYPTION_KEY_BASE64 must decode to 32 bytes.');
    }
  }

  lookupHash(phoneNumber: string): string {
    return createHmac('sha256', this.lookupSecret)
      .update(phoneNumber)
      .digest('hex');
  }

  encrypt(phoneNumber: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(phoneNumber, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  decrypt(value: string): string {
    const [version, ivValue, tagValue, ciphertextValue] = value.split('.');
    if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
      throw new Error('Unsupported phone ciphertext.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}

export class SecretHasher {
  constructor(private readonly secret: string) {}

  hash(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('hex');
  }

  verify(value: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(value), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

export function createOpaqueToken(prefix: 'sb_at' | 'sb_rt'): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}
