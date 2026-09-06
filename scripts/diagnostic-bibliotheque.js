/*
 * Diagnostic de la bibliotheque VibeOS - a coller dans la console du navigateur
 * SUR LA PAGE de l'app (Safari : Developpement > Afficher la console JavaScript).
 *
 * Ne modifie RIEN. Il lit IndexedDB et dit, pour chaque dossier :
 * - combien de photos ont vraiment un fichier local,
 * - combien n'existent que dans le compte,
 * - lesquelles n'ont AUCUNE image affichable (les tuiles « ? » et les vues noires),
 * - les doublons exacts,
 * - et il compare avec la file Room.
 */
(async () => {
  const open = (name, version) => new Promise((ok, ko) => {
    const r = indexedDB.open(name, version);
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error('base bloquee'));
  });
  const all = (db, store) => new Promise((ok, ko) => {
    if (!db.objectStoreNames.contains(store)) { ok([]); return; }
    const r = db.transaction(store, 'readonly').objectStore(store).getAll();
    r.onsuccess = () => ok(r.result || []); r.onerror = () => ko(r.error);
  });

  const lib = await open('vibeos-library');
  const photos = await all(lib, 'photos');
  const folders = await all(lib, 'folders');
  lib.close();

  let room = [];
  try { const p = await open('vibeos'); room = await all(p, 'room'); p.close(); } catch {}

  const affichable = (p) => Boolean(p.thumbBlob || p.blob || p.previewUrl || p.originalUrl);

  console.log('=== DOSSIERS ===');
  for (const f of folders) {
    const dans = photos.filter((p) => p.folderId === f.id);
    const muettes = dans.filter((p) => !affichable(p));
    const distantes = dans.filter((p) => !p.blob && !p.thumbBlob);
    const sansOriginal = dans.filter((p) => !p.blob);
    const sig = new Map();
    dans.forEach((p) => {
      const k = `${p.width || 0}x${p.height || 0}:${p.bytes || 0}`;
      sig.set(k, (sig.get(k) || 0) + 1);
    });
    const doublons = [...sig.values()].filter((n) => n > 1).reduce((s, n) => s + (n - 1), 0);
    console.log(
      `${f.name} [${f.id}] : ${dans.length} photos`,
      `| sans fichier local ${sansOriginal.length}`,
      `| 100% distantes ${distantes.length}`,
      `| RIEN A AFFICHER ${muettes.length}`,
      `| doublons exacts ${doublons}`,
      `| venues de la Room ${dans.filter((p) => p.fromRoomId).length}`,
    );
    if (muettes.length) console.log('   muettes :', muettes.map((p) => ({ id: p.id, name: p.name, cloud: p.cloud?.state, previewUrl: p.previewUrl })));
  }

  console.log('=== ROOM ===');
  console.log(`${room.length} lignes en base`,
    `| avec fichier local ${room.filter((r) => r.blob).length}`,
    `| distantes ${room.filter((r) => !r.blob && r.cloud?.url).length}`,
    `| INVISIBLES (ni fichier ni URL) ${room.filter((r) => !r.blob && !r.cloud?.url).length}`);

  console.log('=== URLS DISTANTES QUI NE REPONDENT PAS ===');
  const aTester = photos.filter((p) => !p.thumbBlob && !p.blob && (p.previewUrl || p.originalUrl));
  const mortes = [];
  for (const p of aTester) {
    const url = p.previewUrl || p.originalUrl;
    const ok = await fetch(url, { method: 'GET' }).then((r) => r.ok).catch(() => false);
    if (!ok) mortes.push({ id: p.id, name: p.name, folderId: p.folderId, url });
  }
  console.log(`${aTester.length} testees, ${mortes.length} mortes`, mortes);
})();
