// adapters/kv-conversa.ts
// Estado da conversa no KV — chave composta profissional_id:telefone_cliente (Seção 12 do RDA).
// TTL = timeout da conversa (10 min — Seção 10).

import type { ConversaPort } from '../ports/conversa';
import type { Conversa } from '../domain/tipos';

export class KvConversaAdapter implements ConversaPort {
  constructor(private kv: KVNamespace, private ttlSegundos: number) {}

  private chave(profissionalId: number, telefoneCliente: string): string {
    return `${profissionalId}:${telefoneCliente}`;
  }

  async obter(profissionalId: number, telefoneCliente: string): Promise<Conversa | null> {
    const valor = await this.kv.get(this.chave(profissionalId, telefoneCliente));
    return valor ? (JSON.parse(valor) as Conversa) : null;
  }

  async salvar(profissionalId: number, telefoneCliente: string, estado: Conversa): Promise<void> {
    await this.kv.put(this.chave(profissionalId, telefoneCliente), JSON.stringify(estado), {
      expirationTtl: this.ttlSegundos,
    });
  }

  async limpar(profissionalId: number, telefoneCliente: string): Promise<void> {
    await this.kv.delete(this.chave(profissionalId, telefoneCliente));
  }
}