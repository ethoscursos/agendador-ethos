// ports/interpretador.ts
// Contrato do port de interpretação de intenção — a IA transforma mensagem livre em intenção estruturada.
// Implementado pelo adaptador Workers AI (adapters/ai-interpretador.ts).
// Limite absoluto: a IA nunca grava agendamento — apenas interpreta e extrai (Seção 10 do RDA).

import type { Intencao } from '../domain/tipos';

export interface InterpretadorPort {
  interpretar(entrada: {
    mensagem: string;
    estadoAtual: string;
    contexto: { servicos: { id: number; nome: string }[] };
  }): Promise<Intencao>;
}