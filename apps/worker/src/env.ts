// env.ts — tipos das bindings do Worker (Cloudflare). Só usado nos adaptadores e rotas, nunca no domínio.

export interface Env {
  AGENDADOR_DB: D1Database;
  CONVERSA_KV: KVNamespace;
  LEMBRETE_KV: KVNamespace;
  FILA_MENSAGENS: Queue;
  AI: Ai;
  FUSO: string;
  TIMEOUT_MINUTOS: string;
  ANTECEDENCIA_MINUTOS: string;
  EVOLUTION_API_URL: string;
  SEGREDO_SESSAO: string;
}