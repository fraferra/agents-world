const DB_NAME = 'common-ground';
let connection;

function database() {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('worlds');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Another tab is blocking local storage.'));
    });
  }
  return connection;
}

// Saves alternate between two slots; a small pointer names the latest. A save
// never has to read the previous world back into memory to keep it as a
// recovery copy. Worlds saved before slots existed live under 'current' and
// 'previous', and are read from there until the first new save.
const SLOTS = ['slot-a', 'slot-b'];

function get(store, key) {
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** `key` is 'current' (the latest save) or 'previous' (the one before it). */
export async function loadWorld(key = 'current') {
  const db = await database();
  const store = db.transaction('worlds', 'readonly').objectStore('worlds');
  const pointer = await get(store, 'latest');
  if (!SLOTS.includes(pointer)) return get(store, key);
  return get(store, key === 'current' ? pointer : SLOTS.find(slot => slot !== pointer));
}

export async function storeWorld(world) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('worlds', 'readwrite');
    const store = transaction.objectStore('worlds');
    const pointer = store.get('latest');
    pointer.onsuccess = () => {
      const next = pointer.result === SLOTS[0] ? SLOTS[1] : SLOTS[0];
      store.put(world, next);
      store.put(next, 'latest');
      // The legacy copies are superseded once both slots can hold recovery data.
      if (pointer.result === SLOTS[0] || pointer.result === SLOTS[1]) { store.delete('current'); store.delete('previous'); }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Save interrupted.'));
  });
}

export function envelope(simulation) {
  return { format: 'common-ground', version: 1, savedAt: new Date().toISOString(), simulation };
}

export function unwrap(data) {
  if (!data || typeof data !== 'object') throw new Error('This is not a world save.');
  if ('format' in data) {
    if (data.format !== 'common-ground' || data.version !== 1) throw new Error('Unsupported world save format.');
    return data.simulation;
  }
  return data;
}
