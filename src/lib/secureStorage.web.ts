/** Web: the browser's localStorage (per-origin). */
export const secureAdapter = {
  async getItem(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  async setItem(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} },
  async removeItem(k: string) { try { localStorage.removeItem(k); } catch {} },
};
