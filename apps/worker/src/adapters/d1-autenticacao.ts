// adapters/d1-autenticacao.ts
// Implementação do port de autenticação sobre o D1 (AGENDADOR_DB).
// Consulta o profissional por e-mail — SQL portável, sem alteração do schema.

import type { AutenticacaoPort, ProfissionalAuth } from '../ports/autenticacao';

export class D1AutenticacaoAdapter implements AutenticacaoPort {
  constructor(private db: D1Database) {}

  async buscarPorEmail(email: string): Promise<ProfissionalAuth | null> {
    const r = await this.db
      .prepare('SELECT id, email, senha_hash FROM profissional WHERE email = ?')
      .bind(email)
      .first<{ id: number; email: string; senha_hash: string }>();
    if (!r) return null;
    return { id: r.id, email: r.email, senhaHash: r.senha_hash };
  }
}