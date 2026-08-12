import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { companiesRouter } from './routes/companies';
import { metricsRouter } from './routes/metrics';
import { anomaliesRouter } from './routes/anomalies';
import { alertsRouter } from './routes/alerts';
import { insightsRouter } from './routes/insights';
import { ingestRouter } from './routes/ingest';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import './db'; // initializes schema on import

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors()); // in production, restrict to the deployed dashboard's origin
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/companies', companiesRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/anomalies', anomaliesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/ingest', ingestRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`BI Dashboard API listening on http://localhost:${PORT}`);
});
