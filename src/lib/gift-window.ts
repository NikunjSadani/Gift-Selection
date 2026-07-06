export const CHANGE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

export function isChangeWindowExpired(clockStart: string | Date): boolean {
  return Date.now() - new Date(clockStart).getTime() >= CHANGE_WINDOW_MS;
}
