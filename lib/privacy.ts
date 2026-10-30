// Дата текущей редакции политики конфиденциальности. Согласие, данное до
// этой даты, считается устаревшим: пользователь увидит окно согласия снова.
// Менять только при существенном изменении политики.
export const PRIVACY_POLICY_VERSION_DATE = "2026-10-30T00:00:00Z";
export const PRIVACY_POLICY_VERSION_LABEL = "30.10.2026";

export function hasValidPrivacyConsent(consentAt: string | null): boolean {
  if (!consentAt) return false;
  const given = new Date(consentAt).getTime();
  return (
    Number.isFinite(given) &&
    given >= new Date(PRIVACY_POLICY_VERSION_DATE).getTime()
  );
}
