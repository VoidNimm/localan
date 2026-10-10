import { useState, useEffect, useCallback } from 'react';
import { fileStorage, type DirectoryReference } from '../adapters/storage';

export const notifyFolderChanged = (key: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('local-chat-folder-changed', { detail: { key } }));
  }
};

export function useFolder(projectId?: string) {
  const [folder, setFolder] = useState<DirectoryReference | null>(null);
  const [permissionState, setPermissionState] = useState<
    'granted' | 'prompt' | 'denied' | 'unknown'
  >('unknown');
  const key = projectId ? `folder_${projectId}` : 'global_folder';

  const checkPermission = useCallback(async (dir: DirectoryReference) => {
    try {
      const state = await fileStorage.checkPermission(dir, 'readwrite');
      setPermissionState(state);
      return state;
    } catch {
      setPermissionState('unknown');
      return 'unknown';
    }
  }, []);

  const reloadFolder = useCallback(() => {
    fileStorage
      .getDirectory(key)
      .then(async (dir) => {
        if (dir) {
          setFolder(dir);
          await checkPermission(dir);
        } else {
          setFolder(null);
          setPermissionState('unknown');
        }
      })
      .catch((e) => console.error(e));
  }, [key, checkPermission]);

  useEffect(() => {
    reloadFolder();
  }, [reloadFolder]);

  useEffect(() => {
    const handleFolderChanged = (e: any) => {
      if (!e.detail?.key || e.detail.key === key) {
        reloadFolder();
      }
    };
    window.addEventListener('local-chat-folder-changed', handleFolderChanged);
    return () => window.removeEventListener('local-chat-folder-changed', handleFolderChanged);
  }, [key, reloadFolder]);

  const selectFolder = async () => {
    if (!fileStorage.isSupported()) {
      alert(
        'Platform/browser Anda tidak mendukung pemilihan direktori langsung.'
      );
      return;
    }
    try {
      const dirRef = await fileStorage.pickDirectory(key);
      if (!dirRef) return;

      const folderMode =
        localStorage.getItem(`folderMode_${projectId || 'global'}`) || 'ask';

      if (folderMode === 'ask') {
        try {
          const perm = await fileStorage.requestPermission(dirRef, 'readwrite');
          setPermissionState(perm);
        } catch (e) {
          console.warn('Could not request readwrite permission during folder selection:', e);
        }
      } else {
        await checkPermission(dirRef);
      }

      setFolder(dirRef);
      notifyFolderChanged(key);
    } catch (e: any) {
      console.warn('User cancelled or error selecting folder', e);
    }
  };

  const requestWritePermission = async (): Promise<boolean> => {
    if (!folder) return false;
    try {
      const perm = await fileStorage.requestPermission(folder, 'readwrite');
      setPermissionState(perm);
      notifyFolderChanged(key);
      return perm === 'granted';
    } catch (e) {
      console.warn('Write permission request failed:', e);
      setPermissionState('denied');
      return false;
    }
  };

  const clearFolder = async () => {
    await fileStorage.removeDirectory(key);
    setFolder(null);
    setPermissionState('unknown');
    notifyFolderChanged(key);
  };

  return {
    folder,
    handle: folder, // alias backward-compat
    selectFolder,
    clearFolder,
    permissionState,
    requestWritePermission,
    checkPermission,
    reloadFolder,
    reloadHandle: reloadFolder,
  };
}
