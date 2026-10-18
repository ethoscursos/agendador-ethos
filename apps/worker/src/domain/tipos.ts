// domain/tipos.ts
// Tipos do domínio — TypeScript PURO, sem nenhuma importação da Cloudflare (ports and adapters).

// Estados da máquina de estados (Seção 10 do RDA v18) — NÃO inventar estados novos.
export const ESTADOS = [
  'AGUARDANDO_INICIO',
  'SELECAO_SERVICO',
  'SELECAO_DIA',
  'SELECAO_HORARIO',
  'CONFIRMACAO',
  'CONCLUIDO',
  'CANCELADO',
  'TIMEOUT',
] as const;

export type EstadoConversa = (typeof ESTADOS)[number];

// Intenção estruturada produzida pela IA (Seção 10)
export interface Intencao {
  intencao:
    | 'escolher_servico'
    | 'escolher_dia'
    | 'escolher_horario'
    | 'confirmar'
    | 'cancelar'
    | 'desconhecida';
  entidades: {
    servico?: string;
    dia?: string;
    horario?: string;
  };
}

// Estado persistido no KV (chave composta profissional_id:telefone_cliente)
export interface Conversa {
  estadoAtual: EstadoConversa;
  contexto: {
    servicoSelecionado?: number;
    diaSelecionado?: string; // data ISO-8601
    horarioSelecionado?: string; // ISO-8601 UTC
  };
  atualizadoEm: string; // ISO-8601 UTC
}