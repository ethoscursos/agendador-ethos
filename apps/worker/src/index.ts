// index.ts — entrypoint do Worker (Hono)
// Rotas: /webhook/* (entrada da Evolution API), /api/auth/* (login/logout), /api/* (painel)
// Handlers: queue() (consumer da fila) e scheduled() (cron de lembretes).

import { Hono } from 'hono';
import type { Env } from './env';
import { webhookRoutes } from './routes/webhook';
import { authRoutes } from './routes/auth';
import { painelRoutes } from './routes/painel';
import { D1AgendaAdapter } from './adapters/d1-agenda';
import { D1AutenticacaoAdapter } from './adapters/d1-autenticacao';
import { processarFila } from './handlers/queue';
import { processarCron } from './handlers/cron';

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

app.use('*', async (c, next) => {
  const env = c.env as Env;
  const agenda = new D1AgendaAdapter(env.AGENDADOR_DB);
  const autenticacao = new D1AutenticacaoAdapter(env.AGENDADOR_DB);

  app.route('/webhook', webhookRoutes(env));
  app.route('/api/auth', authRoutes(autenticacao, env));
  app.route('/api', painelRoutes(agenda, env));

  await next();
});

export default {
  fetch: app.fetch,
  queue: processarFila,
  scheduled: processarCron,
};