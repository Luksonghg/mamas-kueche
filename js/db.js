// Kleine Hülle um IndexedDB. Alle Daten bleiben lokal auf dem Gerät.
const DB_NAME = 'mamas-kueche';
const DB_VERSION = 1;
export const STORES = ['rezepte', 'kategorien', 'tags', 'meta'];

let dbPromise = null;

function oeffnen() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ['rezepte', 'kategorien', 'tags']) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Datenbank blockiert'));
    });
  }
  return dbPromise;
}

/** Lädt alle Daten auf einmal. */
export async function alleLaden() {
  const db = await oeffnen();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORES, 'readonly');
    const out = {};
    for (const s of STORES) {
      const r = t.objectStore(s).getAll();
      r.onsuccess = () => { out[s] = r.result; };
    }
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/**
 * Schreibt mehrere Änderungen in einer Transaktion (alles oder nichts).
 * ops: [{ store, put: obj } | { store, del: id } | { clear: store }]
 */
export async function schreiben(ops) {
  if (!ops.length) return;
  const db = await oeffnen();
  const stores = [...new Set(ops.map((o) => o.store || o.clear))];
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, 'readwrite');
    for (const o of ops) {
      if (o.clear) t.objectStore(o.clear).clear();
      else if ('put' in o) t.objectStore(o.store).put(o.put);
      else if ('del' in o) t.objectStore(o.store).delete(o.del);
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Abgebrochen'));
  });
}
