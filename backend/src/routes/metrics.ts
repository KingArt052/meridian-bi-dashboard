import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/errorHandler';

export const metricsRouter = Router();

/**
 * GET /api/metrics?company=<id>&type=<metric_type>&from=YYYY-MM-DD&to=YYYY-MM-DD&category=<cat>
 * All filters optional except at least one of company/type recommended for
 * sane payload sizes; unfiltered queries are capped.
 */
metricsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { company, type, from, to, category } = req.query as Record<string, string | undefined>;

    const clauses: string[] = [];
    const params: any[] = [];

    if (company) {
      clauses.push('company_id = ?');
      params.push(company);
    }
    if (type) {
      clauses.push('metric_type = ?');
      params.push(type);
    }
    if (from) {
      clauses.push('period >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('period <= ?');
      params.push(to);
    }
    if (category) {
      clauses.push('category = ?');
      params.push(category);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT * FROM metrics ${where} ORDER BY period ASC LIMIT 5000`;
    const rows = db.prepare(sql).all(...params);
    res.json({ metrics: rows, count: rows.length });
  })
);

