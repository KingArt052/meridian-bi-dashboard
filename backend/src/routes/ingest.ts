import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireIngestKey } from '../middleware/auth';
import { ingestBatch } from '../services/dataIngestion';
import { detectAnomaliesForCompany } from '../services/anomalyDetection';
import { generateAlertsFromOpenAnomalies } from '../services/alertEngine';

export const ingestRouter = Router();

/**
 * POST /api/ingest
 * Body: { company_id, source, rows: [{ metric_type, period, value, category? }] }
 *
 * Called by: n8n scheduled workflow (Google Sheets sync), CSV upload handler,
 * or any future API integration. On successful ingest, immediately runs
 * anomaly detection for the affected company and generates alerts — so a
 * fresh data sync surfaces issues without waiting for a separate cron tick.
 */
ingestRouter.post(
  '/',
  requireIngestKey,
  asyncHandler(async (req, res) => {
    const result = ingestBatch(req.body);
    if (result.status === 'failed') {
      return res.status(400).json(result);
    }

    const companyId = (req.body as any)?.company_id;
    let anomalies = { anomaliesCreated: 0 };
    let alerts = { created: 0, delivered: 0 };
    if (companyId) {
      anomalies = detectAnomaliesForCompany(companyId);
      alerts = await generateAlertsFromOpenAnomalies();
    }

    res.status(200).json({ ...result, anomalies, alerts });
  })
);
