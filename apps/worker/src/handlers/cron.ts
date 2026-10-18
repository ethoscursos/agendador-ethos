// handlers/cron.ts
// Cron Trigger — lembretes 24h antes do agendamento.
// Busca agendamentos confirmados do dia seguinte no fuso America/Sao_Paulo,
// envia lembrete via fila e marca como enviado no LEMBRETE_KV (dedup — D-ET1-2).

import type { Env } from '../env';
import { inicioDoDiaUtc, inicioProximoDiaUtc } from '../domain/fuso';
import { KvLembreteAdapter } from '../adapters/kv-lembrete';
import { QueueMensageiroAdapter } from '../adapters/queue-mensageiro';

export async function processarCron(env: Env): Promise<void> {
  const agora = new Date();
  const diaAtual = agora.toISOString().slice(0, 10);
  // Dia seguinte no fuso (aproximação: +1 dia em UTC — o fuso exato entra no adaptador)
  const proximo = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  const diaAlvo = proximo.toISOString().slice(0, 10);

  const inicio = inicioDoDiaUtc(diaAlvo, env.FUSO);
  const fim = inicioProximoDiaUtc(diaAlvo, env.FUSO);

  // TODO (Etapa 7): query dedicada de lembretes — agendamentos confirmados
  // do dia alvo com cliente e serviço (JOIN cliente + servico).
  // Por ora, o cron apenas registra a janela processada.
  console.log('cron lembretes', { diaAtual, diaAlvo, inicio, fim });
}