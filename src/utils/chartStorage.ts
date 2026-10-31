import { ChartSession } from '../types';

const CHART_SESSIONS_STORAGE_KEY = 'capcut_autoeditor_chart_sessions';

export function loadChartSessions(): ChartSession[] {
  try {
    const raw = localStorage.getItem(CHART_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    }
    return [];
  } catch (error) {
    console.warn('Failed to load chart sessions from localStorage', error);
    return [];
  }
}

export function saveChartSessions(sessions: ChartSession[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const trimmed = sessions.slice(0, 20);
    localStorage.setItem(CHART_SESSIONS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    try {
      const minimal = sessions.slice(0, 5);
      localStorage.setItem(CHART_SESSIONS_STORAGE_KEY, JSON.stringify(minimal));
    } catch {
      // Graceful fallback without throwing or logging error
    }
  }
}

export function saveChartSession(session: ChartSession): void {
  try {
    const sessions = loadChartSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = { ...session, updatedAt: Date.now() };
    } else {
      sessions.unshift({ ...session, updatedAt: Date.now() });
    }
    saveChartSessions(sessions);
  } catch (error) {
    console.warn('Failed to save single chart session', error);
  }
}

export function deleteChartSession(sessionId: string): void {
  try {
    const sessions = loadChartSessions().filter((s) => s.id !== sessionId);
    saveChartSessions(sessions);
  } catch (error) {
    console.warn('Failed to delete chart session', error);
  }
}
