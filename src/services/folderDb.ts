const memoryHandles = new Map<string, FileSystemDirectoryHandle>();
const memorySnapshots: FileSnapshot[] = [];
let nextSnapshotId = 1;

export const initDB = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB tidak tersedia di lingkungan ini.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('local-chat-folders', 2);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const setHandle = async (key: string, handle: FileSystemDirectoryHandle) => {
  if (typeof indexedDB === 'undefined') {
    memoryHandles.set(key, handle);
    return;
  }
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    const store = tx.objectStore('handles');
    const req = store.put(handle, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getHandle = async (key: string): Promise<FileSystemDirectoryHandle | null> => {
  if (typeof indexedDB === 'undefined') {
    return memoryHandles.get(key) || null;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const store = tx.objectStore('handles');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
};

export const removeHandle = async (key: string): Promise<void> => {
  if (typeof indexedDB === 'undefined') {
    memoryHandles.delete(key);
    return;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    const store = tx.objectStore('handles');
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export interface FileSnapshot {
  id?: number;
  path: string;
  content: string | null; // null means file didn't exist
  timestamp: number;
}

export const saveSnapshot = async (snapshot: Omit<FileSnapshot, 'id'>): Promise<number> => {
  if (typeof indexedDB === 'undefined') {
    const id = nextSnapshotId++;
    memorySnapshots.push({ ...snapshot, id });
    return id;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', 'readwrite');
    const store = tx.objectStore('snapshots');
    
    // Optional: enforce a limit of e.g. 50 snapshots
    const req = store.add(snapshot);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
};

export const getSnapshot = async (id: number): Promise<FileSnapshot | null> => {
  if (typeof indexedDB === 'undefined') {
    return memorySnapshots.find((s) => s.id === id) || null;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', 'readonly');
    const store = tx.objectStore('snapshots');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
};

export const clearSnapshots = async (): Promise<void> => {
  if (typeof indexedDB === 'undefined') {
    memorySnapshots.length = 0;
    return;
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', 'readwrite');
    const store = tx.objectStore('snapshots');
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};
