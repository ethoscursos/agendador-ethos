// index.ts — entrypoint do Worker (Hono)
import { Hono } from 'hono';
import type { ExecutionContext } from '@cloudflare/workers-types';
import type { Env } from './env';
import { webhookRoutes } from './routes/webhook';
import { authRoutes } from './routes/auth';
import { painelRoutes } from './routes/painel';
import { D1AgendaAdapter } from './adapters/d1-agenda';
import { D1AutenticacaoAdapter } from './adapters/d1-autenticacao';
import { processarFila } from './handlers/queue';
import { processarCron } from './handlers/cron';

// Monta o app com TODAS as rotas registradas no top-level.
// Os adapters são criados aqui porque o env só existe dentro do handler fetch.
function criarApp(env: Env) {
  const agenda = new D1AgendaAdapter(env.AGENDADOR_DB);
  const autenticacao = new D1AutenticacaoAdapter(env.AGENDADOR_DB);

  const app = new Hono<{ Bindings: Env }>();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Rotas registradas ANTES de qualquer request — matcher construído uma única vez
  app.route('/webhook', webhookRoutes(env));
  app.route('/api/auth', authRoutes(autenticacao, env));
  app.route('/api', painelRoutes(agenda, env));

  return app;
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => criarApp(env).fetch(req, env, ctx),
  queue: processarFila,
  scheduled: processarCron,
};