import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/errorHandler';
import { Company } from '../types';

export const companiesRouter = Router();

companiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const companies = db.prepare(`SELECT * FROM companies WHERE is_active = 1 ORDER BY name ASC`).all() as Company[];

    // Attach a lightweight latest-snapshot so the portfolio overview page
    // doesn't need N+1 requests to render KPI cards per company.
    const latestStmt = db.prepare(
      `SELECT metric_type, value FROM metrics
       WHERE company_id = ? AND period = (SELECT MAX(period) FROM metrics WHERE company_id = ?)`
    );
    const openAlertsStmt = db.prepare(`SELECT COUNT(*) as c FROM alerts WHERE company_id = ? AND status = 'open'`);

    const enriched = companies.map((c) => {
      const latestMetrics = latestStmt.all(c.id, c.id) as { metric_type: string; value: number }[];
      const snapshot: Record<string, number> = {};
      for (const m of latestMetrics) snapshot[m.metric_type] = m.value;
      const openAlerts = (openAlertsStmt.get(c.id) as { c: number }).c;
      return { ...c, latest: snapshot, open_alerts: openAlerts };
    });

    res.json({ companies: enriched });
  })
);

companiesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.params.id);
    if (!company) return res.status(404).json({ error: 'not_found', message: 'Company not found' });
    res.json({ company });
  })
);
