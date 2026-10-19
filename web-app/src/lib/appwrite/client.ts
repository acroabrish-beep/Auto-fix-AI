import { Client, Account, Databases, Storage } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;

if (!endpoint || !projectId) {
  console.warn('Appwrite configuration missing. Check your .env file.');
}

export const client = new Client()
  .setEndpoint(endpoint || 'https://placeholder.appwrite.io/v1')
  .setProject(projectId || 'placeholder');

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export { ID } from 'appwrite';
