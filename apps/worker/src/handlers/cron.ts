import type { Env } from '../env';
import { inicioDoDiaUtc, inicioProximoDiaUtc } from '../domain/fuso';
import { D1AgendaAdapter } from '../adapters/d1-agenda';
import { KvLembreteAdapter } from '../adapters/kv-lembrete';
import { QueueMensageiroAdapter } from '../adapters/queue-mensageiro';

export async function processarCron(env: Env): Promise<void> {
  const agora = new Date();
  const proximo = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  const diaAlvo = proximo.toISOString().slice(0, 10);

  // Fronteiras do dia seguinte em UTC, calculadas a partir de America/Sao_Paulo
  // (ponto de atenção da Seção 24.3 do RDA v22 — Q8)
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