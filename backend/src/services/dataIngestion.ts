import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { IngestBatch } from '../types';

const ROW_SCHEMA = z.object({
  metric_type: z.enum([
    'revenue_cents',
    'expenses_cents',
    'profit_margin_pct',
    'cac_cents',
    'leads',
    'conversion_rate_pct',
    'sales_count',
    'marketing_spend_cents',
    'revenue_growth_pct',
  ]),
  period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'period must be YYYY-MM-DD'),
  value: z.number().finite(),
  category: z.string().optional().default(''),
});

const BATCH_SCHEMA = z.object({
  company_id: z.string().min(1),
  source: z.enum(['google_sheets', 'csv', 'api', 'manual']),
  rows: z.array(ROW_SCHEMA).min(1).max(5000),
});

export interface IngestResult {
  status: 'success' | 'partial' | 'failed';
  importId: string;
  rowsWritten: number;
  errors: string[];
}

/**
 * Ingests a batch of normalized metric rows. This is the ONLY write path
 * into `metrics` — n8n, CSV uploads, and any future API integrations all
 * funnel through here so validation and idempotency are enforced in one
 * place, not duplicated per-source.
 *
 * Idempotency: a batch is keyed by company_id + source + a hash of its
 * row contents. Re-submitting the identical batch (e.g. an n8n retry) is a
 * no-op rather than a duplicate write.
 */
export function ingestBatch(rawBatch: unknown): IngestResult {
  const parseResult = BATCH_SCHEMA.safeParse(rawBatch);
  if (!parseResult.success) {
    return {
      status: 'failed',
      importId: '',
      rowsWritten: 0,
      errors: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }

  const batch: IngestBatch = parseResult.data as IngestBatch;

  const company = db.prepare(`SELECT id FROM companies WHERE id = ?`).get(batch.company_id);
  if (!company) {
    return { status: 'failed', importId: '', rowsWritten: 0, errors: [`Unknown company_id: ${batch.company_id}`] };
  }

  const contentHash = createHash('sha256').update(JSON.stringify(batch.rows)).digest('hex');
  const idempotencyKey = `${batch.company_id}:${batch.source}:${contentHash}`;

  const existing = db.prepare(`SELECT id FROM raw_metric_imports WHERE idempotency_key = ?`).get(idempotencyKey) as
    | { id: string }
    | undefined;
  if (existing) {
    return { status: 'success', importId: existing.id, rowsWritten: 0, errors: ['Duplicate batch — already ingested, skipped'] };
  }

  const importId = randomUUID();
  const errors: string[] = [];
  let written = 0;

  const insertImport = db.prepare(
    `INSERT INTO raw_metric_imports (id, company_id, source, idempotency_key, row_count, status) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const upsertMetric = db.prepare(
    `INSERT INTO metrics (id, company_id, import_id, metric_type, period, value, category, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_id, metric_type, period, category)
     DO UPDATE SET value = excluded.value, import_id = excluded.import_id, source = excluded.source`
  );

  const tx = db.transaction(() => {
    // Insert the import row FIRST — metrics.import_id has a foreign key
    // dependency on raw_metric_imports.id, so the parent row must exist
    // before any child metric rows are written. We update its row_count/
    // status once the actual write count is known.
    insertImport.run(importId, batch.company_id, batch.source, idempotencyKey, 0, 'success');

    for (const row of batch.rows) {
      try {
        upsertMetric.run(randomUUID(), batch.company_id, importId, row.metric_type, row.period, row.value, row.category || '', batch.source);
        written++;
      } catch (e) {
        errors.push(`Failed to write row (${row.metric_type}, ${row.period}): ${(e as Error).message}`);
      }
    }
    const status = errors.length === 0 ? 'success' : written > 0 ? 'partial' : 'failed';
    db.prepare(`UPDATE raw_metric_imports SET row_count = ?, status = ? WHERE id = ?`).run(written, status, importId);
  });

  tx();

  return {
    status: errors.length === 0 ? 'success' : written > 0 ? 'partial' : 'failed',
    importId,
    rowsWritten: written,
    errors,
  };
}
