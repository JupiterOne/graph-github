import crypto from 'crypto';

export default function sha(text: string): string {
  const sha256 = crypto.createHash('sha256');
  sha256.update(text);
  return sha256.digest('hex').toString();
}
