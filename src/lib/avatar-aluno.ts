export const EMOJIS_ALUNO = ["😊", "😎", "🤓", "🚀", "🌟", "🦁", "🐱", "🐼"];
export const LIMITE_AVATAR = 400000;
export function fotoAvatarValida(valor: string): boolean {
  return valor.length < LIMITE_AVATAR && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(valor);
}
export function avatarValido(valor: unknown): valor is string {
  return typeof valor === "string" && (valor === "" || EMOJIS_ALUNO.includes(valor) || fotoAvatarValida(valor));
}
