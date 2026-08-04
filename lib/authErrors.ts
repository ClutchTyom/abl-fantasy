// Supabase возвращает сообщения об ошибках авторизации на английском —
// переводим самые частые, чтобы не ломать русскоязычный интерфейс.
const KNOWN_ERRORS: { match: string; message: string }[] = [
  {
    match: "email not confirmed",
    message: "Подтвердите email по ссылке из письма, прежде чем входить.",
  },
  {
    match: "invalid login credentials",
    message: "Неверный email или пароль.",
  },
  {
    match: "user already registered",
    message: "Этот email уже зарегистрирован — попробуйте войти.",
  },
  {
    match: "password should be at least",
    message: "Пароль слишком короткий — минимум 6 символов.",
  },
];

export function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  const known = KNOWN_ERRORS.find((e) => lower.includes(e.match));
  return known?.message ?? message;
}
