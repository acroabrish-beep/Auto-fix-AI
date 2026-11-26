import { Permission, Role } from 'appwrite';
import {
  account,
  ID,
  Query,
  tablesDB,
  DATABASE_ID,
  LAB_ATTEMPTS_TABLE_ID,
} from '../../lib/appwrite';
import type { LabAttempt, LabAttemptInput } from '../../types';

const OFFLINE_KEY = 'autofix_ai_lab_attempts_v1';

function readOfflineAttempts(): LabAttemptInput[] {
  try {
    if (typeof localStorage === 'undefined') return [];

    const raw = localStorage.getItem(OFFLINE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as LabAttemptInput[] : [];
  } catch {
    return [];
  }
}

function saveOfflineAttempt(attempt: LabAttemptInput): void {
  const attempts = readOfflineAttempts();

  try {
    if (typeof localStorage === 'undefined') {
      throw new Error('Local storage is unavailable.');
    }

    attempts.push(attempt);
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(attempts));
  } catch (error) {
    console.error('Could not save offline lab attempt:', error);
    throw error;
  }
}

function buildProgress(
  attempts: Array<LabAttempt | LabAttemptInput>,
  offline: boolean,
) {
  return {
    attempts,
    completed: attempts.length,
    bestScore: attempts.reduce(
      (best, attempt) => Math.max(best, attempt.score),
      0,
    ),
    passed: attempts.some((attempt) => attempt.passed),
    offline,
  };
}

export const labService = {
  async saveLabAttempt(attempt: LabAttemptInput): Promise<{
    saved: boolean;
    offline: boolean;
    row?: LabAttempt;
  }> {
    if (!attempt.userId || !attempt.moduleId || !attempt.exerciseId) {
      throw new Error('A signed-in user, module ID, and exercise ID are required.');
    }

    // Verify the actual Appwrite session before writing online.
    let currentUser;

    try {
      currentUser = await account.get();
    } catch (error) {
      console.warn('Appwrite session unavailable; saving attempt locally.', error);
      saveOfflineAttempt(attempt);
      return { saved: true, offline: true };
    }

    // Never allow the supplied user ID to differ from the authenticated account.
    if (currentUser.$id !== attempt.userId) {
      throw new Error('The lab attempt user does not match the signed-in account.');
    }

    try {
      const row = await tablesDB.createRow<LabAttempt>({
        databaseId: DATABASE_ID,
        tableId: LAB_ATTEMPTS_TABLE_ID,
        rowId: ID.unique(),
        data: attempt,
        // Each attempt is readable only by its authenticated owner.
        permissions: [
          Permission.read(Role.user(currentUser.$id)),
        ],
      });

      return { saved: true, offline: false, row };
    } catch (error) {
      console.warn('Appwrite lab save failed; keeping this attempt locally.', error);
      saveOfflineAttempt(attempt);
      return { saved: true, offline: true };
    }
  },

  async getModuleLabProgress(
    userId: string,
    moduleId: string,
  ): Promise<{
    attempts: Array<LabAttempt | LabAttemptInput>;
    completed: number;
    bestScore: number;
    passed: boolean;
    offline: boolean;
  }> {
    if (!userId || !moduleId) {
      return buildProgress([], true);
    }

    let currentUser;

    try {
      currentUser = await account.get();
    } catch (error) {
      console.warn('Appwrite session unavailable; reading local lab progress.', error);

      const localAttempts = readOfflineAttempts().filter(
        (attempt) => attempt.userId === userId && attempt.moduleId === moduleId,
      );

      return buildProgress(localAttempts, true);
    }

    // Prevent one signed-in account from requesting another account's progress.
    if (currentUser.$id !== userId) {
      console.warn('Rejected lab progress request for a different user.');
      return buildProgress([], true);
    }

    let onlineAttempts: LabAttempt[] = [];
    let offline = false;

    try {
      const response = await tablesDB.listRows<LabAttempt>({
        databaseId: DATABASE_ID,
        tableId: LAB_ATTEMPTS_TABLE_ID,
        queries: [
          Query.equal('userId', currentUser.$id),
          Query.equal('moduleId', moduleId),
          Query.orderDesc('completedAt'),
          Query.limit(100),
        ],
        ttl: 0,
      });

      onlineAttempts = response.rows;
    } catch (error) {
      console.warn('Could not load Appwrite lab progress; using local attempts.', error);
      offline = true;
    }

    const localAttempts = readOfflineAttempts().filter(
      (attempt) => attempt.userId === currentUser.$id && attempt.moduleId === moduleId,
    );

    return buildProgress([...onlineAttempts, ...localAttempts], offline);
  },

  getOfflineAttempts(): LabAttemptInput[] {
    return readOfflineAttempts();
  },
};
