// Имя, под которым в общем рейтинге показывается участник, не давший
// отдельного согласия на распространение никнейма (раздел 4 политики).
export const HIDDEN_PLAYER_NAME = "Скрытый игрок";

export function publicDisplayName(
  username: string | null | undefined,
  hasRatingConsent: boolean
): string {
  const name = username?.trim();
  return hasRatingConsent && name ? name : HIDDEN_PLAYER_NAME;
}
