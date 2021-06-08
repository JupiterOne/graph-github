import crypto from 'crypto';

export default function sha(text: string): string {
  const sha256 = crypto.createHash('sha256');
  sha256.update(text);
  return sha256.digest('hex').toString();
}

export function getFakeRsaKey(): string {
  const cryptoResult = crypto.generateKeyPairSync('rsa', {
    // The standard secure default length for RSA keys is 2048 bits
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return cryptoResult.privateKey.toString();
}
