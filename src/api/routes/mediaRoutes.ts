import { Router } from 'express';
import multer from 'multer';
import Logger from '@/utils/logger';
import { Client as MinioClient } from 'minio';

const router = Router();

// Multer in-memory storage
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function buildMinio(): MinioClient | null {
  const endPoint = process.env.MINIO_ENDPOINT;
  const port = process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : 443;
  const useSSL = (process.env.MINIO_USE_SSL || 'true') === 'true';
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  if (!endPoint || !accessKey || !secretKey) {
    Logger.warn('MinIO not configured. Skipping media routes.');
    return null;
  }
  return new MinioClient({ endPoint, port, useSSL, accessKey, secretKey });
}

function buildPublicUrl(bucket: string, objectName: string): string {
  const base = process.env.MINIO_PUBLIC_BASE_URL;
  if (base) {
    return `${base.replace(/\/$/, '')}/${encodeURIComponent(bucket)}/${encodeURIComponent(objectName)}`;
  }
  const proto = ((process.env.MINIO_USE_SSL || 'true') === 'true') ? 'https' : 'http';
  const host = process.env.MINIO_ENDPOINT;
  const port = process.env.MINIO_PORT ? `:${process.env.MINIO_PORT}` : '';
  return `${proto}://${host}${port}/${encodeURIComponent(bucket)}/${encodeURIComponent(objectName)}`;
}

// GET /api/media/test - connectivity check
router.get('/test', async (req, res) => {
  try {
    const minio = buildMinio();
    if (!minio) return res.status(501).json({ success: false, error: 'MinIO not configured' });
    const bucket = process.env.MINIO_BUCKET as string;
    const exists = bucket ? await minio.bucketExists(bucket).catch(() => false) : false;
    return res.json({ success: true, bucket, bucketExists: !!exists });
  } catch (error) {
    Logger.error('MinIO test error', { error });
    return res.status(500).json({ success: false, error: 'MinIO test failed' });
  }
});

// POST /api/media/upload (multipart/form-data, field: file)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const minio = buildMinio();
    if (!minio) return res.status(501).json({ success: false, error: 'MinIO not configured' });
    const bucket = process.env.MINIO_BUCKET as string;
    if (!bucket) return res.status(400).json({ success: false, error: 'MINIO_BUCKET not set' });

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'File is required (field name: file)' });
    }
    const originalName = req.file.originalname || 'upload';
    const uniqueName = `${Date.now()}-${originalName}`;
    const meta = { 'Content-Type': req.file.mimetype || 'application/octet-stream' } as any;

    // Ensure bucket exists, or try to create it
    try {
      const exists = await minio.bucketExists(bucket);
      if (!exists) {
        try {
          await minio.makeBucket(bucket, 'us-east-1');
        } catch (mkErr) {
          Logger.warn('MinIO bucket does not exist and cannot be created automatically', { error: (mkErr as Error)?.message, bucket });
          return res.status(500).json({ success: false, error: `MinIO bucket '${bucket}' does not exist and cannot be created automatically. Please create it or adjust permissions.` });
        }
      }
    } catch (existsErr) {
      Logger.warn('MinIO bucket existence check failed', { error: (existsErr as Error)?.message });
    }

    try {
      await minio.putObject(bucket, uniqueName, req.file.buffer, meta);
    } catch (err: any) {
      const msg = (err?.message || '').toString();
      if (msg.includes('S3 API Requests must be made to API port')) {
        try {
          const altPort = parseInt(process.env.MINIO_FALLBACK_PORT || '9000', 10);
          const altSSL = (process.env.MINIO_FALLBACK_SSL || 'false') === 'true';
          const alt = new MinioClient({
            endPoint: process.env.MINIO_ENDPOINT as string,
            port: altPort,
            useSSL: altSSL,
            accessKey: process.env.MINIO_ACCESS_KEY as string,
            secretKey: process.env.MINIO_SECRET_KEY as string,
          });
          await alt.putObject(bucket, uniqueName, req.file.buffer, meta);
        } catch (e2) {
          Logger.error('MinIO upload fallback error', { error: e2 });
          return res.status(500).json({ success: false, error: 'Failed to upload to MinIO (S3 API not exposed on 443). Try configuring MINIO_PORT=9000 and MINIO_USE_SSL=false.' });
        }
      } else {
        Logger.error('MinIO upload error', { error: err });
        return res.status(500).json({ success: false, error: 'Failed to upload file to MinIO' });
      }
    }

    const imageUrl = buildPublicUrl(bucket, uniqueName);
    return res.json({ success: true, bucket, object: uniqueName, imageUrl });
  } catch (error) {
    Logger.error('MinIO upload error', { error });
    return res.status(500).json({ success: false, error: 'Failed to upload file to MinIO' });
  }
});

export default router;


