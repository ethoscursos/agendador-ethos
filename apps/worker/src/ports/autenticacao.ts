// ports/autenticacao.ts
// Contrato do port de autenticação — implementado pelo adaptador D1 (adapters/d1-autenticacao.ts).
// Consulta o profissional por e-mail para validar o login (tabela profissional do schema).

export interface ProfissionalAuth {
  id: number;
  email: string;
  senhaHash: string;
}

export interface AutenticacaoPort {
  buscarPorEmail(email: string): Promise<ProfissionalAuth | null>;
}