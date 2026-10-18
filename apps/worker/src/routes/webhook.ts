// routes/webhook.ts — POST /webhook (entrada de mensagens da Evolution API)
// Stub da Etapa 2: a integração completa é do Expert WhatsApp (Seção 13 do RDA).

import { Hono } from 'hono';

export const webhookRoutes = new Hono();

webhookRoutes.post('/', (c) => {
  // TODO (Etapa 4): receber payload da Evolution, extrair profissional_id e telefone_cliente,
  // ler estado do KV e rodar a máquina de estados.
  return c.json({ recebido: true }, 200);
});