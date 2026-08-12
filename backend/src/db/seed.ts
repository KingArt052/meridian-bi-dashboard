import { randomUUID } from 'crypto';
import { db, initSchema } from './index';
import { MetricType } from '../types';

// Local row shape for direct DB writes — seed.ts bypasses the ingest API
// (and its batch-level company_id convention) since it writes straight to
// the database for speed. Keep company_id here explicitly for that reason.
interface SeedRow {
  company_id: string;
  metric_type: MetricType;
  period: string;
  value: number;
}

/**
 * Realistic 18-month synthetic history for 5 portfolio companies across
 * different industries and lifecycle stages. Growth trends, seasonality,
 * and a handful of DELIBERATE anomalies are baked in so the anomaly
 * detection engine and AI insights have real signal to find — not just
 * noise. This mirrors how you'd want to demo the system to a hiring
 * manager: the numbers should tell a story.
 */

interface CompanySeed {
  name: string;
  industry: string;
  stage: 'seed' | 'growth' | 'mature' | 'turnaround';
  ownership_pct: number;
  baseRevenue: number; // cents, month 0
  monthlyGrowth: number; // e.g. 0.04 = 4%/mo compounding
  expenseRatio: number; // expenses as % of revenue baseline
  baseLeads: number;
  cacBase: number; // cents
  seasonality?: (monthIndex: number) => number; // multiplier
  anomalies?: { monthIndex: number; metric: MetricType; multiplier: number }[];
}

const MONTHS = 18;

const companySeeds: CompanySeed[] = [
  {
    name: 'Northwind Logistics',
    industry: 'Logistics & Freight',
    stage: 'mature',
    ownership_pct: 100,
    baseRevenue: 42_000_00,
    monthlyGrowth: 0.012,
    expenseRatio: 0.78,
    baseLeads: 210,
    cacBase: 18_000,
    anomalies: [
      { monthIndex: 14, metric: 'expenses_cents', multiplier: 1.42 }, // fuel cost spike
      { monthIndex: 15, metric: 'expenses_cents', multiplier: 1.35 },
    ],
  },
  {
    name: 'Verdant Foods Co.',
    industry: 'Consumer Packaged Goods',
    stage: 'growth',
    ownership_pct: 65,
    baseRevenue: 18_500_00,
    monthlyGrowth: 0.038,
    expenseRatio: 0.71,
    baseLeads: 340,
    cacBase: 9_500,
    seasonality: (m) => (m % 12 === 10 || m % 12 === 11 ? 1.35 : 1), // Nov/Dec holiday bump
  },
  {
    name: 'Alto Cloud Systems',
    industry: 'B2B SaaS',
    stage: 'growth',
    ownership_pct: 80,
    baseRevenue: 9_800_00,
    monthlyGrowth: 0.061,
    expenseRatio: 0.66,
    baseLeads: 520,
    cacBase: 14_200,
    anomalies: [
      { monthIndex: 16, metric: 'leads', multiplier: 0.42 }, // lead-gen channel broke
      { monthIndex: 17, metric: 'leads', multiplier: 0.48 },
      { monthIndex: 16, metric: 'conversion_rate_pct', multiplier: 0.7 },
    ],
  },
  {
    name: 'Ferro Manufacturing',
    industry: 'Industrial Manufacturing',
    stage: 'turnaround',
    ownership_pct: 100,
    baseRevenue: 61_000_00,
    monthlyGrowth: -0.006,
    expenseRatio: 0.91,
    baseLeads: 95,
    cacBase: 41_000,
    anomalies: [
      { monthIndex: 12, metric: 'revenue_cents', multiplier: 0.68 }, // lost a major contract
      { monthIndex: 13, metric: 'revenue_cents', multiplier: 0.71 },
    ],
  },
  {
    name: 'Pulse Fitness Studios',
    industry: 'Health & Wellness',
    stage: 'seed',
    ownership_pct: 55,
    baseRevenue: 3_200_00,
    monthlyGrowth: 0.085,
    expenseRatio: 0.82,
    baseLeads: 180,
    cacBase: 6_800,
    seasonality: (m) => (m % 12 === 0 ? 1.5 : 1), // January resolution spike
  },
];

function monthPeriod(monthsAgo: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return d.toISOString().slice(0, 10);
}

function jitter(value: number, pct = 0.06): number {
  const factor = 1 + (Math.random() * 2 - 1) * pct;
  return value * factor;
}

function buildCompanyRows(seed: CompanySeed, companyId: string): SeedRow[] {
  const rows: SeedRow[] = [];

  for (let i = 0; i < MONTHS; i++) {
    const monthIndex = MONTHS - 1 - i; // chronological index used for growth/seasonality
    const period = monthPeriod(i); // i=0 is most recent month

    const growthFactor = Math.pow(1 + seed.monthlyGrowth, monthIndex);
    const seasonMult = seed.seasonality ? seed.seasonality(monthIndex) : 1;

    let revenue = jitter(seed.baseRevenue * growthFactor * seasonMult);
    let expenses = jitter(revenue * seed.expenseRatio);
    let leads = Math.round(jitter(seed.baseLeads * growthFactor * seasonMult, 0.1));
    let conversionRate = jitter(0.14 + Math.min(monthIndex * 0.0015, 0.06), 0.08);
    let cac = jitter(seed.cacBase * (1 - Math.min(monthIndex * 0.004, 0.2)));
    let marketingSpend = jitter(leads * cac * 0.6);
    let salesCount = Math.round(leads * conversionRate);

    // Apply deliberate anomalies for this month
    for (const anomaly of seed.anomalies || []) {
      if (anomaly.monthIndex === monthIndex) {
        if (anomaly.metric === 'revenue_cents') revenue *= anomaly.multiplier;
        if (anomaly.metric === 'expenses_cents') expenses *= anomaly.multiplier;
        if (anomaly.metric === 'leads') leads = Math.round(leads * anomaly.multiplier);
        if (anomaly.metric === 'conversion_rate_pct') conversionRate *= anomaly.multiplier;
      }
    }

    const profitMargin = ((revenue - expenses) / revenue) * 100;

    // previous month revenue for growth % (compute after loop normally, but
    // approximate here using growth factor since rows are chronological desc)
    const prevGrowthFactor = Math.pow(1 + seed.monthlyGrowth, monthIndex - 1);
    const prevRevenueApprox = seed.baseRevenue * prevGrowthFactor * seasonMult;
    const revenueGrowthPct = ((revenue - prevRevenueApprox) / prevRevenueApprox) * 100;

    const push = (metric_type: MetricType, value: number) =>
      rows.push({ company_id: companyId, metric_type, period, value: Math.round(value * 100) / 100 });

    push('revenue_cents', revenue);
    push('expenses_cents', expenses);
    push('profit_margin_pct', profitMargin);
    push('cac_cents', cac);
    push('leads', leads);
    push('conversion_rate_pct', conversionRate * 100);
    push('sales_count', salesCount);
    push('marketing_spend_cents', marketingSpend);
    push('revenue_growth_pct', revenueGrowthPct);
  }

  return rows;
}

function run() {
  initSchema();

  const insertCompany = db.prepare(
    `INSERT INTO companies (id, name, industry, stage, ownership_pct, is_active) VALUES (?, ?, ?, ?, ?, 1)`
  );
  const insertImport = db.prepare(
    `INSERT INTO raw_metric_imports (id, company_id, source, idempotency_key, row_count, status) VALUES (?, ?, ?, ?, ?, 'success')`
  );
  const insertMetric = db.prepare(
    `INSERT OR REPLACE INTO metrics (id, company_id, import_id, metric_type, period, value, category, source)
     VALUES (?, ?, ?, ?, ?, ?, '', 'seed:google_sheets')`
  );

  const clear = db.transaction(() => {
    db.exec('DELETE FROM alerts; DELETE FROM anomalies; DELETE FROM ai_insights; DELETE FROM metrics; DELETE FROM raw_metric_imports; DELETE FROM companies;');
  });
  clear();

  const insertAll = db.transaction(() => {
    for (const seed of companySeeds) {
      const companyId = randomUUID();
      insertCompany.run(companyId, seed.name, seed.industry, seed.stage, seed.ownership_pct);

      const rows = buildCompanyRows(seed, companyId);
      const importId = randomUUID();
      insertImport.run(importId, companyId, 'google_sheets', `seed-${companyId}`, rows.length);

      for (const row of rows) {
        insertMetric.run(randomUUID(), row.company_id, importId, row.metric_type, row.period, row.value);
      }
    }
  });
  insertAll();

  console.log(`Seeded ${companySeeds.length} companies with ${MONTHS} months of metrics each.`);
}

if (require.main === module) {
  run();
}

export { run as seedDatabase };
