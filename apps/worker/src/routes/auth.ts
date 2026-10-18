// routes/auth.ts — POST /api/auth/login e POST /api/auth/logout
// Login valida email + senha_hash (tabela profissional) e emite cookie HttpOnly assinado (D-ET1-5).

import { Hono } from 'hono';
import type { Env } from '../env';
import { criarSessao } from '../domain/sessao';
import { NOME_COOKIE } from '../middleware/sessao';
import type { AutenticacaoPort } from '../ports/autenticacao';

export function authRoutes(autenticacao: AutenticacaoPort, env: Env): Hono {
  const app = new Hono();

  app.post('/login', async (c) => {
    const body = await c.req.json<{ email?: string; senha?: string }>();
    if (!body.email || !body.senha) {
      return c.json({ erro: 'email e senha são obrigatórios' }, 400);
    }

    const profissional = await autenticacao.buscarPorEmail(body.email);
    if (!profissional) return c.json({ erro: 'credenciais inválidas' }, 401);

    // TODO (validação de hash): comparar body.senha com profissional.senhaHash.
    // O schema armazena senha_hash — a função de hash (bcrypt/argon2) será definida
    // com o Expert Banco de Dados na Etapa 6. Por ora, comparação direta NÃO deve ir a produção.
    if (body.senha !== profissional.senhaHash) {
      return c.json({ erro: 'credenciais inválidas' }, 401);
    }

    const token = await criarSessao(profissional.id, env.SEGREDO_SESSAO, 60 * 12); // 12h
    c.header(
      'Set-Cookie',
      `${NOME_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 12}`
    );
    return c.json({ ok: true, profissionalId: profissional.id });
  });

  app.post('/logout', (c) => {
    c.header('Set-Cookie', `${NOME_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
    return c.json({ ok: true });
  });

  return app;
}