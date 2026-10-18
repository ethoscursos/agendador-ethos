// domain/sessao.ts
// Sessão por cookie HttpOnly assinado — HMAC SHA-256 via Web Crypto (D-ET1-5).
// TypeScript PURO: Web Crypto é API padrão (disponível no Workers e no navegador),
// não é dependência Cloudflare. Sem JWT, sem biblioteca externa.

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function chaveHmac(segredo: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface Sessao {
  profissionalId: number;
  exp: number; // timestamp (ms)
}

export async function criarSessao(
  profissionalId: number,
  segredo: string,
  expiraEmMinutos: number
): Promise<string> {
  const payload: Sessao = {
    profissionalId,
    exp: Date.now() + expiraEmMinutos * 60_000,
  };
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const key = await chaveHmac(segredo);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  return `${payloadB64}.${base64url(new Uint8Array(sig))}`;
}

export async function validarSessao(token: string, segredo: string): Promise<Sessao | null> {
  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return null;

  const key = await chaveHmac(segredo);
  const valido = await crypto.subtle.verify(
    'HMAC',
    key,
    base64urlDecode(sigB64),
    encoder.encode(payloadB64)
  );
  if (!valido) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as Sessao;
    if (!payload.profissionalId || typeof payload.exp !== 'number') return null;
    if (payload.exp < Date.now()) return null; // expirada
    return payload;
  } catch {
    return null;
  }
}