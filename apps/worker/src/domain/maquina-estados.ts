// domain/maquina-estados.ts (atualizado — Etapa 4)
// A máquina continua TypeScript PURO: chama apenas os ports (interfaces).
// As escritas (Q4, lembrete, mensagens) são executadas pelo orquestrador (webhook handler).

import type { Conversa, EstadoConversa, Intencao } from './tipos';
import type { AgendaPort } from '../ports/agenda';
import type { RegrasAgendamento } from './regras';
import { slotsLivres } from './slots';
import { resolverDia } from './dias';

export interface ContextoExecucao {
  profissionalId: number;
  telefoneCliente: string;
  nomeCliente?: string;
}

export type EventoConversa =
  | { tipo: 'mensagem'; texto: string; intencao: Intencao }
  | { tipo: 'timeout' }
  | { tipo: 'cancelamento_profissional' };

export interface ResultadoProcessamento {
  novoEstado: EstadoConversa;
  contexto: Conversa['contexto'];
  respostas: string[];
  acao?: 'criar_agendamento' | 'agendar_lembrete' | 'limpar_conversa';
  dadosAgendamento?: {
    profissionalId: number;
    servicoId: number;
    inicio: string;
    fim: string;
  };
}

export class MaquinaEstados {
  constructor(
    private agenda: AgendaPort,
    private regras: RegrasAgendamento,
    private fuso: string
  ) {}

  async processar(
    conversa: Conversa,
    evento: EventoConversa,
    ctx: ContextoExecucao
  ): Promise<ResultadoProcessamento> {
    switch (conversa.estadoAtual) {
      case 'AGUARDANDO_INICIO': return this.aguardandoInicio(conversa, evento, ctx);
      case 'SELECAO_SERVICO': return this.selecaoServico(conversa, evento, ctx);
      case 'SELECAO_DIA': return this.selecaoDia(conversa, evento, ctx);
      case 'SELECAO_HORARIO': return this.selecaoHorario(conversa, evento, ctx);
      case 'CONFIRMACAO': return this.confirmacao(conversa, evento, ctx);
      case 'CONCLUIDO': return this.concluido(conversa, evento, ctx);
      case 'CANCELADO': return this.cancelado(conversa, evento, ctx);
      case 'TIMEOUT': return this.timeout(conversa, evento, ctx);
    }
  }

  private async aguardandoInicio(conversa: Conversa, evento: EventoConversa, ctx: ContextoExecucao): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    const servicos = await this.agenda.listarServicosAtivos(ctx.profissionalId);
    const menu = servicos.map((s, i) => `${i + 1}. ${s.nome} (${s.duracaoMinutos} min)`).join('\n');
    return {
      novoEstado: 'SELECAO_SERVICO',
      contexto: conversa.contexto,
      respostas: [`Olá! 👋 Escolha um dos nossos serviços:\n${menu}`],
    };
  }

  private async selecaoServico(conversa: Conversa, evento: EventoConversa, ctx: ContextoExecucao): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    const servico = evento.intencao.entidades.servico;
    if (!servico) return this.mensagemInvalida(conversa, 'Não entendi o serviço. Escolha uma das opções:');
    const servicoId = Number(servico);
    const servicoReal = await this.agenda.obterServico(ctx.profissionalId, servicoId);
    if (!servicoReal) return this.mensagemInvalida(conversa, 'Serviço não encontrado. Escolha uma das opções:');
    return {
      novoEstado: 'SELECAO_DIA',
      contexto: { ...conversa.contexto, servicoSelecionado: servicoId },
      respostas: [`Serviço selecionado: ${servicoReal.nome} ✅\nPara qual dia você quer agendar?`],
    };
  }

  private async selecaoDia(conversa: Conversa, evento: EventoConversa, ctx: ContextoExecucao): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    const dia = evento.intencao.entidades.dia;
    if (!dia) return this.mensagemInvalida(conversa, 'Não entendi o dia. Tente "amanhã", "quarta" ou "dia 21":');
    const diaResolvido = resolverDia(dia, new Date(), this.fuso);
    if (!diaResolvido) return this.mensagemInvalida(conversa, 'Não entendi o dia. Tente "amanhã", "quarta" ou "dia 21":');

    const servicoId = conversa.contexto.servicoSelecionado;
    if (!servicoId) return this.mensagemInvalida(conversa, 'Precisamos escolher o serviço primeiro:');
    const servico = await this.agenda.obterServico(ctx.profissionalId, servicoId);
    if (!servico) return this.mensagemInvalida(conversa, 'Serviço não encontrado. Vamos recomeçar:');

    const diaSemana = new Date(`${diaResolvido}T00:00:00Z`).getDay();
    const intervalos = await this.agenda.listarHorariosDoDia(ctx.profissionalId, diaSemana);
    if (intervalos.length === 0) {
      return this.mensagemInvalida(conversa, 'Não há horários de atendimento nesse dia. Escolha outro dia:');
    }

    const inicioDoDia = `${diaResolvido}T00:00:00.000Z`;
    const inicioProximoDia = `${diaResolvido}T00:00:00.000Z`; // TODO: +1 dia no fuso
    const ocupados = await this.agenda.listarOcupadosDoDia(ctx.profissionalId, inicioDoDia, inicioProximoDia);
    const slots = slotsLivres(intervalos, ocupados, servico.duracaoMinutos, diaResolvido, this.regras.antecedenciaMinimaMinutos);

    if (slots.length === 0) {
      return this.mensagemInvalida(conversa, 'Não há horários livres nesse dia. Escolha outro dia:');
    }

    const lista = slots.map((s, i) => `${i + 1}. ${formatarHorario(s.inicio)}`).join('\n');
    return {
      novoEstado: 'SELECAO_HORARIO',
      contexto: { ...conversa.contexto, diaSelecionado: diaResolvido },
      respostas: [`Horários disponíveis em ${diaResolvido}:\n${lista}\nEscolha um horário:`],
    };
  }

  private async selecaoHorario(conversa: Conversa, evento: EventoConversa, ctx: ContextoExecucao): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    const horario = evento.intencao.entidades.horario;
    if (!horario) return this.mensagemInvalida(conversa, 'Não entendi o horário. Tente "14:30":');
    // TODO (Etapa 4): converter "14:30" em ISO-8601 UTC no fuso e validar com Q3.
    return {
      novoEstado: 'CONFIRMACAO',
      contexto: { ...conversa.contexto, horarioSelecionado: horario },
      respostas: ['Confirma o agendamento? Responda "sim" para confirmar.'],
    };
  }

  private async confirmacao(conversa: Conversa, evento: EventoConversa, ctx: ContextoExecucao): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    if (evento.intencao.intencao === 'cancelar') {
      return {
        novoEstado: 'SELECAO_SERVICO',
        contexto: { servicoSelecionado: undefined, diaSelecionado: undefined, horarioSelecionado: undefined },
        respostas: ['Sem problemas! Vamos recomeçar. Escolha um serviço:'],
      };
    }
    if (evento.intencao.intencao !== 'confirmar') {
      return this.mensagemInvalida(conversa, 'Responda "sim" para confirmar ou "não" para recomeçar.');
    }
    // TODO (Etapa 4): montar inicio/fim ISO-8601 UTC, validar Q3 e retornar criar_agendamento.
    return {
      novoEstado: 'CONCLUIDO',
      contexto: conversa.contexto,
      respostas: ['Agendamento confirmado! ✅ Enviamos o resumo.'],
      acao: 'criar_agendamento',
      dadosAgendamento: {
        profissionalId: ctx.profissionalId,
        servicoId: conversa.contexto.servicoSelecionado ?? 0,
        inicio: '',
        fim: '',
      },
    };
  }

  private async concluido(conversa: Conversa, evento: EventoConversa, ctx: ContextoExecucao): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    return {
      novoEstado: 'AGUARDANDO_INICIO',
      contexto: { servicoSelecionado: undefined, diaSelecionado: undefined, horarioSelecionado: undefined },
      respostas: ['Quer agendar outro horário? Escolha um serviço:'],
    };
  }

  private async cancelado(conversa: Conversa, evento: EventoConversa, ctx: ContextoExecucao): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    if (evento.intencao.intencao === 'confirmar') {
      return {
        novoEstado: 'SELECAO_SERVICO',
        contexto: { servicoSelecionado: undefined, diaSelecionado: undefined, horarioSelecionado: undefined },
        respostas: ['Vamos remarcar! Escolha um serviço:'],
      };
    }
    return {
      novoEstado: 'CONCLUIDO',
      contexto: conversa.contexto,
      respostas: ['Tudo bem. Se precisar, é só chamar!'],
    };
  }

  private async timeout(conversa: Conversa, evento: EventoConversa, ctx: ContextoExecucao): Promise<ResultadoProcessamento> {
    return {
      novoEstado: 'TIMEOUT',
      contexto: conversa.contexto,
      respostas: ['Como não houve resposta, encerramos esta conversa. Quando quiser, é só chamar! 👋'],
      acao: 'limpar_conversa',
    };
  }

  private mensagemInvalida(conversa: Conversa, texto = 'Não entendi. Vamos tentar de novo:'): ResultadoProcessamento {
    return {
      novoEstado: conversa.estadoAtual,
      contexto: conversa.contexto,
      respostas: [texto],
    };
  }
}

function formatarHorario(iso: string): string {
  return iso.slice(11, 16); // 'HH:MM' do ISO-8601 UTC
}