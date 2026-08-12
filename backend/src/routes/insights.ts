import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/errorHandler';
import { generateExecutiveSummary } from '../services/claudeAnalysis';

export const insightsRouter = Router();

insightsRouter.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const { company_id, force } = req.body as { company_id: string; force?: boolean };
    if (!company_id) return res.status(400).json({ error: 'company_id is required' });
    const insight = await generateExecutiveSummary(company_id, !!force);
    res.json({ insight });
  })
);

insightsRouter.get(
  '/:companyId/latest',
  asyncHandler(async (req, res) => {
    const insight = db
      .prepare(`SELECT * FROM ai_insights WHERE company_id = ? ORDER BY generated_at DESC LIMIT 1`)
      .get(req.params.companyId);
    if (!insight) return res.status(404).json({ error: 'not_found', message: 'No insight generated yet' });
    res.json({ insight });
  })
);

insightsRouter.get(
  '/:companyId/history',
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(`SELECT * FROM ai_insights WHERE company_id = ? ORDER BY generated_at DESC LIMIT 20`)
      .all(req.params.companyId);
    res.json({ insights: rows });
  })
);
