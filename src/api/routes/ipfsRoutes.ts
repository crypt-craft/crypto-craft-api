import express from 'express';
import Logger from '@/utils/logger';
import { authenticateJWT } from '@/middleware/auth';

const router = express.Router();

// Helper to ensure env credentials exist
function getPinataAuthHeader() {
  const jwt = process.env.PINATA_JWT;
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;

  if (jwt && jwt.trim() !== '') {
    const token = jwt.replace(/^Bearer\s+/i, '').trim();
    return { type: 'jwt' as const, header: { Authorization: `Bearer ${token}` } };
  }

  if (apiKey && apiSecret) {
    return {
      type: 'keys' as const,
      header: {
        pinata_api_key: apiKey,
        pinata_secret_api_key: apiSecret
      } as Record<string, string>
    };
  }

  return null;
}

function redact(value?: string | null, start: number = 6, end: number = 4): string | undefined {
  if (!value) return undefined;
  const v = value.toString();
  if (v.length <= start + end) return '***';
  return `${v.slice(0, start)}***${v.slice(-end)}`;
}

function authDiagnostics() {
  const rawJwt = process.env.PINATA_JWT || '';
  const apiKey = process.env.PINATA_API_KEY || '';
  const apiSecret = process.env.PINATA_API_SECRET || '';
  const jwt = rawJwt.replace(/^Bearer\s+/i, '').trim();
  const type = jwt ? 'jwt' : (apiKey && apiSecret ? 'keys' : 'none');
  return {
    type,
    jwtPresent: Boolean(jwt),
    apiKeyPresent: Boolean(apiKey),
    apiSecretPresent: Boolean(apiSecret),
    jwtLength: jwt ? jwt.length : 0,
    apiKeyPreview: redact(apiKey),
    apiSecretPreview: apiSecret ? `${apiSecret.length} chars` : undefined,
  };
}

// POST /api/ipfs/pin-file
// Accepts JSON: { fileName: string, dataUrl: string }
router.post('/pin-file', authenticateJWT(true), async (req, res) => {
  try {
    const { fileName, dataUrl } = req.body || {};
    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ error: 'fileName is required' });
    }
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'dataUrl (data URI) is required' });
    }

    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) {
      return res.status(400).json({ error: 'Invalid dataUrl format' });
    }

    const meta = dataUrl.substring(5, commaIdx); // skip 'data:'
    const base64Part = dataUrl.substring(commaIdx + 1);
    const isBase64 = /;base64$/i.test(meta) || /;base64;/.test(meta);
    const mime = meta.replace(/;base64/i, '');
    if (!isBase64) {
      return res.status(400).json({ error: 'dataUrl must be base64 encoded' });
    }

    // Decode base64; basic size guard (<= 2MB as per UI guidance)
    const buffer = Buffer.from(base64Part, 'base64');
    if (buffer.byteLength > 2 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (max 2MB)' });
    }

    const auth = getPinataAuthHeader();
    const diag = authDiagnostics();
    if (!auth) {
      return res.status(401).json({
        error: 'Pinata credentials not configured. Set PINATA_JWT or PINATA_API_KEY/PINATA_API_SECRET',
        code: 'PINATA_AUTH_MISSING',
        diagnostics: diag
      });
    }

    // Ensure FormData/Blob are available in the runtime
    if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
      Logger.error('FormData/Blob not available in Node runtime');
      return res.status(500).json({ error: 'Server runtime missing FormData/Blob. Use Node >= 18 or enable undici globals.' });
    }

    // Build multipart form
    let form: any;
    if (typeof FormData !== 'undefined' && typeof Blob !== 'undefined') {
      form = new FormData();
      const blob = new Blob([buffer], { type: mime || 'application/octet-stream' });
      form.append('file', blob, fileName);
    } else {
      // Fallback for Node runtimes without web FormData/Blob
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const FormDataNode = require('form-data');
      form = new FormDataNode();
      form.append('file', buffer, { filename: fileName, contentType: mime || 'application/octet-stream' });
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: auth.header as any,
      // If using form-data (node), fetch will pick headers from form.getHeaders()
      body: form as any
    });

    const text = await response.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* leave as text */ }

    if (!response.ok) {
      const status = response.status;
      Logger.warn('Pinata pinFileToIPFS failed', { status, body: text, diagnostics: diag });
      if (status === 401 || status === 403) {
        return res.status(status).json({ error: 'Unauthorized to Pinata. Check PINATA credentials.', details: json || text, diagnostics: diag });
      }
      return res.status(status).json({ error: 'Failed to pin file to IPFS', details: json || text, diagnostics: diag });
    }

    // Expected shape: { IpfsHash, PinSize, Timestamp, ... }
    return res.json(json || { ok: true });
  } catch (error: any) {
    Logger.error('IPFS pin-file error', { error: error?.message });
    return res.status(500).json({ error: 'Internal error pinning file', details: error?.message });
  }
});

// POST /api/ipfs/pin-json
// Accepts JSON body and proxies to Pinata pinJSONToIPFS
router.post('/pin-json', authenticateJWT(true), async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'JSON body required' });
    }

    const auth = getPinataAuthHeader();
    const diag = authDiagnostics();
    if (!auth) {
      return res.status(401).json({ error: 'Pinata credentials not configured. Set PINATA_JWT or PINATA_API_KEY/PINATA_API_SECRET', code: 'PINATA_AUTH_MISSING', diagnostics: diag });
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth.header as any)
      } as any,
      body: JSON.stringify({ pinataContent: body })
    });

    const text = await response.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}

    if (!response.ok) {
      const status = response.status;
      Logger.warn('Pinata pinJSONToIPFS failed', { status, body: text, diagnostics: diag });
      if (status === 401 || status === 403) {
        return res.status(status).json({ error: 'Unauthorized to Pinata. Check PINATA credentials.', details: json || text, diagnostics: diag });
      }
      return res.status(status).json({ error: 'Failed to pin JSON to IPFS', details: json || text, diagnostics: diag });
    }

    return res.json(json || { ok: true });
  } catch (error: any) {
    Logger.error('IPFS pin-json error', { error: error?.message });
    return res.status(500).json({ error: 'Internal error pinning JSON', details: error?.message });
  }
});

// GET /api/ipfs/test-auth - validate Pinata credentials via test endpoint
router.get('/test-auth', async (_req, res) => {
  const auth = getPinataAuthHeader();
  const diag = authDiagnostics();
  if (!auth) {
    return res.status(401).json({
      ok: false,
      error: 'Pinata credentials not configured',
      code: 'PINATA_AUTH_MISSING',
      diagnostics: diag
    });
  }
  try {
    const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: auth.header as any
    });
    const text = await response.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    return res.status(response.status).json({
      ok: response.ok,
      status: response.status,
      body: json || text,
      diagnostics: diag
    });
  } catch (error: any) {
    Logger.error('Pinata test-auth error', { error: error?.message });
    return res.status(500).json({ ok: false, error: error?.message, diagnostics: diag });
  }
});

// DELETE /api/ipfs/unpin/:cid
// Unpins a CID from Pinata
router.delete('/unpin/:cid', authenticateJWT(true), async (req, res) => {
  try {
    const { cid } = req.params as { cid: string };
    if (!cid || typeof cid !== 'string') {
      return res.status(400).json({ error: 'cid is required' });
    }
    // Basic CID validation: allow multibase/base58/base32 chars and dashes
    if (!/^[a-zA-Z0-9]+(?:[-a-zA-Z0-9]+)*$/.test(cid)) {
      return res.status(400).json({ error: 'Invalid CID format' });
    }

    const auth = getPinataAuthHeader();
    const diag = authDiagnostics();
    if (!auth) {
      return res.status(401).json({ error: 'Pinata credentials not configured. Set PINATA_JWT or PINATA_API_KEY/PINATA_API_SECRET', code: 'PINATA_AUTH_MISSING', diagnostics: diag });
    }

    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${encodeURIComponent(cid)}` , {
      method: 'DELETE',
      headers: auth.header as any
    });

    const text = await response.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}

    if (!response.ok) {
      const status = response.status;
      Logger.warn('Pinata unpin failed', { status, body: text, diagnostics: diag });
      if (status === 401 || status === 403) {
        return res.status(status).json({ error: 'Unauthorized to Pinata. Check PINATA credentials.', details: json || text, diagnostics: diag });
      }
      return res.status(status).json({ error: 'Failed to unpin CID', details: json || text, diagnostics: diag });
    }

    return res.json(json || { ok: true });
  } catch (error: any) {
    Logger.error('IPFS unpin error', { error: error?.message });
    return res.status(500).json({ error: 'Internal error unpinning CID', details: error?.message });
  }
});

export default router;


