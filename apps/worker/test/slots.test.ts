// test/slots.test.ts
import { describe, expect, it } from 'vitest';
import { slotsLivres } from '../src/domain/slots';

// Relógio fixo: dia anterior à data dos cenários, fora da janela de antecedência.
const AGORA_FIXO = new Date('2026-10-18T00:00:00.000Z');

describe('slotsLivres', () => {
  it('gera slots de 45min dentro do intervalo de atendimento', () => {
    const slots = slotsLivres(
      [{ horaInicio: '09:00', horaFim: '10:30' }],
      [],
      45,
      '2026-10-19',
      0,
      AGORA_FIXO
    );
    expect(slots).toHaveLength(2);
    expect(slots[0].inicio).toBe('2026-10-19T09:00:00.000Z');
    expect(slots[1].inicio).toBe('2026-10-19T09:45:00.000Z');
  });

  it('remove slot que conflita com agendamento ocupado', () => {
    const slots = slotsLivres(
      [{ horaInicio: '09:00', horaFim: '10:30' }],
      [{ dataHoraInicio: '2026-10-19T09:00:00.000Z', dataHoraFim: '2026-10-19T09:45:00.000Z' }],
      45,
      '2026-10-19',
      0,
      AGORA_FIXO
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].inicio).toBe('2026-10-19T09:45:00.000Z');
  });

  it('respeita a antecedência mínima (D2)', () => {
    const agora = new Date('2026-10-19T09:30:00.000Z');
    const slots = slotsLivres(
      [{ horaInicio: '09:00', horaFim: '10:30' }],
      [],
      45,
      '2026-10-19',
      60,
      agora
    );
    expect(slots).toHaveLength(0);
  });
});