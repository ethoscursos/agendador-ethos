// handlers/queue.ts
// Consumer da fila envio-mensagens — envia a mensagem para a Evolution API.
// O payload exato da Evolution API é contrato do Expert WhatsApp (Seção 13 do RDA).

import type { MensagemTexto } from '../ports/mensageiro';
import type { Env } from '../env';

export async function processarFila(
  batch: MessageBatch<MensagemTexto>,
  env: Env
): Promise<void> {
  for (const mensagem of batch.messages) {
    const { para, texto } = mensagem.body;
    // TODO (contrato WhatsApp): montar o payload da Evolution API (sendText)
    // e chamar env.EVOLUTION_API_URL com a chave da instância.
    // Por ora, apenas registra o processamento (log estruturado).
    console.log('enviar', { para, texto });
  }
}