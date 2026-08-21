import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export interface ProviderConfig {
  geminiApiKey?: string;
  telegramBotToken?: string;
  geminiTextModel?: string;
  geminiVisionModel?: string;
  geminiFastModel?: string;
}

function key() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error('ADMIN_SECRET is required');
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string) {
  const [ivRaw, tagRaw, dataRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error('Invalid encrypted secret');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

let config: ProviderConfig = {};
let encryptedSecrets: { geminiApiKey?: string; telegramBotToken?: string } = {};

export function getProviderConfig() {
  return { ...config, geminiApiKey: encryptedSecrets.geminiApiKey ? '••••••••' : undefined, telegramBotToken: encryptedSecrets.telegramBotToken ? '••••••••' : undefined };
}

export function setProviderConfig(input: ProviderConfig) {
  config = { geminiTextModel: input.geminiTextModel, geminiVisionModel: input.geminiVisionModel, geminiFastModel: input.geminiFastModel };
  if (input.geminiApiKey) encryptedSecrets.geminiApiKey = encryptSecret(input.geminiApiKey);
  if (input.telegramBotToken) encryptedSecrets.telegramBotToken = encryptSecret(input.telegramBotToken);
}

export function getRuntimeSecrets() {
  return { geminiApiKey: encryptedSecrets.geminiApiKey ? decryptSecret(encryptedSecrets.geminiApiKey) : undefined, telegramBotToken: encryptedSecrets.telegramBotToken ? decryptSecret(encryptedSecrets.telegramBotToken) : undefined };
}
