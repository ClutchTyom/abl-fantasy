// Предохранитель для автоархивации после недельного синка. Архивация
// обратима, но тихий архив половины базы из-за сбоя ABL не должен
// происходить сам: при ошибках синка или подозрительно большом объёме
// крон ничего не архивирует и сообщает причину в ответе.

export const AUTO_ARCHIVE_MAX_SHARE = 0.25;

export type ArchiveCounts = { teams: number; players: number };

export type AutoArchiveDecision =
  | { archive: true }
  | { archive: false; reason: string };

export function decideAutoArchive(input: {
  syncErrors: number;
  toArchive: ArchiveCounts;
  active: ArchiveCounts;
}): AutoArchiveDecision {
  const { syncErrors, toArchive, active } = input;

  if (syncErrors > 0) {
    return {
      archive: false,
      reason: `синхронизация завершилась с ошибками (${syncErrors}), архивацию пропускаем`,
    };
  }

  if (toArchive.teams === 0 && toArchive.players === 0) {
    return { archive: false, reason: "архивировать нечего" };
  }

  if (active.teams === 0 || active.players === 0) {
    return { archive: false, reason: "нет активных записей для сравнения" };
  }

  const teamsShare = toArchive.teams / active.teams;
  const playersShare = toArchive.players / active.players;

  if (teamsShare > AUTO_ARCHIVE_MAX_SHARE || playersShare > AUTO_ARCHIVE_MAX_SHARE) {
    return {
      archive: false,
      reason: `под архив попадает слишком много (команд ${toArchive.teams} из ${active.teams}, игроков ${toArchive.players} из ${active.players}) — проверьте и запустите вручную в админке`,
    };
  }

  return { archive: true };
}
