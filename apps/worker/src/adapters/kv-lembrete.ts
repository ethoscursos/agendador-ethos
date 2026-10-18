// adapters/kv-lembrete.ts
// Dedup do lembrete 24h — chave lembrete:{agendamento_id} no LEMBRETE_KV (decisão D-ET1-2).
// Não altera o DDL (a tabela agendamento não tem campo de lembrete enviado).

import type { LembretePort } from '../ports/lembrete';

const TTL_LEMBRETE = 48 * 60 * 60; // 48h — cobre o lembrete 24h antes + margem

export class KvLembreteAdapter implements LembretePort {
  constructor(private kv: KVNamespace) {}

  private chave(agendamentoId: number): string {
    return `lembrete:${agendamentoId}`;
  }

  async agendar(agendamentoId: number, dataHoraInicio: string): Promise<void> {
    await this.kv.put(this.chave(agendamentoId), dataHoraInicio, { expirationTtl: TTL_LEMBRETE });
  }

  async jaEnviado(agendamentoId: number): Promise<boolean> {
    return (await this.kv.get(this.chave(agendamentoId))) !== null;
  }

  async marcarEnviado(agendamentoId: number): Promise<void> {
    await this.kv.put(this.chave(agendamentoId), 'enviado', { expirationTtl: TTL_LEMBRETE });
  }
}