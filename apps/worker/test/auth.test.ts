import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gerarHashSenha, verificarSenha } from '../src/domain/senha';
import { criarSessao, validarSessao } from '../src/domain/sessao';

describe('senha', () => {
  it('gera um hash verificável e rejeita senha incorreta', async () => {
    const hash = await gerarHashSenha('senha-segura');

    expect(hash).toMatch(/^pbkdf2\$100000\$[^$]+\$[^$]+$/);
    await expect(verificarSenha('senha-segura', hash)).resolves.toBe(true);
    await expect(verificarSenha('senha-incorreta', hash)).resolves.toBe(false);
  });

  it('rejeita hash em formato inválido', async () => {
    await expect(verificarSenha('senha', 'hash-invalido')).resolves.toBe(false);
  });
});

describe('sessao', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T12:00:00.000Z'));
  });

  it('cria e valida uma sessão', async () => {
    const token = await criarSessao(7, 'segredo-teste', 60);
    await expect(validarSessao(token, 'segredo-teste')).resolves.toEqual({
      profissionalId: 7,
      exp: Date.now() + 60 * 60_000,
    });
    vi.useRealTimers();
  });

  it('rejeita sessão adulterada ou expirada', async () => {
    const token = await criarSessao(7, 'segredo-teste', 1);
    const [payload, assinatura] = token.split('.');

    await expect(validarSessao(`${payload}.${assinatura.slice(1)}x`, 'segredo-teste')).resolves.toBeNull();

    vi.advanceTimersByTime(60_001);
    await expect(validarSessao(token, 'segredo-teste')).resolves.toBeNull();
    vi.useRealTimers();
  });
});
