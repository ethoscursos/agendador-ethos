// test/maquina-estados.test.ts
import { describe, expect, it } from 'vitest';
import { MaquinaEstados } from '../src/domain/maquina-estados';
import type { AgendaPort } from '../src/ports/agenda';
import type { Conversa } from '../src/domain/tipos';
import { REGRAS_PADRAO } from '../src/domain/regras';

// Fake do port de agenda — implementação em memória para teste (sem Cloudflare).
const agendaFake: AgendaPort = {
  listarHorariosDoDia: async () => [],
  listarOcupadosDoDia: async () => [],
  verificarConflito: async () => 0,
  criarAgendamento: async () => true,
  listarAgendamentosDoDia: async () => [],
  cancelarAgendamento: async () => true,
  buscarOuCriarCliente: async (nome, telefone) => ({ id: 1, nome, telefone, criadoEm: new Date().toISOString() }),
};

const conversaInicial: Conversa = {
  estadoAtual: 'AGUARDANDO_INICIO',
  contexto: {},
  atualizadoEm: new Date().toISOString(),
};

describe('MaquinaEstados', () => {
  it('AGUARDANDO_INICIO → SELECAO_SERVICO ao receber mensagem', async () => {
    const maquina = new MaquinaEstados(agendaFake, REGRAS_PADRAO);
    const resultado = await maquina.processar(conversaInicial, {
      tipo: 'mensagem',
      texto: 'oi',
      intencao: { intencao: 'desconhecida', entidades: {} },
    });
    expect(resultado.novoEstado).toBe('SELECAO_SERVICO');
  });

  it('SELECAO_SERVICO → SELECAO_DIA quando a IA extrai o serviço', async () => {
    const maquina = new MaquinaEstados(agendaFake, REGRAS_PADRAO);
    const resultado = await maquina.processar(
      { ...conversaInicial, estadoAtual: 'SELECAO_SERVICO' },
      { tipo: 'mensagem', texto: 'quero cortar o cabelo', intencao: { intencao: 'escolher_servico', entidades: { servico: '1' } } }
    );
    expect(resultado.novoEstado).toBe('SELECAO_DIA');
    expect(resultado.contexto.servicoSelecionado).toBe(1);
  });

  it('CONFIRMACAO com "sim" → CONCLUIDO com ação de criar agendamento', async () => {
    const maquina = new MaquinaEstados(agendaFake, REGRAS_PADRAO);
    const resultado = await maquina.processar(
      {
        estadoAtual: 'CONFIRMACAO',
        contexto: { servicoSelecionado: 1, diaSelecionado: '2026-10-19', horarioSelecionado: '14:30' },
        atualizadoEm: new Date().toISOString(),
      },
      { tipo: 'mensagem', texto: 'sim', intencao: { intencao: 'confirmar', entidades: {} } }
    );
    expect(resultado.novoEstado).toBe('CONCLUIDO');
    expect(resultado.acao).toBe('criar_agendamento');
  });
});