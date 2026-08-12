import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/errorHandler';
import { generateAlertsFromOpenAnomalies } from '../services/alertEngine';

export const alertsRouter = Router();

alertsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { company, severity, status } = req.query as Record<string, string | undefined>;
    const clauses: string[] = [];
    const params: any[] = [];
    if (company) {
      clauses.push('a.company_id = ?');
      params.push(company);
    }
    if (severity) {
      clauses.push('a.severity = ?');
      params.push(severity);
    }
    if (status) {
      clauses.push('a.status = ?');
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT a.*, c.name as company_name FROM alerts a
         JOIN companies c ON c.id = a.company_id
         ${where} ORDER BY a.created_at DESC LIMIT 200`
      )
      .all(...params);
    res.json({ alerts: rows });
  })
);

alertsRouter.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const result = await generateAlertsFromOpenAnomalies();
    res.json(result);
  })
);

alertsRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status: 'open' | 'acknowledged' | 'resolved' };
    if (!['open', 'acknowledged', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }
    db.prepare(`UPDATE alerts SET status = ? WHERE id = ?`).run(status, req.params.id);
    res.json({ ok: true });
  })
);
