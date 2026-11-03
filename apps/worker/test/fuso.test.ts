import { describe, expect, it } from 'vitest';
import {
  diaNoFuso,
  horarioParaUtc,
  inicioDoDiaUtc,
  inicioProximoDiaUtc,
  proximoDia,
} from '../src/domain/fuso';

describe('fuso', () => {
  const fuso = 'America/Sao_Paulo';

  it('converte horário local para UTC', () => {
    expect(horarioParaUtc('2026-11-02', '09:30', fuso)).toBe('2026-11-02T12:30:00.000Z');
  });

  it('calcula as fronteiras do dia no fuso', () => {
    expect(inicioDoDiaUtc('2026-11-02', fuso)).toBe('2026-11-02T03:00:00.000Z');
    expect(inicioProximoDiaUtc('2026-11-02', fuso)).toBe('2026-11-03T03:00:00.000Z');
  });

  it('resolve o dia local perto da virada UTC', () => {
    const instante = new Date('2026-11-03T02:30:00.000Z');
    expect(diaNoFuso(instante, fuso)).toBe('2026-11-02');
    expect(proximoDia('2026-11-02')).toBe('2026-11-03');
  });
});
