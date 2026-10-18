// routes/painel.ts — /api/agendamentos (listar e cancelar)
// Stub da Etapa 2: implementação completa na Etapa 5 (Q5 listar dia, Q6 cancelar).

import { Hono } from 'hono';

export const painelRoutes = new Hono();

painelRoutes.get('/agendamentos', (c) => {
  // TODO (Etapa 5): listar agendamentos do dia (Q5) — protegido por sessão.
  return c.json({ erro: 'não implementado' }, 501);
});

painelRoutes.post('/agendamentos/:id/cancelar', (c) => {
  // TODO (Etapa 5): cancelar agendamento (Q6) — notifica cliente via mensageiro.
  return c.json({ erro: 'não implementado' }, 501);
});