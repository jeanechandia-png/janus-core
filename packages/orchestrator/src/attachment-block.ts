/**
 * Bloque de adjuntos dentro de la orden. Lo que va entre los marcadores son DATOS (archivos, códigos escaneados):
 * el planificador determinista decide solo con las palabras del usuario, que van antes del marcador.
 * Los marcadores deben coincidir con los de `packages/modules/chat-attachments/src/core.ts` (lo comprueba una prueba).
 */
export const ATTACHMENT_BLOCK_START = '⟦JANUS-ADJUNTOS-DATOS⟧';

export function userTextOutsideAttachmentBlock(command: string): string {
  const index = command.indexOf(ATTACHMENT_BLOCK_START);
  return index < 0 ? command : command.slice(0, index).trim();
}
