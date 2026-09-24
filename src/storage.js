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

export async function loadWorld(key = 'current') {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('worlds', 'readonly').objectStore('worlds').get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function storeWorld(world) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('worlds', 'readwrite');
    const store = transaction.objectStore('worlds');
    const previous = store.get('current');
    previous.onsuccess = () => {
      if (previous.result) store.put(previous.result, 'previous');
      store.put(world, 'current');
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
