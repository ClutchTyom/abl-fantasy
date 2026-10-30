// Автовход в Telegram Mini App асинхронный: страницы, которые сразу
// редиректят гостя на /login (например /team), должны дождаться его
// результата, иначе пользователь застревает на экране входа.

let resolveDone: () => void = () => {};
const done = new Promise<void>((resolve) => {
  resolveDone = resolve;
});

export function finishMiniAppAuth() {
  resolveDone();
}

// Telegram добавляет параметры запуска в hash при открытии Mini App, а SDK
// сохраняет их в sessionStorage — оба признака доступны до загрузки SDK.
export function isTelegramLaunch(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.location.hash.includes("tgWebAppData") ||
      window.sessionStorage.getItem("__telegram__initParams") !== null
    );
  } catch {
    return window.location.hash.includes("tgWebAppData");
  }
}

export function waitForMiniAppAuth(timeoutMs = 8000): Promise<void> {
  return Promise.race([
    done,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
