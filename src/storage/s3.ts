import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../config.js';

export class S3MediaStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    if (!config.STORAGE_BUCKET || !config.STORAGE_ACCESS_KEY || !config.STORAGE_SECRET_KEY) {
      throw new Error('S3 storage is not configured');
    }
    this.bucket = config.STORAGE_BUCKET;
    this.client = new S3Client({
      region: process.env.STORAGE_REGION ?? 'auto',
      endpoint: config.STORAGE_ENDPOINT,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
      credentials: { accessKeyId: config.STORAGE_ACCESS_KEY, secretAccessKey: config.STORAGE_SECRET_KEY }
    });
  }

  async put(input: { key: string; body: Uint8Array; contentType: string }): Promise<{ key: string }> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: input.key, Body: input.body, ContentType: input.contentType }));
    return { key: input.key };
  }
}
