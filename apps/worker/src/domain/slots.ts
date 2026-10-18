// domain/slots.ts
// Geração de slots livres — algoritmo do retorno do Expert Banco de Dados v1.2.
// Q1 (horários do dia) + Q2 (ocupados) → slots livres. TypeScript PURO, portável.

export interface Intervalo {
  horaInicio: string; // 'HH:MM' 24h
  horaFim: string; // 'HH:MM' 24h
}

export interface Ocupado {
  dataHoraInicio: string; // ISO-8601 UTC
  dataHoraFim: string; // ISO-8601 UTC
}

export interface Slot {
  inicio: string; // ISO-8601 UTC
  fim: string; // ISO-8601 UTC
}

export function slotsLivres(
  intervalos: Intervalo[],
  ocupados: Ocupado[],
  duracaoMinutos: number,
  dia: string, // 'YYYY-MM-DD' no fuso America/Sao_Paulo
  antecedenciaMinimaMinutos = 0,
  agora = new Date()
): Slot[] {
  const slots: Slot[] = [];
  for (const iv of intervalos) {
    let inicio = new Date(`${dia}T${iv.horaInicio}Z`);
    const fimIntervalo = new Date(`${dia}T${iv.horaFim}Z`);
    while (inicio.getTime() + duracaoMinutos * 60_000 <= fimIntervalo.getTime()) {
      const fim = new Date(inicio.getTime() + duracaoMinutos * 60_000);
      const conflita = ocupados.some(
        (o) => new Date(o.dataHoraInicio) < fim && new Date(o.dataHoraFim) > inicio
      );
      const antesDaAntecedencia =
        inicio.getTime() < agora.getTime() + antecedenciaMinimaMinutos * 60_000;
      if (!conflita && !antesDaAntecedencia) {
        slots.push({ inicio: inicio.toISOString(), fim: fim.toISOString() });
      }
      inicio = fim;
    }
  }
  return slots;
}