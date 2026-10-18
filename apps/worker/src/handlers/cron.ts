// handlers/cron.ts
// Cron Trigger — lembretes 24h antes do agendamento.
// Busca agendamentos confirmados do dia seguinte no fuso America/Sao_Paulo,
// envia lembrete via fila e marca como enviado no LEMBRETE_KV (dedup — D-ET1-2).

import type { Env } from '../env';
import { inicioDoDiaUtc, inicioProximoDiaUtc } from '../domain/fuso';
import { D1AgendaAdapter } from '../adapters/d1-agenda';
import { KvLembreteAdapter } from '../adapters/kv-lembrete';
import { QueueMensageiroAdapter } from '../adapters/queue-mensageiro';

export async function processarCron(env: Env): Promise<void> {
  const agora = new Date();
  const proximo = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  const diaAlvo = proximo.toISOString().slice(0, 10);

  const inicio = inicioDoDiaUtc(diaAlvo, env.FUSO);
  const fim = inicioProximoDiaUtc(diaAlvo, env.FUSO);

  const agenda = new D1AgendaAdapter(env.AGENDADOR_DB);
  const lembretes = new KvLembreteAdapter(env.LEMBRETE_KV);
  const mensageiro = new QueueMensageiroAdapter(env.FILA_MENSAGENS);

  // Buscar todos os profissionais com agendamentos no dia alvo
  // (por ora, itera por profissionalId — a query de "todos os profissionais"
  // pode ser adicionada ao port se necessário; no MVP assume-se 1 profissional)
  const profissionalId = 1; // TODO (multi-tenant): iterar pelos profissionais ativos
  const agendamentos = await agenda.listarLembretesDoDia(profissionalId, inicio, fim);

  for (const agendamento of agendamentos) {
    if (await lembretes.jaEnviado(agendamento.id)) continue; // dedup

    const horario = agendamento.dataHoraInicio.slice(11, 16);
    await mensageiro.enviarTexto({
      para: agendamento.clienteTelefone,
      texto: `Olá, ${agendamento.clienteNome}! 👋 Lembrete: seu ${agendamento.servicoNome} é amanhã às ${horario}.`,
    });

    await lembretes.marcarEnviado(agendamento.id);
  }
}