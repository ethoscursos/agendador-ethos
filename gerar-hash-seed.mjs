// gerar-hash-seed.mjs — gera o hash PBKDF2 no formato do projeto (domain/senha.ts)
import { webcrypto } from 'node:crypto';

const crypto = webcrypto;
const encoder = new TextEncoder();
const ITERACOES = 100_000;
const TAMANHO_SALT = 16;
const TAMANHO_HASH = 32;

function base64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

const senha = process.argv[2] ?? 'Ekaa@2024';

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

console.log(`pbkdf2$${ITERACOES}$${base64url(salt)}$${base64url(new Uint8Array(bits))}`);