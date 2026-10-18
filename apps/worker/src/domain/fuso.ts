// domain/fuso.ts
// Fuso fixo do MVP — America/Sao_Paulo (decisão D-ET1-3).
// Helpers de conversão local→UTC usando Intl (API padrão, portável).
// Documentado para troca futura: ler o fuso do profissional no banco.

export const FUSO_PADRAO = 'America/Sao_Paulo';

export function agoraNoFuso(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: FUSO_PADRAO }));
}

// Offset (em minutos) do fuso em relação a UTC na data dada — via Intl, sem dependência.
function offsetMinutos(fuso: string, data: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const partes = Object.fromEntries(
    dtf.formatToParts(data).map((p) => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour) % 24,
    Number(partes.minute),
    Number(partes.second)
  );
  return (asUTC - data.getTime()) / 60_000;
}

// Converte 'YYYY-MM-DD' + 'HH:MM' (no fuso) em ISO-8601 UTC.
export function horarioParaUtc(dia: string, horario: string, fuso: string): string {
  const [h, m] = horario.split(':').map(Number);
  const [y, mo, d] = dia.split('-').map(Number);
  const local = new Date(Date.UTC(y, mo - 1, d, h, m));
  return new Date(local.getTime() - offsetMinutos(fuso, local) * 60_000).toISOString();
}

// Início do dia (00:00 no fuso) em ISO-8601 UTC.
export function inicioDoDiaUtc(dia: string, fuso: string): string {
  return horarioParaUtc(dia, '00:00', fuso);
}

// Início do dia seguinte em ISO-8601 UTC (fecha o TODO da Etapa 4).
export function inicioProximoDiaUtc(dia: string, fuso: string): string {
  const [y, mo, d] = dia.split('-').map(Number);
  const proximo = new Date(Date.UTC(y, mo - 1, d + 1));
  const diaStr = proximo.toISOString().slice(0, 10);
  return inicioDoDiaUtc(diaStr, fuso);
}