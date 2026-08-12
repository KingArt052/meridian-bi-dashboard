import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/errorHandler';
import { detectAnomaliesForAllCompanies, detectAnomaliesForCompany } from '../services/anomalyDetection';

export const anomaliesRouter = Router();

anomaliesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { company, status } = req.query as Record<string, string | undefined>;
    const clauses: string[] = [];
    const params: any[] = [];
    if (company) {
      clauses.push('company_id = ?');
      params.push(company);
    }
    if (status) {
      clauses.push('status = ?');
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM anomalies ${where} ORDER BY detected_at DESC LIMIT 200`).all(...params);
    res.json({ anomalies: rows });
  })
);

// Manual trigger — mirrors what the scheduled n8n job does, useful for the
// dashboard's "Refresh Analysis" button and for demoing the detection logic live.
anomaliesRouter.post(
  '/detect',
  asyncHandler(async (req, res) => {
    const { company } = req.body as { company?: string };
    const result = company ? detectAnomaliesForCompany(company) : detectAnomaliesForAllCompanies();
    res.json(result);
  })
);

anomaliesRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status: 'open' | 'acknowledged' | 'resolved' };
    if (!['open', 'acknowledged', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }
    db.prepare(`UPDATE anomalies SET status = ? WHERE id = ?`).run(status, req.params.id);
    res.json({ ok: true });
  })
);
