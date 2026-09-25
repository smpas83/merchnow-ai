import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = '@merchnow_offline_queue';
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30000;
const MAX_RETRY_ATTEMPTS = 5;

export type QueueAction =
  | { actionType: 'task_complete'; taskId: string; jobId: string; notes?: string }
  | { actionType: 'proof_metadata'; jobId: string; taskId?: string; type: string; caption?: string }
  | { actionType: 'checkin'; jobId: string; latitude: number; longitude: number; accuracy?: number }
  | { actionType: 'notes'; jobId: string; content: string };

export type QueueEntry = {
  id: string;
  action: QueueAction;
  idempotencyKey: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  createdAt: string;
  lastAttempt?: string;
  errorMessage?: string;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateIdempotencyKey(action: QueueAction): string {
  return `${action.actionType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getQueue(): Promise<QueueEntry[]> {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveQueue(queue: QueueEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function addAction(action: QueueAction): Promise<QueueEntry> {
  const queue = await getQueue();
  const entry: QueueEntry = {
    id: generateId(),
    action,
    idempotencyKey: generateIdempotencyKey(action),
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  queue.push(entry);
  await saveQueue(queue);
  scheduleSync();
  return entry;
}

async function markStatus(id: string, status: QueueEntry['status'], errorMessage?: string): Promise<void> {
  const queue = await getQueue();
  const entry = queue.find(e => e.id === id);
  if (entry) {
    entry.status = status;
    if (status === 'failed') entry.errorMessage = errorMessage;
    if (status !== 'pending') entry.lastAttempt = new Date().toISOString();
    await saveQueue(queue);
  }
}

function calculateBackoff(retryCount: number): number {
  const backoff = Math.min(RETRY_BASE_MS * Math.pow(2, retryCount), RETRY_MAX_MS);
  return backoff + Math.random() * 1000;
}

async function isOnline(): Promise<boolean> {
  const netInfo = await NetInfo.fetch();
  return (netInfo.isConnected ?? false) && (netInfo.isInternetReachable ?? true) !== false;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export async function scheduleSync(): Promise<void> {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => processQueue(), 2000);
}

export async function processQueue(): Promise<void> {
  if (!(await isOnline())) return;

  const queue = await getQueue();
  const pending = queue.filter(e => e.status === 'pending' || (e.status === 'failed' && e.retryCount < MAX_RETRY_ATTEMPTS));

  if (pending.length === 0) return;

  for (const entry of pending) {
    await markStatus(entry.id, 'syncing');
  }

  const synced: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const entry of pending) {
    try {
      await syncAction(entry.action);
      synced.push(entry.id);
    } catch (error: any) {
      failed.push({ id: entry.id, error: error.message || 'Unknown error' });
    }
  }

  const newQueue = await getQueue();
  for (const id of synced) {
    const entry = newQueue.find(e => e.id === id);
    if (entry) {
      entry.status = 'synced';
      entry.lastAttempt = new Date().toISOString();
    }
  }
  for (const fail of failed) {
    const entry = newQueue.find(e => e.id === fail.id);
    if (entry) {
      entry.status = 'failed';
      entry.errorMessage = fail.error;
      entry.retryCount += 1;
      entry.lastAttempt = new Date().toISOString();
      if (entry.retryCount < MAX_RETRY_ATTEMPTS) {
        const backoff = calculateBackoff(entry.retryCount);
        setTimeout(() => processQueue(), backoff);
      }
    }
  }

  await saveQueue(newQueue);
}

async function syncAction(action: QueueAction): Promise<void> {
  const baseUrl = 'https://merchnow.example.com/api';
  const token = await AsyncStorage.getItem('@merchnow_auth_token');
  if (!token) throw new Error('No auth token');

  switch (action.actionType) {
    case 'task_complete': {
      const res = await fetch(`${baseUrl}/tasks/${action.taskId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: action.notes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      break;
    }
    case 'proof_metadata': {
      const res = await fetch(`${baseUrl}/proof`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: action.jobId, taskId: action.taskId, type: action.type, caption: action.caption }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      break;
    }
    case 'checkin': {
      const res = await fetch(`${baseUrl}/jobs/${action.jobId}/checkin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: action.latitude, longitude: action.longitude, accuracy: action.accuracy }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      break;
    }
    case 'notes': {
      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: action.jobId, content: action.content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      break;
    }
  }
}

export function useOfflineQueue() {
  const [queue, setQueue] = React.useState<QueueEntry[]>([]);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isOnlineState, setIsOnlineState] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      const q = await getQueue();
      if (mounted) setQueue(q);
    }
    load();

    const unsubNet = NetInfo.addEventListener(state => {
      if (mounted) {
        const online = (state.isConnected ?? false) && (state.isInternetReachable ?? true) !== false;
        setIsOnlineState(online);
        if (online) {
          scheduleSync();
        }
      }
    });

    return () => { mounted = false; unsubNet(); };
  }, []);

  const add = async (action: QueueAction) => {
    const entry = await addAction(action);
    setQueue(prev => [...prev, entry]);
    return entry;
  };

  const retryFailed = async () => {
    setIsSyncing(true);
    await processQueue();
    const q = await getQueue();
    setQueue(q);
    setIsSyncing(false);
  };

  const clearSynced = async () => {
    const q = await getQueue();
    const filtered = q.filter(e => e.status !== 'synced');
    await saveQueue(filtered);
    setQueue(filtered);
  };

  return {
    queue,
    isSyncing,
    isOnline: isOnlineState,
    add,
    retryFailed,
    clearSynced,
    pendingCount: queue.filter(e => e.status === 'pending' || e.status === 'failed').length,
  };
}
