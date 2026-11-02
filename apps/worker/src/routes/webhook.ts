// routes/webhook.ts — POST /webhook (evento bruto da Evolution API)
// Fluxo: valida apikey + instância → ignora fromMe → normaliza para o
// contrato canônico → lê estado no KV → máquina de estados → responde via fila.

import { Hono } from 'hono';
import type { Env } from '../env';
import { MaquinaEstados } from '../domain/maquina-estados';
import { REGRAS_PADRAO } from '../domain/regras';
import { D1AgendaAdapter } from '../adapters/d1-agenda';
import { KvConversaAdapter } from '../adapters/kv-conversa';
import { KvLembreteAdapter } from '../adapters/kv-lembrete';
import { QueueMensageiroAdapter } from '../adapters/queue-mensageiro';
import { AiInterpretadorAdapter } from '../adapters/ai-interpretador';

// Fallback de mapeamento instância → profissional_id (até a coluna
// instancia_evolution existir no D1 — costura com o Expert BD).
// Formato da env: "prof7=7,prof8=8"
function resolverProfissionalPorInstancia(
  instancia: string,
  env: Env
): number | null {
  const mapa = (env.INSTANCIA_PROFISSIONAL_MAP ?? '')
    .split(',')
    .map((par) => par.trim().split('='))
    .filter(([k]) => k === instancia);
  if (mapa.length === 0) return null;
  const id = Number(mapa[0][1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function webhookRoutes(env: Env): Hono {
  const app = new Hono();

  app.post('/', async (c) => {
    const payload = await c.req.json<Record<string, unknown>>();

    // --- A.1 Contrato externo (evento bruto Evolution v2) ---
    const event = String(payload.event ?? '');
    const instance = String(payload.instance ?? '');
    const apikey = String(payload.apikey ?? '');
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const key = (data.key ?? {}) as Record<string, unknown>;
    const message = (data.message ?? {}) as Record<string, unknown>;

    // --- A.4 Autenticação em duas camadas ---
    // 1. Instância desconhecida → 404 (sem revelar existência)
    const profissionalId = resolverProfissionalPorInstancia(instance, env);
    if (!profissionalId) {
      console.warn(`webhook: instância desconhecida: ${instance}`);
      return c.json({ erro: 'não encontrado' }, 404);
    }
    // 2. apikey divergente → 401
    // (com a coluna no D1, a chave virá do banco; no fallback, validamos
    //  contra a env INSTANCIA_APIKEY_MAP no mesmo formato "prof7=chave")
    const chaves = (env.INSTANCIA_APIKEY_MAP ?? '')
      .split(',')
      .map((par) => par.trim().split('='));
    const chaveEsperada = chaves.find(([k]) => k === instance)?.[1];
    if (!chaveEsperada || apikey !== chaveEsperada) {
      return c.json({ erro: 'não autorizado' }, 401);
    }

    // --- A.2 Normalização ---
    // Só processa messages.upsert recebidas do cliente
    if (event !== 'messages.upsert') return c.json({ ok: true });
    if (key.fromMe === true) return c.json({ ok: true }); // enviada pelo profissional

    // Telefone: remoteJid sem o sufixo @s.whatsapp.net
    const remoteJid = String(key.remoteJid ?? '');
    const telefoneCliente = remoteJid.replace(/@s\.whatsapp\.net$/, '');
    if (!/^\d+$/.test(telefoneCliente)) {
      return c.json({ ok: true }); // telefone malformado — descarta
    }

    // Texto: conversation ou extendedTextMessage.text
    const texto =
      String(message.conversation ?? '') ||
      String(
        ((message.extendedTextMessage ?? {}) as Record<string, unknown>).text ??
          ''
      );
    if (!texto) return c.json({ ok: true }); // sem texto — fora do MVP

    // Nome: pushName (pode ser null)
    const nomeCliente = data.pushName ? String(data.pushName) : null;

    // --- Contrato canônico (A.3) alimenta a máquina ---
    const agenda = new D1AgendaAdapter(env.AGENDADOR_DB);
    const conversaKv = new KvConversaAdapter(
      env.CONVERSA_KV,
      Number(env.TIMEOUT_MINUTOS) * 60
    );
    const mensageiro = new QueueMensageiroAdapter(env.FILA_MENSAGENS);
    const interpretador = new AiInterpretadorAdapter(env.AI);
    const maquina = new MaquinaEstados(agenda, REGRAS_PADRAO, env.FUSO);

    const conversa =
      (await conversaKv.obter(profissionalId, telefoneCliente)) ?? {
        estadoAtual: 'AGUARDANDO_INICIO',
        contexto: {},
        atualizadoEm: new Date().toISOString(),
      };

    const servicos = await agenda.listarServicosAtivos(profissionalId);
    const intencao = await interpretador.interpretar({
      mensagem: texto,
      estadoAtual: conversa.estadoAtual,
      contexto: { servicos: servicos.map((s) => ({ id: s.id, nome: s.nome })) },
    });

    const resultado = await maquina.processar(
      conversa,
      { tipo: 'mensagem', texto, intencao },
      { profissionalId, telefoneCliente }
    );

    await conversaKv.salvar(profissionalId, telefoneCliente, {
      estadoAtual: resultado.novoEstado,
      contexto: resultado.contexto,
      atualizadoEm: new Date().toISOString(),
    });

    for (const resposta of resultado.respostas) {
      await mensageiro.enviarTexto({ para: telefoneCliente, texto: resposta });
    }

    // Ação de escrita — criar agendamento
    if (resultado.acao === 'criar_agendamento' && resultado.dadosAgendamento) {
      const { servicoId, inicio, fim } = resultado.dadosAgendamento;
      const cliente = await agenda.buscarOuCriarCliente(
        nomeCliente ?? 'Cliente',
        telefoneCliente,
        new Date().toISOString()
      );

      const agendamentoId = await agenda.criarAgendamento({
        profissionalId,
        clienteId: cliente.id,
        servicoId,
        inicio,
        fim,
        criadoEm: new Date().toISOString(),
      });

      if (agendamentoId !== null) {
        const lembretes = new KvLembreteAdapter(env.LEMBRETE_KV);
        await lembretes.agendar(agendamentoId, inicio);
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