import type { Env } from '../env';
import {
  inicioDoDiaUtc,
  inicioProximoDiaUtc,
  diaNoFuso,
  proximoDia,
} from '../domain/fuso';
import { D1AgendaAdapter } from '../adapters/d1-agenda';
import { KvLembreteAdapter } from '../adapters/kv-lembrete';
import { QueueMensageiroAdapter } from '../adapters/queue-mensageiro';

export async function processarCron(env: Env, agora: Date = new Date()): Promise<void> {
  // Dia alvo derivado NO FUSO (America/Sao_Paulo), não em UTC puro — robusto mesmo
  // se o horário do cron mudar para antes das 03:00 BRT (RDA v24, Seção 27.2).
  const diaAlvo = proximoDia(diaNoFuso(agora, env.FUSO));

  // Fronteiras do dia seguinte em UTC, calculadas a partir do fuso (Seção 24.3 / Q8).
  const inicioProximoDia = inicioDoDiaUtc(diaAlvo, env.FUSO);
  const inicioDoDiaSeguinte = inicioProximoDiaUtc(diaAlvo, env.FUSO);

  const agenda = new D1AgendaAdapter(env.AGENDADOR_DB);
  const lembretes = new KvLembreteAdapter(env.LEMBRETE_KV);
  const mensageiro = new QueueMensageiroAdapter(env.FILA_MENSAGENS);

  // Q8 global: uma única query para todos os profissionais ativos (sem N+1)
  const agendamentos = await agenda.listarLembretesDoDia(
    inicioProximoDia,
    inicioDoDiaSeguinte
  );

  for (const agendamento of agendamentos) {
    if (await lembretes.jaEnviado(agendamento.id)) continue; // dedup

    const horario = agendamento.dataHoraInicio.slice(11, 16);
    await mensageiro.enviarTexto({
      para: agendamento.clienteTelefone,
      texto: `Olá, ${agendamento.clienteNome}! Lembrete: seu ${agendamento.servicoNome} é amanhã às ${horario}.`,
    });

    await lembretes.marcarEnviado(agendamento.id);
  }
}