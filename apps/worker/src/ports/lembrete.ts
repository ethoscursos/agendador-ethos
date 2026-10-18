// ports/lembrete.ts
// Contrato do port de lembretes — agendamento e consulta de lembretes 24h.
// Implementado pelo adaptador de cron (adapters/cron-lembrete.ts) + dedup no KV (adapters/kv-lembrete.ts).
// Dedup: chave lembrete:{agendamento_id} no LEMBRETE_KV (decisão D-ET1-2 — não altera o DDL).

export interface LembretePort {
  agendar(agendamentoId: number, dataHoraInicio: string): Promise<void>;
  jaEnviado(agendamentoId: number): Promise<boolean>;
  marcarEnviado(agendamentoId: number): Promise<void>;
}