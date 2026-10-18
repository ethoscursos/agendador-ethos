// ports/mensageiro.ts
// Contrato do port de mensageria — o cérebro conversa com "um serviço de mensageria",
// nunca com a Evolution API nem com a Zenvia diretamente (Seção 6 do RDA).
// Implementado pelo adaptador de fila (adapters/queue-mensageiro.ts) + consumer HTTP (adapters/http-mensageiro.ts).

export interface MensagemTexto {
  para: string; // telefone E.164 do destinatário
  texto: string;
}

export interface MensageiroPort {
  enviarTexto(mensagem: MensagemTexto): Promise<void>;
}