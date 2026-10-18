// domain/regras.ts
// Regras parametrizadas (pendências D2/S4 do retorno v1.2) — entram por parâmetro no domínio,
// SEM alterar o SQL. Valores default do MVP; podem vir de variáveis de ambiente no futuro.

export interface RegrasAgendamento {
  antecedenciaMinimaMinutos: number; // D2 — antecedência mínima (0 = sem restrição no MVP)
  timeoutMinutos: number; // Timeout da conversa (10 min — Seção 10)
  permitirMultiplosIntervalos: boolean; // S4 — múltiplos intervalos por dia da semana
}

export const REGRAS_PADRAO: RegrasAgendamento = {
  antecedenciaMinimaMinutos: 0,
  timeoutMinutos: 10,
  permitirMultiplosIntervalos: true,
};