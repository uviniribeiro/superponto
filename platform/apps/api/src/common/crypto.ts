import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Cifra AES-256-GCM: "v1.<iv>.<tag>.<dados>" em base64url. A chave nunca sai da API. */
export class FieldCipher {
  private readonly key: Buffer;
  constructor(keyBase64: string) {
    this.key = Buffer.from(keyBase64, 'base64');
    if (this.key.length !== 32) throw new Error('A chave de cifra precisa ter 32 bytes (base64)');
  }
  encrypt(plain: Buffer): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([c.update(plain), c.final()]);
    return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
  }
  decrypt(token: string): Buffer {
    const [v, iv, tag, data] = token.split('.');
    if (v !== 'v1' || !iv || !tag || !data) throw new Error('Formato de dado cifrado inválido');
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]);
  }
}

export const sha256Hex = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
