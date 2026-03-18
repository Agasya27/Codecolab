import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Operation } from '../ot/operations';

interface CollabDB extends DBSchema {
  files: {
    key: string;
    value: {
      id: string;
      name: string;
      content: string;
      language: string;
      lastModified: number;
      revision: number;
    };
  };
  pendingOps: {
    key: number;
    value: {
      id?: number;
      fileId: string;
      op: Operation;
    };
    indexes: { 'by-file': string };
  };
  snapshots: {
    key: [string, number];
    value: {
      fileId: string;
      timestamp: number;
      content: string;
      revision: number;
      label: string;
    };
    indexes: { 'by-file': string };
  };
}

let dbPromise: Promise<IDBPDatabase<CollabDB>>;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<CollabDB>('collab-editor-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pendingOps')) {
          const opsStore = db.createObjectStore('pendingOps', { keyPath: 'id', autoIncrement: true });
          opsStore.createIndex('by-file', 'fileId');
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapStore = db.createObjectStore('snapshots', { keyPath: ['fileId', 'timestamp'] });
          snapStore.createIndex('by-file', 'fileId');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveFile(file: any) {
  const db = await initDB();
  await db.put('files', file);
}

export async function getFile(id: string) {
  const db = await initDB();
  return db.get('files', id);
}

export async function getAllFiles() {
  const db = await initDB();
  return db.getAll('files');
}

export async function deleteFileDB(id: string) {
  const db = await initDB();
  await db.delete('files', id);
}

export async function savePendingOp(fileId: string, op: Operation) {
  const db = await initDB();
  await db.add('pendingOps', { fileId, op });
}

export async function getPendingOps(fileId: string) {
  const db = await initDB();
  const ops = await db.getAllFromIndex('pendingOps', 'by-file', fileId);
  return ops;
}

export async function clearPendingOps(fileId: string) {
  const db = await initDB();
  const tx = db.transaction('pendingOps', 'readwrite');
  const index = tx.store.index('by-file');
  let cursor = await index.openCursor(fileId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function saveSnapshot(snapshot: any) {
  const db = await initDB();
  await db.put('snapshots', snapshot);
}

export async function getSnapshots(fileId: string) {
  const db = await initDB();
  return db.getAllFromIndex('snapshots', 'by-file', fileId);
}
