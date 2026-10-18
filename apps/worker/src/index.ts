// index.ts — entrypoint do Worker (Hono)
// Rotas: /webhook/* (entrada da Evolution API), /api/auth/* (login/logout), /api/* (painel)
// Injeção de dependências: adaptadores construídos a partir do Env e passados às rotas.

import { Hono } from 'hono';
import type { Env } from './env';
import { webhookRoutes } from './routes/webhook';
import { authRoutes } from './routes/auth';
import { painelRoutes } from './routes/painel';
import { D1AgendaAdapter } from './adapters/d1-agenda';
import { D1AutenticacaoAdapter } from './adapters/d1-autenticacao';

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/webhook', webhookRoutes);

// Rotas com dependências — construídas a partir do Env (bindings do wrangler.jsonc)
app.use('*', async (c, next) => {
  const env = c.env as Env;
  const agenda = new D1AgendaAdapter(env.AGENDADOR_DB);
  const autenticacao = new D1AutenticacaoAdapter(env.AGENDADOR_DB);

  app.route('/api/auth', authRoutes(autenticacao, env));
  app.route('/api', painelRoutes(agenda, env));

  await next();
});

export default app;