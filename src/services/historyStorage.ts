import { CharacterId, CHARACTERS } from '../types';

export interface HistoryVoiceItem {
  id: string;
  character: string;
  characterName: string;
  script: string;
  audioBase64: string;
  mimeType: string;
  format?: string;
  createdAt: number;
  formattedDate: string;
}

export interface SaveVoiceInput {
  character: string;
  script: string;
  audioBase64: string;
  mimeType?: string;
  format?: string;
}

const DB_NAME = 'playvear_voice_db';
const STORE_NAME = 'voices';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('bn-BD', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCharacterDisplayName(characterId: string): string {
  const found = CHARACTERS.find((c) => c.id === characterId);
  return found ? found.name : characterId;
}

export async function getAllVoicesFromDevice(): Promise<HistoryVoiceItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const items = (request.result as HistoryVoiceItem[]) || [];
        items.sort((a, b) => b.createdAt - a.createdAt);
        resolve(items);
      };
      request.onerror = () => {
        resolve(getFromLocalStorage());
      };
    });
  } catch {
    return getFromLocalStorage();
  }
}

function getFromLocalStorage(): HistoryVoiceItem[] {
  try {
    const data = localStorage.getItem('playvear_history_items');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(items: HistoryVoiceItem[]): void {
  try {
    localStorage.setItem('playvear_history_items', JSON.stringify(items.slice(0, 30)));
  } catch {
    // Ignore storage limit
  }
}

export async function saveVoiceToDevice(input: SaveVoiceInput): Promise<HistoryVoiceItem> {
  const now = Date.now();
  const newItem: HistoryVoiceItem = {
    id: `voice_${now}_${Math.random().toString(36).substring(2, 8)}`,
    character: input.character,
    characterName: getCharacterDisplayName(input.character),
    script: input.script,
    audioBase64: input.audioBase64,
    mimeType: input.mimeType || 'audio/mpeg',
    format: input.format || 'mp3',
    createdAt: now,
    formattedDate: formatDate(now),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(newItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    const items = getFromLocalStorage();
    saveToLocalStorage([newItem, ...items]);
  }

  return newItem;
}

export async function deleteVoiceFromDevice(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    const items = getFromLocalStorage().filter((item) => item.id !== id);
    saveToLocalStorage(items);
  }
}

export async function clearAllVoicesFromDevice(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    saveToLocalStorage([]);
  }
}

export async function downloadVoiceMP3(item: HistoryVoiceItem): Promise<void> {
  try {
    const byteCharacters = atob(item.audioBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: item.mimeType || 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = item.format === 'wav' ? 'wav' : 'mp3';
    a.download = `${item.character || 'voice'}_${item.id}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('Download error:', err);
  }
}
