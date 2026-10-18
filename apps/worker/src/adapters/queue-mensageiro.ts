// adapters/queue-mensageiro.ts
// Implementação do port de mensageiro sobre a fila (envio assíncrono).
// O webhook envia para a fila; o consumer (handlers/queue.ts) chama a Evolution API.

import type { MensageiroPort, MensagemTexto } from '../ports/mensageiro';

export class QueueMensageiroAdapter implements MensageiroPort {
  constructor(private fila: Queue) {}

  async enviarTexto(mensagem: MensagemTexto): Promise<void> {
    await this.fila.send(mensagem);
  }
}