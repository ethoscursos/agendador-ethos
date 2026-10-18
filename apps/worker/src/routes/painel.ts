// routes/painel.ts — /api/agendamentos (listar e cancelar)
// Consome Q5 (listar dia) e Q6 (cancelar) — protegido por sessão.

import { Hono } from 'hono';
import type { Env } from '../env';
import type { Variaveis } from '../tipos-hono';
import { exigirSessao } from '../middleware/sessao';
import type { AgendaPort } from '../ports/agenda';
import { inicioDoDiaUtc, inicioProximoDiaUtc } from '../domain/fuso';

export function painelRoutes(
  agenda: AgendaPort,
  env: Env
): Hono<{ Bindings: Env; Variables: Variaveis }> {
  const app = new Hono<{ Bindings: Env; Variables: Variaveis }>();
  app.use('*', exigirSessao(env));

  // GET /api/agendamentos?dia=YYYY-MM-DD (default: hoje no fuso)
  app.get('/agendamentos', async (c) => {
    const profissionalId = c.get('profissionalId');
    const dia = c.req.query('dia') ?? new Date().toISOString().slice(0, 10);
    const inicio = inicioDoDiaUtc(dia, env.FUSO);
    const fim = inicioProximoDiaUtc(dia, env.FUSO);
    const agendamentos = await agenda.listarAgendamentosDoDia(profissionalId, inicio, fim);
    return c.json({ dia, agendamentos });
  });

  // POST /api/agendamentos/:id/cancelar
  app.post('/agendamentos/:id/cancelar', async (c) => {
    const profissionalId = c.get('profissionalId');
    const id = Number(c.req.param('id'));
    const body = await c.req.json<{ motivo?: string }>().catch(() => ({ motivo: undefined }));
    const cancelado = await agenda.cancelarAgendamento(
      id,
      profissionalId,
      new Date().toISOString(),
      body.motivo ?? 'cancelado pelo profissional'
    );
    if (!cancelado) return c.json({ erro: 'agendamento não encontrado ou já cancelado' }, 404);
    // TODO (Etapa 6): notificar o cliente via mensageiro (fila envio-mensagens).
    return c.json({ ok: true });
  });

  return app;
}