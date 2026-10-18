// ports/conversa.ts
// Contrato do port de estado da conversa — implementado pelo adaptador KV (adapters/kv-conversa.ts).
// Chave composta: profissional_id:telefone_cliente (nunca chave simples por telefone — Seção 12 do RDA).

import type { Conversa } from '../domain/tipos';

export interface ConversaPort {
  obter(profissionalId: number, telefoneCliente: string): Promise<Conversa | null>;
  salvar(profissionalId: number, telefoneCliente: string, estado: Conversa): Promise<void>;
  limpar(profissionalId: number, telefoneCliente: string): Promise<void>;
}