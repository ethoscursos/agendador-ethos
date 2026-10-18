// routes/auth.ts — POST /api/auth/login e POST /api/auth/logout
// Login valida email + senha_hash (PBKDF2 via Web Crypto) e emite cookie HttpOnly assinado.

import { Hono } from 'hono';
import type { Env } from '../env';
import { criarSessao } from '../domain/sessao';
import { verificarSenha } from '../domain/senha';
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

    const senhaValida = await verificarSenha(body.senha, profissional.senhaHash);
    if (!senhaValida) return c.json({ erro: 'credenciais inválidas' }, 401);

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