// domain/maquina-estados.ts
// Máquina de estados determinística da conversa (Seção 10 do RDA v18).
// TypeScript PURO — depende apenas de ports (interfaces), nunca da Cloudflare.

import type { Conversa, EstadoConversa, Intencao } from './tipos';
import type { AgendaPort } from '../ports/agenda';
import type { RegrasAgendamento } from './regras';
import { slotsLivres } from './slots';

export type EventoConversa =
  | { tipo: 'mensagem'; texto: string; intencao: Intencao }
  | { tipo: 'timeout' }
  | { tipo: 'cancelamento_profissional' };

export interface ResultadoProcessamento {
  novoEstado: EstadoConversa;
  contexto: Conversa['contexto'];
  respostas: string[];
  acao?: 'criar_agendamento' | 'agendar_lembrete' | 'limpar_conversa';
  dadosAgendamento?: { servicoId: number; dia: string; horario: string };
}

export class MaquinaEstados {
  constructor(
    private agenda: AgendaPort,
    private regras: RegrasAgendamento
  ) {}

  async processar(conversa: Conversa, evento: EventoConversa): Promise<ResultadoProcessamento> {
    switch (conversa.estadoAtual) {
      case 'AGUARDANDO_INICIO': return this.aguardandoInicio(conversa, evento);
      case 'SELECAO_SERVICO': return this.selecaoServico(conversa, evento);
      case 'SELECAO_DIA': return this.selecaoDia(conversa, evento);
      case 'SELECAO_HORARIO': return this.selecaoHorario(conversa, evento);
      case 'CONFIRMACAO': return this.confirmacao(conversa, evento);
      case 'CONCLUIDO': return this.concluido(conversa, evento);
      case 'CANCELADO': return this.cancelado(conversa, evento);
      case 'TIMEOUT': return this.timeout(conversa, evento);
    }
  }

  // AGUARDANDO_INICIO — qualquer mensagem inicia: cumprimenta e apresenta o menu de serviços.
  private async aguardandoInicio(conversa: Conversa, evento: EventoConversa): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    return {
      novoEstado: 'SELECAO_SERVICO',
      contexto: conversa.contexto,
      respostas: ['Olá! 👋 Escolha um dos nossos serviços:'],
    };
  }

  // SELECAO_SERVICO — cliente escolhe o serviço (número, nome ou mensagem livre interpretada pela IA).
  private async selecaoServico(conversa: Conversa, evento: EventoConversa): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    const servico = evento.intencao.entidades.servico;
    if (!servico) return this.mensagemInvalida(conversa, 'Não entendi o serviço. Escolha uma das opções:');
    return {
      novoEstado: 'SELECAO_DIA',
      contexto: { ...conversa.contexto, servicoSelecionado: Number(servico) },
      respostas: ['Serviço selecionado! ✅ Para qual dia você quer agendar?'],
    };
  }

  // SELECAO_DIA — cliente escolhe o dia; a máquina consulta a agenda real e mostra os horários.
  private async selecaoDia(conversa: Conversa, evento: EventoConversa): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    const dia = evento.intencao.entidades.dia;
    if (!dia) return this.mensagemInvalida(conversa, 'Não entendi o dia. Tente "amanhã", "quarta" ou "dia 21":');
    // TODO (Etapa 4): resolver o dia no fuso America/Sao_Paulo, chamar Q1+Q2 e slotsLivres.
    return {
      novoEstado: 'SELECAO_HORARIO',
      contexto: { ...conversa.contexto, diaSelecionado: dia },
      respostas: ['Esses são os horários disponíveis:'],
    };
  }

  // SELECAO_HORARIO — cliente escolhe o horário; a máquina valida o slot (Q3) e pede confirmação.
  private async selecaoHorario(conversa: Conversa, evento: EventoConversa): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    const horario = evento.intencao.entidades.horario;
    if (!horario) return this.mensagemInvalida(conversa, 'Não entendi o horário. Tente "14:30":');
    // TODO (Etapa 4): validar o slot com Q3 (verificarConflito) antes de avançar.
    return {
      novoEstado: 'CONFIRMACAO',
      contexto: { ...conversa.contexto, horarioSelecionado: horario },
      respostas: ['Confirma o agendamento? Responda "sim" para confirmar.'],
    };
  }

  // CONFIRMACAO — a IA NÃO decide aqui: a máquina valida o slot contra a agenda real (Q3) e grava (Q4).
  private async confirmacao(conversa: Conversa, evento: EventoConversa): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    if (evento.intencao.intencao === 'cancelar') {
      return {
        novoEstado: 'SELECAO_SERVICO',
        contexto: { ...conversa.contexto, servicoSelecionado: undefined, diaSelecionado: undefined, horarioSelecionado: undefined },
        respostas: ['Sem problemas! Vamos recomeçar. Escolha um serviço:'],
      };
    }
    if (evento.intencao.intencao !== 'confirmar') {
      return this.mensagemInvalida(conversa, 'Responda "sim" para confirmar ou "não" para recomeçar.');
    }
    // TODO (Etapa 4): Q3 (conflito) + Q4 (criar agendamento) + agendar lembrete 24h.
    return {
      novoEstado: 'CONCLUIDO',
      contexto: conversa.contexto,
      respostas: ['Agendamento confirmado! ✅ Enviamos o resumo.'],
      acao: 'criar_agendamento',
      dadosAgendamento: {
        servicoId: conversa.contexto.servicoSelecionado ?? 0,
        dia: conversa.contexto.diaSelecionado ?? '',
        horario: conversa.contexto.horarioSelecionado ?? '',
      },
    };
  }

  // CONCLUIDO — terminal. Nova mensagem reinicia a conversa.
  private async concluido(conversa: Conversa, evento: EventoConversa): Promise<ResultadoProcessamento> {
    if (evento.tipo !== 'mensagem') return this.mensagemInvalida(conversa);
    return {
      novoEstado: 'AGUARDANDO_INICIO',
      contexto: { servicoSelecionado: undefined, diaSelecionado: undefined, horarioSelecionado: undefined },
      respostas: ['Quer agendar outro horário? Escolha um serviço:'],
    };
  }

  // CANCELADO — profissional cancelou; oferece remarcação. "sim" volta para SELECAO_SERVICO.
  private async cancelado(conversa: Conversa, evento: EventoConversa): Promise<ResultadoProcessamento> {
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

  // TIMEOUT — sem resposta em 10 min: encerra com mensagem amigável e limpa o KV.
  private async timeout(conversa: Conversa, evento: EventoConversa): Promise<ResultadoProcessamento> {
    return {
      novoEstado: 'TIMEOUT',
      contexto: conversa.contexto,
      respostas: ['Como não houve resposta, encerramos esta conversa. Quando quiser, é só chamar! 👋'],
      acao: 'limpar_conversa',
    };
  }

  // Mensagem inválida em qualquer estado: re-apresenta as opções do estado atual — nunca inventa caminho.
  private mensagemInvalida(conversa: Conversa, texto = 'Não entendi. Vamos tentar de novo:'): ResultadoProcessamento {
    return {
      novoEstado: conversa.estadoAtual,
      contexto: conversa.contexto,
      respostas: [texto],
    };
  }
}