// index.ts — entrypoint do Worker (Hono)
// Rotas: /webhook/* (entrada da Evolution API), /api/auth/* (login/logout), /api/* (painel)
// Queue consumer e Cron trigger entram nas próximas etapas.

import { Hono } from 'hono';
import { webhookRoutes } from './routes/webhook';
import { authRoutes } from './routes/auth';
import { painelRoutes } from './routes/painel';

const app = new Hono();

app.route('/webhook', webhookRoutes);
app.route('/api/auth', authRoutes);
app.route('/api', painelRoutes);

// Health check para validar o deploy
app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;