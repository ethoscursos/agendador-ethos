// domain/fuso.ts
// Fuso fixo do MVP — America/Sao_Paulo (decisão D-ET1-3).
// O schema do profissional não tem campo timezone e o DDL não pode ser alterado.
// Documentado para troca futura: ler o fuso do profissional no banco.

export const FUSO_PADRAO = 'America/Sao_Paulo';

export function agoraNoFuso(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: FUSO_PADRAO }));
}