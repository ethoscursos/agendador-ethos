// adapters/ai-interpretador.ts
// Implementação do port de interpretação sobre o Workers AI.
// A IA NUNCA grava agendamento — apenas interpreta a mensagem e extrai a intenção (Seção 10).

import type { InterpretadorPort } from '../ports/interpretador';
import type { Intencao } from '../domain/tipos';

export class AiInterpretadorAdapter implements InterpretadorPort {
  constructor(private ai: Ai) {}

  async interpretar(entrada: {
    mensagem: string;
    estadoAtual: string;
    contexto: { servicos: { id: number; nome: string }[] };
  }): Promise<Intencao> {
    // TODO (Etapa 7): chamar o Workers AI com um prompt de interpretação
    // (ex.: @cf/meta/llama-3.1-8b-instruct) e validar a saída contra o schema Intencao.
    // Por ora, retorna intenção desconhecida — o fluxo continua testável.
    return { intencao: 'desconhecida', entidades: {} };
  }
}