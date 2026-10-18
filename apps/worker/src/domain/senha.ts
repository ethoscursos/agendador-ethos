// domain/senha.ts
// Hash de senha com PBKDF2 via Web Crypto (API padrão, disponível no Workers).
// Sem dependência externa (bcrypt/argon2 não são nativos no Workers).
// Formato armazenado: pbkdf2$<iteracoes>$<salt_b64url>$<hash_b64url>

const encoder = new TextEncoder();
const ITERACOES = 100_000;
const TAMANHO_SALT = 16; // bytes
const TAMANHO_HASH = 32; // bytes (SHA-256)

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

export async function gerarHashSenha(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(TAMANHO_SALT));
  const chave = await crypto.subtle.importKey(
    'raw',
    encoder.encode(senha),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERACOES, hash: 'SHA-256' },
    chave,
    TAMANHO_HASH * 8
  );
  return `pbkdf2$${ITERACOES}$${base64url(salt)}$${base64url(new Uint8Array(bits))}`;
}

export async function verificarSenha(senha: string, hashArmazenado: string): Promise<boolean> {
  const [algo, iteracoesStr, saltB64, hashB64] = hashArmazenado.split('$');
  if (algo !== 'pbkdf2') return false;
  const iteracoes = Number(iteracoesStr);
  const salt = base64urlDecode(saltB64);
  const chave = await crypto.subtle.importKey(
    'raw',
    encoder.encode(senha),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iteracoes, hash: 'SHA-256' },
    chave,
    TAMANHO_HASH * 8
  );
  const hashCalculado = base64url(new Uint8Array(bits));
  return hashCalculado === hashB64;
}