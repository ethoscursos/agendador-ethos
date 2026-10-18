// ports/agenda.ts
// Contrato do port de agenda — implementado pelo adaptador D1 (adapters/d1-agenda.ts).
// Espelha as queries Q1–Q7 do retorno do Expert Banco de Dados v1.2.

export interface HorarioAtendimento {
  id: number;
  profissionalId: number;
  diaSemana: number; // 0 = domingo (JS Date.getDay())
  horaInicio: string; // 'HH:MM' 24h
  horaFim: string; // 'HH:MM' 24h
}

export interface Agendamento {
  id: number;
  profissionalId: number;
  clienteId: number;
  servicoId: number;
  dataHoraInicio: string; // ISO-8601 UTC
  dataHoraFim: string; // ISO-8601 UTC
  status: 'confirmado' | 'cancelado' | 'concluido' | 'no_show';
  criadoEm: string;
  canceladoEm?: string | null;
  motivoCancelamento?: string | null;
}

export interface Servico {
  id: number;
  profissionalId: number;
  nome: string;
  descricao?: string | null;
  duracaoMinutos: number;
  preco?: number | null;
  ativo: number;
}

export interface Cliente {
  id: number;
  nome: string;
  telefone: string; // E.164, único global (D1)
  criadoEm: string;
}

export interface AgendamentoDoPainel {
  id: number;
  dataHoraInicio: string;
  dataHoraFim: string;
  status: string;
  motivoCancelamento?: string | null;
  clienteNome: string;
  clienteTelefone: string;
  servicoNome: string;
  duracaoMinutos: number;
}

export interface AgendaPort {
  // Q1 — horários de atendimento do dia
  listarHorariosDoDia(profissionalId: number, diaSemana: number): Promise<HorarioAtendimento[]>;
  // Q2 — agendamentos confirmados que ocupam o dia
  listarOcupadosDoDia(
    profissionalId: number,
    inicioDoDia: string,
    inicioProximoDia: string
  ): Promise<{ dataHoraInicio: string; dataHoraFim: string }[]>;
  // Q3 — verificar conflito de slot (0 = livre, >0 = ocupado)
  verificarConflito(profissionalId: number, inicio: string, fim: string): Promise<number>;
  // Q4 — criar agendamento com checagem de conflito (atômico)
  criarAgendamento(dados: {
    profissionalId: number;
    clienteId: number;
    servicoId: number;
    inicio: string;
    fim: string;
    criadoEm: string;
  }): Promise<boolean>;
  // Q5 — listar agendamentos do dia (painel)
  listarAgendamentosDoDia(
    profissionalId: number,
    inicioDoDia: string,
    inicioProximoDia: string
  ): Promise<AgendamentoDoPainel[]>;
  // Q6 — cancelar agendamento (pelo profissional)
  cancelarAgendamento(
    id: number,
    profissionalId: number,
    canceladoEm: string,
    motivo: string
  ): Promise<boolean>;
  // Q7 — buscar/inserir cliente por telefone (cliente global — D1)
  buscarOuCriarCliente(nome: string, telefone: string, criadoEm: string): Promise<Cliente>;
}