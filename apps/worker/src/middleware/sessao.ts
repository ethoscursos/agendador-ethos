// middleware/sessao.ts
// Middleware Hono que valida o cookie de sessão assinado e injeta o profissionalId no contexto.

import type { MiddlewareHandler } from 'hono';
import { validarSessao } from '../domain/sessao';
import type { Env } from '../env';
import type { Variaveis } from '../tipos-hono';

export const NOME_COOKIE = 'sessao';

export function exigirSessao(
  env: Env
): MiddlewareHandler<{ Bindings: Env; Variables: Variaveis }> {
  return async (c, next) => {
    const token = c.req
      .header('cookie')
      ?.split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${NOME_COOKIE}=`))
      ?.split('=')[1];

    if (!token) return c.json({ erro: 'não autenticado' }, 401);

    const sessao = await validarSessao(token, env.SEGREDO_SESSAO);
    if (!sessao) return c.json({ erro: 'sessão inválida ou expirada' }, 401);

    c.set('profissionalId', sessao.profissionalId);
    await next();
  };
}