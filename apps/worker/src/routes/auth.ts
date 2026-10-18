// routes/auth.ts — POST /api/auth/login e POST /api/auth/logout
// Stub da Etapa 2: implementação completa na Etapa 5 (cookie HttpOnly assinado — D-ET1-5).

import { Hono } from 'hono';

export const authRoutes = new Hono();

authRoutes.post('/login', (c) => {
  // TODO (Etapa 5): validar email/senha_hash (Q7 do schema), emitir cookie assinado.
  return c.json({ erro: 'não implementado' }, 501);
});

authRoutes.post('/logout', (c) => {
  // TODO (Etapa 5): invalidar sessão e limpar cookie.
  return c.json({ erro: 'não implementado' }, 501);
});