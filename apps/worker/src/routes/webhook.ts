// routes/webhook.ts — POST /webhook (entrada de mensagens da Evolution API)
// Orquestra o fluxo: extrai profissional_id e telefone_cliente do payload,
// lê o estado do KV, roda a máquina de estados, salva o estado e envia a resposta via fila.

import { Hono } from 'hono';
import type { Env } from '../env';
import { MaquinaEstados } from '../domain/maquina-estados';
import { REGRAS_PADRAO } from '../domain/regras';
import { D1AgendaAdapter } from '../adapters/d1-agenda';
import { KvConversaAdapter } from '../adapters/kv-conversa';
import { QueueMensageiroAdapter } from '../adapters/queue-mensageiro';
import { AiInterpretadorAdapter } from '../adapters/ai-interpretador';

export function webhookRoutes(env: Env): Hono {
  const app = new Hono();

  app.post('/', async (c) => {
    const payload = await c.req.json<Record<string, unknown>>();

    // TODO (contrato WhatsApp): extrair profissional_id e telefone_cliente do payload
    // da Evolution API (formato exato definido pelo Expert WhatsApp — Seção 13).
    const profissionalId = Number(payload.profissional_id ?? 0);
    const telefoneCliente = String(payload.telefone_cliente ?? '');
    const texto = String(payload.texto ?? '');

    if (!profissionalId || !telefoneCliente) {
      return c.json({ erro: 'payload inválido' }, 400);
    }

    const agenda = new D1AgendaAdapter(env.AGENDADOR_DB);
    const conversaKv = new KvConversaAdapter(env.CONVERSA_KV, Number(env.TIMEOUT_MINUTOS) * 60);
    const mensageiro = new QueueMensageiroAdapter(env.FILA_MENSAGENS);
    const interpretador = new AiInterpretadorAdapter(env.AI);

    const maquina = new MaquinaEstados(agenda, REGRAS_PADRAO, env.FUSO);

    // 1. Ler estado atual da conversa (ou iniciar nova)
    const conversa =
      (await conversaKv.obter(profissionalId, telefoneCliente)) ?? {
        estadoAtual: 'AGUARDANDO_INICIO',
        contexto: {},
        atualizadoEm: new Date().toISOString(),
      };

    // 2. Interpretar a intenção com a IA (a IA nunca decide — só interpreta)
    const servicos = await agenda.listarServicosAtivos(profissionalId);
    const intencao = await interpretador.interpretar({
      mensagem: texto,
      estadoAtual: conversa.estadoAtual,
      contexto: { servicos: servicos.map((s) => ({ id: s.id, nome: s.nome })) },
    });

    // 3. Rodar a máquina de estados
    const resultado = await maquina.processar(
      conversa,
      { tipo: 'mensagem', texto, intencao },
      { profissionalId, telefoneCliente }
    );

    // 4. Salvar o novo estado no KV
    await conversaKv.salvar(profissionalId, telefoneCliente, {
      estadoAtual: resultado.novoEstado,
      contexto: resultado.contexto,
      atualizadoEm: new Date().toISOString(),
    });

    // 5. Enviar as respostas via fila (assíncrono)
    for (const resposta of resultado.respostas) {
      await mensageiro.enviarTexto({ para: telefoneCliente, texto: resposta });
    }

    // ... dentro do handler do webhook, após salvar o estado ...

// 6. Ações de escrita — quando a máquina decidiu criar o agendamento
if (resultado.acao === 'criar_agendamento' && resultado.dadosAgendamento) {
  const { servicoId, inicio, fim } = resultado.dadosAgendamento;
  // TODO (contrato WhatsApp): obter o nome do cliente do payload da Evolution
  const nomeCliente = String(payload.nome_cliente ?? 'Cliente');

  const cliente = await agenda.buscarOuCriarCliente(
    nomeCliente,
    telefoneCliente,
    new Date().toISOString()
  );

  const criado = await agenda.criarAgendamento({
    profissionalId,
    clienteId: cliente.id,
    servicoId,
    inicio,
    fim,
    criadoEm: new Date().toISOString(),
  });

  if (criado) {
    // Agendar lembrete 24h (dedup no LEMBRETE_KV)
    const lembretes = new KvLembreteAdapter(env.LEMBRETE_KV);
    await lembretes.agendar(0, inicio); // TODO: obter o id do agendamento criado
    await mensageiro.enviarTexto({
      para: telefoneCliente,
      texto: 'Agendamento confirmado! ✅ Enviamos o resumo.',
    });
  } else {
    await mensageiro.enviarTexto({
      para: telefoneCliente,
      texto: 'Infelizmente esse horário acabou de ser ocupado. Escolha outro, por favor.',
    });
  }
}

    return c.json({ ok: true });
  });

  return app;
}