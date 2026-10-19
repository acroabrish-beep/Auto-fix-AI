import { databases } from '../../lib/appwrite/client';
import { Query } from 'appwrite';

export const DATABASE_ID = 'autofix-ai-db';

export const COLLECTIONS = {
  PROFILES: 'profiles',
  LEARNING_MODULES: 'learning_modules',
  LEARNING_PROGRESS: 'learning_progress',
  DIAGNOSTIC_SESSIONS: 'diagnostic_sessions',
  VEHICLE_PROFILES: 'vehicle_profiles',
  REPAIR_GUIDES: 'repair_guides',
  SERVICE_RECORDS: 'service_records',
};

export const databaseService = {
  async getDocument<T>(collectionId: string, documentId: string): Promise<T> {
    return await databases.getDocument(DATABASE_ID, collectionId, documentId) as T;
  },

  async listDocuments<T>(collectionId: string, queries: string[] = []): Promise<T[]> {
    const response = await databases.listDocuments(DATABASE_ID, collectionId, queries);
    return response.documents as T[];
  },

  async createDocument<T>(collectionId: string, data: any, permissions?: string[], documentId: string = 'unique()'): Promise<T> {
    return await databases.createDocument(DATABASE_ID, collectionId, documentId, data, permissions) as T;
  },

  async updateDocument<T>(collectionId: string, documentId: string, data: any, permissions?: string[]): Promise<T> {
    return await databases.updateDocument(DATABASE_ID, collectionId, documentId, data, permissions) as T;
  },

  async deleteDocument(collectionId: string, documentId: string) {
    return await databases.deleteDocument(DATABASE_ID, collectionId, documentId);
  }
};

export { Query };
