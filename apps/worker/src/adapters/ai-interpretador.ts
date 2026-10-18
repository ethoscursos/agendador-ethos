// adapters/ai-interpretador.ts
// Implementação do port de interpretação sobre o Workers AI.
// A IA NUNCA grava agendamento — apenas interpreta a mensagem e extrai a intenção (Seção 10).
// Modelo: @cf/meta/llama-3.1-8b-instruct (free tier do Workers AI).

import type { InterpretadorPort } from '../ports/interpretador';
import type { Intencao } from '../domain/tipos';

const MODELO = '@cf/meta/llama-3.1-8b-instruct';

export class AiInterpretadorAdapter implements InterpretadorPort {
  constructor(private ai: Ai) {}

  async interpretar(entrada: {
    mensagem: string;
    estadoAtual: string;
    contexto: { servicos: { id: number; nome: string }[] };
  }): Promise<Intencao> {
    const servicos = entrada.contexto.servicos
      .map((s) => `${s.id}. ${s.nome}`)
      .join('\n');

    const prompt = `Você interpreta mensagens de um agendador de WhatsApp.
Estado atual da conversa: ${entrada.estadoAtual}
Serviços disponíveis:
${servicos}

Mensagem do cliente: "${entrada.mensagem}"

Responda APENAS com JSON no formato:
{"intencao": "escolher_servico|escolher_dia|escolher_horario|confirmar|cancelar|desconhecida", "entidades": {"servico": "id ou null", "dia": "expressão ou null", "horario": "HH:MM ou null"}}

Regras:
- "escolher_servico": quando o cliente escolhe um serviço (número ou nome).
- "escolher_dia": quando escolhe um dia ("amanhã", "quarta", "dia 21").
- "escolher_horario": quando escolhe um horário ("14:30").
- "confirmar": "sim", "pode", "confirmo".
- "cancelar": "não", "cancelar", "desistir".
- Caso contrário: "desconhecida".`;

    const resposta = await this.ai.run(MODELO, {
      prompt,
      messages: [{ role: 'user', content: entrada.mensagem }],
    });

    // Extrair o JSON da resposta (o modelo pode envolver em texto)
    const texto = String((resposta as { response?: string }).response ?? '');
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { intencao: 'desconhecida', entidades: {} };

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Intencao;
      // Validar contra o schema — nunca confiar cegamente na saída do modelo
      const intencoesValidas = ['escolher_servico', 'escolher_dia', 'escolher_horario', 'confirmar', 'cancelar', 'desconhecida'];
      if (!intencoesValidas.includes(parsed.intencao)) {
        return { intencao: 'desconhecida', entidades: {} };
      }
      return {
        intencao: parsed.intencao,
        entidades: {
          servico: parsed.entidades?.servico ?? undefined,
          dia: parsed.entidades?.dia ?? undefined,
          horario: parsed.entidades?.horario ?? undefined,
        },
      };
    } catch {
      return { intencao: 'desconhecida', entidades: {} };
    }
  }
}