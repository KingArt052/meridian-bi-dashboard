import { NextFunction, Request, Response } from 'express';

/**
 * The /api/ingest endpoint is write-access and is called by n8n, not the
 * browser. It's protected with a shared-secret header rather than session
 * auth, since it's a server-to-server call. In production this would sit
 * behind the API gateway's network policy too (n8n instance IP allow-list).
 */
export function requireIngestKey(req: Request, res: Response, next: NextFunction) {
  const configuredKey = process.env.INGEST_API_KEY;
  if (!configuredKey) {
    // No key configured (local dev) — allow through but warn.
    console.warn('INGEST_API_KEY not set — ingest endpoint is unauthenticated (dev only).');
    return next();
  }
  const provided = req.header('x-ingest-key');
  if (provided !== configuredKey) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid x-ingest-key header' });
  }
  next();
}
