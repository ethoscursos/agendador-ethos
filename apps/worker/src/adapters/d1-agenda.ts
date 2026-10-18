// adapters/d1-agenda.ts
// Implementação do port de agenda sobre o D1 (AGENDADOR_DB).
// Queries Q1–Q7 do retorno do Expert Banco de Dados v1.2 — SQL portável, sem alteração.

import type {
  AgendaPort,
  AgendamentoDoPainel,
  Cliente,
  HorarioAtendimento,
  Servico,
} from '../ports/agenda';

export class D1AgendaAdapter implements AgendaPort {
  constructor(private db: D1Database) {}

  // Q1 — horários de atendimento do dia
  async listarHorariosDoDia(profissionalId: number, diaSemana: number): Promise<HorarioAtendimento[]> {
    const { results } = await this.db
      .prepare(
        'SELECT id, hora_inicio, hora_fim FROM horario_atendimento WHERE profissional_id = ? AND dia_semana = ? ORDER BY hora_inicio'
      )
      .bind(profissionalId, diaSemana)
      .all<{ id: number; hora_inicio: string; hora_fim: string }>();
    return results.map((r) => ({
      id: r.id,
      profissionalId,
      diaSemana,
      horaInicio: r.hora_inicio,
      horaFim: r.hora_fim,
    }));
  }

  // Q2 — agendamentos confirmados que ocupam o dia
  async listarOcupadosDoDia(
    profissionalId: number,
    inicioDoDia: string,
    inicioProximoDia: string
  ): Promise<{ dataHoraInicio: string; dataHoraFim: string }[]> {
    const { results } = await this.db
      .prepare(
        'SELECT data_hora_inicio, data_hora_fim FROM agendamento WHERE profissional_id = ? AND status = ? AND data_hora_inicio < ? AND data_hora_fim > ? ORDER BY data_hora_inicio'
      )
      .bind(profissionalId, 'confirmado', inicioProximoDia, inicioDoDia)
      .all<{ data_hora_inicio: string; data_hora_fim: string }>();
    return results.map((r) => ({ dataHoraInicio: r.data_hora_inicio, dataHoraFim: r.data_hora_fim }));
  }

  // Q3 — verificar conflito de slot (0 = livre, >0 = ocupado)
  async verificarConflito(profissionalId: number, inicio: string, fim: string): Promise<number> {
    const { results } = await this.db
      .prepare(
        'SELECT COUNT(*) AS conflitos FROM agendamento WHERE profissional_id = ? AND status = ? AND data_hora_inicio < ? AND data_hora_fim > ?'
      )
      .bind(profissionalId, 'confirmado', fim, inicio)
      .all<{ conflitos: number }>();
    return results[0]?.conflitos ?? 0;
  }

  // Q4 — criar agendamento com checagem de conflito (atômico)
  async criarAgendamento(dados: {
    profissionalId: number;
    clienteId: number;
    servicoId: number;
    inicio: string;
    fim: string;
    criadoEm: string;
  }): Promise<boolean> {
    const { meta } = await this.db
      .prepare(
        `INSERT INTO agendamento (profissional_id, cliente_id, servico_id, data_hora_inicio, data_hora_fim, status, criado_em)
         SELECT ?, ?, ?, ?, ?, 'confirmado', ?
         WHERE NOT EXISTS (
           SELECT 1 FROM agendamento
           WHERE profissional_id = ? AND status = 'confirmado'
             AND data_hora_inicio < ? AND data_hora_fim > ?
         )`
      )
      .bind(
        dados.profissionalId,
        dados.clienteId,
        dados.servicoId,
        dados.inicio,
        dados.fim,
        dados.criadoEm,
        dados.profissionalId,
        dados.fim,
        dados.inicio
      )
      .run();
    return (meta.changes ?? 0) > 0;
  }

  // Q5 — listar agendamentos do dia (painel)
  async listarAgendamentosDoDia(
    profissionalId: number,
    inicioDoDia: string,
    inicioProximoDia: string
  ): Promise<AgendamentoDoPainel[]> {
    const { results } = await this.db
      .prepare(
        `SELECT a.id, a.data_hora_inicio, a.data_hora_fim, a.status, a.motivo_cancelamento,
                c.nome AS cliente_nome, c.telefone AS cliente_telefone,
                s.nome AS servico_nome, s.duracao_minutos
         FROM agendamento a
         JOIN cliente c ON c.id = a.cliente_id
         JOIN servico s ON s.id = a.servico_id
         WHERE a.profissional_id = ? AND a.data_hora_inicio >= ? AND a.data_hora_inicio < ?
         ORDER BY a.data_hora_inicio`
      )
      .bind(profissionalId, inicioDoDia, inicioProximoDia)
      .all<AgendamentoDoPainel>();
    return results;
  }

  // Q6 — cancelar agendamento (pelo profissional, painel)
  async cancelarAgendamento(
    id: number,
    profissionalId: number,
    canceladoEm: string,
    motivo: string
  ): Promise<boolean> {
    const { meta } = await this.db
      .prepare(
        `UPDATE agendamento SET status = 'cancelado', cancelado_em = ?, motivo_cancelamento = ?
         WHERE id = ? AND profissional_id = ? AND status = 'confirmado'`
      )
      .bind(canceladoEm, motivo, id, profissionalId)
      .run();
    return (meta.changes ?? 0) > 0;
  }

  // Q7 — buscar/inserir cliente por telefone (cliente global — D1)
  async buscarOuCriarCliente(nome: string, telefone: string, criadoEm: string): Promise<Cliente> {
    const existente = await this.db
      .prepare('SELECT id, nome, telefone, criado_em FROM cliente WHERE telefone = ?')
      .bind(telefone)
      .first<{ id: number; nome: string; telefone: string; criado_em: string }>();
    if (existente) {
      return { id: existente.id, nome: existente.nome, telefone: existente.telefone, criadoEm: existente.criado_em };
    }
    await this.db
      .prepare('INSERT INTO cliente (nome, telefone, criado_em) VALUES (?, ?, ?) ON CONFLICT (telefone) DO NOTHING')
      .bind(nome, telefone, criadoEm)
      .run();
    const criado = await this.db
      .prepare('SELECT id, nome, telefone, criado_em FROM cliente WHERE telefone = ?')
      .bind(telefone)
      .first<{ id: number; nome: string; telefone: string; criado_em: string }>();
    return { id: criado!.id, nome: criado!.nome, telefone: criado!.telefone, criadoEm: criado!.criado_em };
  }

  // Novo (Etapa 4): listar serviços ativos — cobre o menu do WhatsApp (idx_servico_profissional_ativo)
  async listarServicosAtivos(profissionalId: number): Promise<Servico[]> {
    const { results } = await this.db
      .prepare(
        'SELECT id, profissional_id, nome, descricao, duracao_minutos, preco, ativo FROM servico WHERE profissional_id = ? AND ativo = 1 ORDER BY nome'
      )
      .bind(profissionalId)
      .all<{ id: number; profissional_id: number; nome: string; descricao: string | null; duracao_minutos: number; preco: number | null; ativo: number }>();
    return results.map((r) => ({
      id: r.id,
      profissionalId: r.profissional_id,
      nome: r.nome,
      descricao: r.descricao,
      duracaoMinutos: r.duracao_minutos,
      preco: r.preco,
      ativo: r.ativo,
    }));
  }

  // Novo (Etapa 4): obter um serviço (para a duração do slot)
  async obterServico(profissionalId: number, servicoId: number): Promise<Servico | null> {
    const r = await this.db
      .prepare(
        'SELECT id, profissional_id, nome, descricao, duracao_minutos, preco, ativo FROM servico WHERE profissional_id = ? AND id = ? AND ativo = 1'
      )
      .bind(profissionalId, servicoId)
      .first<{ id: number; profissional_id: number; nome: string; descricao: string | null; duracao_minutos: number; preco: number | null; ativo: number }>();
    if (!r) return null;
    return {
      id: r.id,
      profissionalId: r.profissional_id,
      nome: r.nome,
      descricao: r.descricao,
      duracaoMinutos: r.duracao_minutos,
      preco: r.preco,
      ativo: r.ativo,
    };
  }
}