// domain/dias.ts
// Resolução de expressões de dia ("amanhã", "quarta", "dia 21", "2026-10-21") para 'YYYY-MM-DD'
// no fuso America/Sao_Paulo (D-ET1-3). TypeScript PURO.

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function formatarDia(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function resolverDia(expressao: string, agora: Date, fuso: string): string | null {
  const e = expressao.trim().toLowerCase().replace('feira', '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(e)) return e;
  if (e === 'hoje') return formatarDia(agora);
  if (e === 'amanha' || e === 'amanhã') return formatarDia(addDias(agora, 1));

  const diaMes = e.match(/^dia\s+(\d{1,2})$/);
  if (diaMes) {
    const alvo = parseInt(diaMes[1], 10);
    const candidato = new Date(agora.getFullYear(), agora.getMonth(), alvo);
    if (candidato.getTime() >= agora.getTime()) return formatarDia(candidato);
    return formatarDia(new Date(agora.getFullYear(), agora.getMonth() + 1, alvo));
  }

  const idx = DIAS_SEMANA.findIndex((d) => e.startsWith(d));
  if (idx >= 0) {
    let diff = (idx - agora.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // próximo dia da semana, não hoje
    return formatarDia(addDias(agora, diff));
  }

  return null;
}