import * as db from './db.js';
import {
  normalisiere, normalisiereEinfach, quelleVon, istLink, bereinigeLink, linkSchluessel,
  zerlegeEinfuegeText, bereinigeCaption, gliedereRezept, namensVorschlag
} from './parser.js';
import { hilfeHtml } from './hilfe.js';

const VERSION = '1.0.0';

const STANDARD_KATEGORIEN = [
  ['Fisch', '🐟', true], ['Hähnchen', '🍗', true], ['Rind', '🥩', true], ['Suppen & Eintöpfe', '🍲', true],
  ['Schwein', '🐖'], ['Pute', '🦃'], ['Hackfleisch', '🍔'], ['Lamm', '🐑'], ['Wild', '🦌'],
  ['Meeresfrüchte', '🦐'], ['Vegetarisch', '🥦'], ['Vegan', '🌱'], ['Nudeln', '🍝'], ['Salate', '🥗'],
  ['Beilagen', '🥔'], ['Backen', '🥖'], ['Desserts & Süßes', '🍰'], ['Frühstück', '🥐'], ['Snacks', '🥨'],
  ['Saucen & Dips', '🥣'], ['Getränke', '🥤']
];
const STANDARD_TAGS = ['schnell', 'Airfryer', 'Ofen', 'Pfanne', 'für Gäste', 'günstig', 'Meal Prep'];

/* ------------------------------------------------------------------ */
/* Zustand                                                             */
/* ------------------------------------------------------------------ */

const S = { rezepte: [], kategorien: [], tags: [], meta: {} };
const start = { suche: '', kats: new Set(), nurFav: false, sortierung: 'neu', scrollY: 0 };
const heute = { kats: new Set(), tags: new Set(), nurFav: false, aktuell: null, verlauf: [] };
const abgehakt = new Map();
let F = null; // Formular
let aktuelleRoute = '';
let vorherigeRoute = '';

const app = document.getElementById('app');
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
const jetzt = () => new Date().toISOString();
function tageSeit(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return Infinity;
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const h = new Date();
  const b = new Date(h.getFullYear(), h.getMonth(), h.getDate());
  return Math.round((b - a) / 86400000);
}
function vorWann(iso) {
  const n = tageSeit(iso);
  if (n <= 0) return 'heute';
  if (n === 1) return 'gestern';
  if (n < 60) return `vor ${n} Tagen`;
  if (n < 365) return `vor ${Math.round(n / 30)} Monaten`;
  return 'vor über einem Jahr';
}
function datumText(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '–';
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}
const heuteIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const kat = (id) => S.kategorien.find((k) => k.id === id);
const tag = (id) => S.tags.find((t) => t.id === id);
const katsSortiert = () => [...S.kategorien].sort((a, b) => a.sortierung - b.sortierung || a.name.localeCompare(b.name, 'de'));
const schnellKats = () => katsSortiert().filter((k) => k.istSchnellwahl);
const weitereKats = () => katsSortiert().filter((k) => !k.istSchnellwahl);
const tagsSortiert = () => [...S.tags].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
const katLabel = (k) => (k.emoji ? k.emoji + ' ' : '') + k.name;
const rezeptVon = (id) => S.rezepte.find((r) => r.id === id);

function gehe(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

/* ------------------------------------------------------------------ */
/* Toast & Dialog                                                      */
/* ------------------------------------------------------------------ */

let toastTimer;
function toast(text, ms = 2400) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('sichtbar');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('sichtbar'), ms);
}

function dialog({ titel, text = '', html = '', felder = [], knoepfe }) {
  return new Promise((resolve) => {
    const root = $('#dialog-root');
    root.innerHTML = `
      <div class="overlay" data-dlg="abbruch">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-titel">
          <h2 id="dlg-titel">${esc(titel)}</h2>
          ${text ? `<p>${esc(text)}</p>` : ''}${html}
          ${felder.map((f) => `
            <label class="feld"><span>${esc(f.label)}</span>
              <input type="text" data-feld="${esc(f.name)}" value="${esc(f.wert || '')}"
                ${f.platzhalter ? `placeholder="${esc(f.platzhalter)}"` : ''}
                ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} autocomplete="off" enterkeyhint="done"></label>`).join('')}
          <div class="dlg-knoepfe">
            ${knoepfe.map((k, i) => `<button type="button" class="knopf ${k.art || ''}" data-dlg-i="${i}">${esc(k.label)}</button>`).join('')}
          </div>
        </div>
      </div>`;
    document.body.classList.add('dialog-offen');
    let erledigt = false;
    const fertig = (wert) => {
      if (erledigt) return;
      erledigt = true;
      const werte = {};
      $$('[data-feld]', root).forEach((inp) => { werte[inp.dataset.feld] = inp.value.trim(); });
      root.innerHTML = '';
      document.body.classList.remove('dialog-offen');
      resolve({ wert, werte });
    };
    const overlay = $('.overlay', root);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) return fertig(null);
      const b = e.target.closest('[data-dlg-i]');
      if (b) fertig(knoepfe[+b.dataset.dlgI].wert);
    });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fertig(null);
      if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); fertig(knoepfe[0].wert); }
    });
    const erstes = $('input', root);
    if (erstes) erstes.focus();
  });
}
async function frage(titel, text, jaLabel, art = 'primaer') {
  const r = await dialog({ titel, text, knoepfe: [{ label: jaLabel, wert: true, art }, { label: 'Abbrechen', wert: false }] });
  return r.wert === true;
}
async function info(titel, text) {
  await dialog({ titel, text, knoepfe: [{ label: 'OK', wert: true, art: 'primaer' }] });
}

/* ------------------------------------------------------------------ */
/* Daten schreiben                                                     */
/* ------------------------------------------------------------------ */

async function setMeta(key, wert) {
  await db.schreiben([{ store: 'meta', put: { key, wert } }]);
  S.meta[key] = wert;
}
async function rezeptSpeichern(r) {
  await db.schreiben([{ store: 'rezepte', put: r }]);
  const i = S.rezepte.findIndex((x) => x.id === r.id);
  if (i >= 0) S.rezepte[i] = r; else S.rezepte.push(r);
}
async function kategorienSpeichern(liste) {
  await db.schreiben(liste.map((k) => ({ store: 'kategorien', put: k })));
  for (const k of liste) {
    const i = S.kategorien.findIndex((x) => x.id === k.id);
    if (i >= 0) S.kategorien[i] = k; else S.kategorien.push(k);
  }
}

async function einrichten() {
  const kategorien = STANDARD_KATEGORIEN.map(([name, emoji, schnell], i) => ({
    id: uuid(), name, emoji, sortierung: i, istStandard: true, istSchnellwahl: !!schnell
  }));
  const tags = STANDARD_TAGS.map((name) => ({ id: uuid(), name }));
  await db.schreiben([
    ...kategorien.map((k) => ({ store: 'kategorien', put: k })),
    ...tags.map((t) => ({ store: 'tags', put: t })),
    { store: 'meta', put: { key: 'eingerichtet', wert: jetzt() } }
  ]);
  S.kategorien = kategorien;
  S.tags = tags;
  S.meta.eingerichtet = true;
}

async function allesNeuLaden() {
  const d = await db.alleLaden();
  S.rezepte = d.rezepte;
  S.kategorien = d.kategorien;
  S.tags = d.tags;
  S.meta = Object.fromEntries(d.meta.map((m) => [m.key, m.wert]));
}

function findeDuplikat(link, ohneId) {
  if (!link) return null;
  const key = linkSchluessel(link);
  return S.rezepte.find((r) => r.id !== ohneId && linkSchluessel(r.link) === key) || null;
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

const istStartRoute = (h) => !h || h === '#' || h === '#/';

function route() {
  wakeLockFreigeben();
  if (istStartRoute(aktuelleRoute) && $('#liste')) start.scrollY = window.scrollY;
  const hash = location.hash || '#/';
  vorherigeRoute = aktuelleRoute;
  aktuelleRoute = hash;
  document.body.classList.remove('formular-seite');
  $('#dialog-root').innerHTML = '';
  document.body.classList.remove('dialog-offen');

  const [pfad, qs] = hash.slice(1).split('?');
  const teile = pfad.split('/').filter(Boolean);
  const params = new URLSearchParams(qs || '');
  let scroll = 0;

  switch (teile[0]) {
    case 'neu': zeigeFormular(null, params); break;
    case 'bearbeiten': zeigeFormular(teile[1]); break;
    case 'rezept': zeigeDetail(teile[1]); break;
    case 'heute': zeigeHeute(); break;
    case 'einstellungen':
      if (teile[1] === 'kategorien') zeigeKategorienVerwalten();
      else if (teile[1] === 'tags') zeigeTagsVerwalten();
      else zeigeEinstellungen();
      break;
    case 'hilfe': zeigeHilfe(); break;
    default: zeigeStart(); scroll = start.scrollY;
  }
  window.scrollTo(0, scroll);
}

function nichtGefunden() {
  app.innerHTML = `
    <header class="kopf"><a class="knopf klein" href="#/">‹ Zurück</a></header>
    <div class="leer"><p class="leer-gross">Dieses Rezept gibt es nicht mehr.</p>
    <a class="knopf breit" href="#/">Zur Startseite</a></div>`;
}

/* ------------------------------------------------------------------ */
/* Aktionen (Klicks)                                                   */
/* ------------------------------------------------------------------ */

const A = {};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.a];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el, e)).catch((err) => {
    console.error(err);
    info('Da ist etwas schiefgegangen', 'Bitte versuche es noch einmal. (' + (err && err.message || err) + ')');
  });
});

/* ------------------------------------------------------------------ */
/* Startseite                                                          */
/* ------------------------------------------------------------------ */

function backupFaellig() {
  if (!S.rezepte.length) return false;
  const aus = S.meta.backupHinweisAus;
  if (aus && tageSeit(aus) < 3) return false;
  if (S.meta.letztesBackup) return tageSeit(S.meta.letztesBackup) > 30;
  const aeltestes = S.rezepte.reduce((m, r) => (r.erstelltAm < m ? r.erstelltAm : m), S.rezepte[0].erstelltAm);
  return tageSeit(aeltestes) > 30;
}

function istIosSafariOhneInstallation() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return ios && navigator.standalone === false;
}

function zeigeStart() {
  document.title = 'Mamas Küche';
  const hinweise = [];
  if (istIosSafariOhneInstallation()) {
    hinweise.push(`<div class="hinweis banner"><p><b>Tipp:</b> Leg die App auf deinen Home-Bildschirm, dann sind deine Rezepte sicher gespeichert.</p>
      <a class="knopf klein" href="#/hilfe">So geht's</a></div>`);
  }
  if (backupFaellig()) {
    hinweise.push(`<div class="hinweis banner"><p>💾 Dein letztes Backup ist schon eine Weile her. Sichere deine Rezepte, damit nichts verloren geht.</p>
      <div class="knopf-reihe"><button class="knopf klein primaer" data-a="backupExport">Jetzt sichern</button>
      <button class="knopf klein" data-a="backupSpaeter">Später</button></div></div>`);
  }

  if (!S.rezepte.length) {
    app.innerHTML = `
      <header class="kopf"><h1>Mamas Küche</h1><a class="knopf klein" href="#/einstellungen">⚙️ Einstellungen</a></header>
      ${hinweise.join('')}
      <div class="leer">
        <p class="leer-gross">👋 Willkommen in deiner Rezeptbox!</p>
        <p>Hier sammelst du Rezepte aus Instagram und TikTok. So speicherst du das erste:</p>
        <ol>
          <li>Tippe im Video auf <b>Teilen</b> und dann auf <b>„Zur Rezeptbox“</b>.</li>
          <li>Öffne danach diese App, tippe unten auf <b>„+ Rezept“</b> und dann auf <b>„Link einfügen“</b>.</li>
        </ol>
        <a class="knopf breit" href="#/hilfe">❓ Genaue Anleitung ansehen</a>
      </div>
      <a class="fab" href="#/neu">+ Rezept</a>`;
    return;
  }

  app.innerHTML = `
    <header class="kopf"><h1>Mamas Küche</h1><a class="knopf klein" href="#/einstellungen">⚙️ Einstellungen</a></header>
    ${hinweise.join('')}
    <a class="knopf gross primaer" href="#/heute">🍳 Was koche ich heute?</a>
    <div class="suchfeld">
      <span class="lupe" aria-hidden="true">🔍</span>
      <input id="suche" type="search" enterkeyhint="search" placeholder="Rezept suchen …" aria-label="Rezept suchen"
        value="${esc(start.suche)}" autocomplete="off" autocorrect="off" spellcheck="false">
      <button type="button" class="leeren" data-a="sucheLeeren" aria-label="Suche löschen" ${start.suche ? '' : 'hidden'}>✕</button>
    </div>
    <div id="filter"></div>
    <div class="liste-kopf">
      <span id="anzahl"></span>
      <label class="sortieren">Sortieren:
        <select id="sortierung">
          <option value="neu">Neueste zuerst</option>
          <option value="az">A–Z</option>
          <option value="gekocht">Zuletzt gekocht</option>
        </select>
      </label>
    </div>
    <div id="liste" class="liste"></div>
    <a class="fab" href="#/neu">+ Rezept</a>`;

  $('#sortierung').value = start.sortierung;
  renderStartFilter();
  renderListe();

  $('#suche').addEventListener('input', (e) => {
    start.suche = e.target.value;
    $('.suchfeld .leeren').hidden = !start.suche;
    renderListe();
  });
  $('#suche').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  $('#sortierung').addEventListener('change', (e) => { start.sortierung = e.target.value; renderListe(); });
}

function zaehleKategorien() {
  const z = {};
  for (const r of S.rezepte) for (const id of r.kategorien) z[id] = (z[id] || 0) + 1;
  return z;
}

function kachelHtml(k, gedrueckt, aktion, zahl) {
  return `<button type="button" class="kachel" data-a="${aktion}" data-id="${k.id}" aria-pressed="${gedrueckt}">
    <span class="kachel-emoji" aria-hidden="true">${esc(k.emoji || '🍽️')}</span>
    <span class="kachel-name">${esc(k.name)}</span>
    ${zahl !== undefined ? `<span class="kachel-zahl">${zahl} ${zahl === 1 ? 'Rezept' : 'Rezepte'}</span>` : ''}
  </button>`;
}

function renderStartFilter() {
  const z = zaehleKategorien();
  $('#filter').innerHTML = `
    <div class="kacheln">${schnellKats().map((k) => kachelHtml(k, start.kats.has(k.id), 'startKat', z[k.id] || 0)).join('')}</div>
    <div class="chips" role="group" aria-label="Kategorien">
      <button type="button" class="chip" data-a="startAlle">Alle</button>
      <button type="button" class="chip" data-a="startFav">⭐ Favoriten</button>
      ${weitereKats().map((k) => `<button type="button" class="chip" data-a="startKat" data-id="${k.id}">${esc(katLabel(k))}</button>`).join('')}
    </div>`;
  startFilterZustand();
}

function startFilterZustand() {
  $$('#filter [data-a="startKat"]').forEach((b) => b.setAttribute('aria-pressed', start.kats.has(b.dataset.id)));
  $('#filter [data-a="startFav"]')?.setAttribute('aria-pressed', start.nurFav);
  $('#filter [data-a="startAlle"]')?.setAttribute('aria-pressed', !start.kats.size && !start.nurFav);
}

function suchText(r) {
  const teile = [
    r.name, r.notiz, r.rezepttext,
    ...r.tags.map((id) => tag(id)?.name || ''),
    ...r.kategorien.map((id) => kat(id)?.name || '')
  ].join(' ');
  return normalisiere(teile) + ' ' + normalisiereEinfach(teile);
}

function gefilterteRezepte() {
  const woerter = normalisiere(start.suche).split(/\s+/).filter(Boolean);
  const liste = S.rezepte.filter((r) => {
    if (start.nurFav && !r.favorit) return false;
    if (start.kats.size && !r.kategorien.some((id) => start.kats.has(id))) return false;
    if (woerter.length) {
      const h = suchText(r);
      if (!woerter.every((w) => h.includes(w))) return false;
    }
    return true;
  });
  const nachName = (a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
  if (start.sortierung === 'az') liste.sort(nachName);
  else if (start.sortierung === 'gekocht') {
    liste.sort((a, b) => {
      if (a.zuletztGekocht && b.zuletztGekocht) return b.zuletztGekocht.localeCompare(a.zuletztGekocht);
      if (a.zuletztGekocht) return -1;
      if (b.zuletztGekocht) return 1;
      return nachName(a, b);
    });
  } else liste.sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm));
  return liste;
}

function quelleBadge(q) {
  if (q === 'instagram') return '<span class="quelle q-instagram">Instagram</span>';
  if (q === 'tiktok') return '<span class="quelle q-tiktok">TikTok</span>';
  return '<span class="quelle q-sonstige">Link</span>';
}

function karteHtml(r) {
  const kats = r.kategorien.map(kat).filter(Boolean).map(katLabel).join(' · ');
  const tags = r.tags.map(tag).filter(Boolean).map((t) => t.name).join(' · ');
  return `<a class="karte" href="#/rezept/${esc(r.id)}">
    <span class="karte-oben"><span class="karte-name">${esc(r.name)}</span>${r.favorit ? '<span class="karte-stern" aria-label="Favorit">⭐</span>' : ''}</span>
    <span class="karte-meta">${quelleBadge(r.quelle)} ${esc(kats || 'Ohne Kategorie')}</span>
    ${tags ? `<span class="karte-tags">🏷️ ${esc(tags)}</span>` : ''}
  </a>`;
}

function renderListe() {
  const liste = gefilterteRezepte();
  $('#anzahl').textContent = liste.length === 1 ? '1 Rezept' : `${liste.length} Rezepte`;
  if (!liste.length) {
    $('#liste').innerHTML = `<div class="leer"><p class="leer-gross">Nichts gefunden.</p>
      <p>Dazu gibt es noch kein Rezept. Versuch ein anderes Wort oder nimm eine Auswahl raus.</p>
      <button class="knopf breit" data-a="filterZuruecksetzen">Alles anzeigen</button></div>`;
    return;
  }
  $('#liste').innerHTML = liste.map(karteHtml).join('');
}

A.startKat = (el) => {
  const id = el.dataset.id;
  if (start.kats.has(id)) start.kats.delete(id); else start.kats.add(id);
  startFilterZustand();
  renderListe();
};
A.startFav = () => { start.nurFav = !start.nurFav; startFilterZustand(); renderListe(); };
A.startAlle = () => { start.kats.clear(); start.nurFav = false; startFilterZustand(); renderListe(); };
A.sucheLeeren = () => {
  start.suche = '';
  $('#suche').value = '';
  $('.suchfeld .leeren').hidden = true;
  renderListe();
};
A.filterZuruecksetzen = () => {
  start.kats.clear(); start.nurFav = false; start.suche = '';
  zeigeStart();
};
A.backupSpaeter = async () => { await setMeta('backupHinweisAus', jetzt()); zeigeStart(); };

/* ------------------------------------------------------------------ */
/* Rezept hinzufügen / bearbeiten                                      */
/* ------------------------------------------------------------------ */

function zeigeFormular(id, params) {
  const r = id ? rezeptVon(id) : null;
  if (id && !r) return nichtGefunden();
  document.title = r ? 'Rezept bearbeiten' : 'Neues Rezept';
  document.body.classList.add('formular-seite');

  F = r ? {
    id: r.id, link: r.link, name: r.name,
    kategorien: new Set(r.kategorien.filter((k) => kat(k))), tags: new Set(r.tags.filter((t) => tag(t))),
    favorit: r.favorit, notiz: r.notiz, rezepttext: r.rezepttext,
    hinweis: false, mehrOffen: r.kategorien.some((k) => kat(k) && !kat(k).istSchnellwahl),
    vorschlag: '', geaendert: false
  } : {
    id: null, link: '', name: '', kategorien: new Set(), tags: new Set(),
    favorit: false, notiz: '', rezepttext: '', hinweis: false, mehrOffen: false, vorschlag: '', geaendert: false
  };

  let vorausgefuellt = false;
  if (!r && params && params.get('link')) {
    const z = zerlegeEinfuegeText(params.get('link') + '\n' + (params.get('text') || ''));
    F.link = z.link || bereinigeLink(params.get('link'));
    F.rezepttext = z.text;
    F.hinweis = params.get('status') === 'fehlgeschlagen' || !z.text;
    F.vorschlag = namensVorschlag(z.text);
    F.geaendert = true;
    vorausgefuellt = true;
  }

  app.innerHTML = `
    <header class="kopf">
      <button type="button" class="knopf klein" data-a="formZurueck">‹ Zurück</button>
      <h1 class="kopf-titel">${r ? 'Bearbeiten' : 'Neues Rezept'}</h1>
      <span class="platz"></span>
    </header>
    <form id="formular" novalidate autocomplete="off">
      <section class="block">
        <span class="block-titel">Link</span>
        <button type="button" class="knopf gross ${F.link ? '' : 'primaer'}" data-a="linkEinfuegen">📋 Link einfügen</button>
        <p class="leise" style="margin:10px 0 6px">oder hier eintippen:</p>
        <input id="f-link" type="url" inputmode="url" placeholder="https://www.instagram.com/…" value="${esc(F.link)}"
          autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Link zum Rezept">
        <div id="f-link-info"></div>
      </section>

      <div id="f-hinweis"></div>

      <section class="block">
        <label class="block-titel" for="f-name">Name</label>
        <input id="f-name" type="text" value="${esc(F.name)}" placeholder="z. B. Lachs aus dem Ofen"
          autocapitalize="sentences" enterkeyhint="done" maxlength="120">
        <div id="f-vorschlag"></div>
      </section>

      <section class="block" id="f-kats-block">
        <span class="block-titel">Kategorie</span>
        <p class="leise">Mindestens eine antippen – mehrere gehen auch.</p>
        <div id="f-kats"></div>
      </section>

      <section class="block">
        <span class="block-titel">Tags <span class="leise" style="font-weight:400;font-size:17px">(freiwillig)</span></span>
        <div id="f-tags"></div>
      </section>

      <section class="block">
        <label class="schalter-zeile"><span>⭐ Favorit</span>
          <input type="checkbox" class="schalter" id="f-fav" ${F.favorit ? 'checked' : ''}></label>
      </section>

      <section class="block">
        <label class="block-titel" for="f-notiz">Notiz <span class="leise" style="font-weight:400;font-size:17px">(freiwillig)</span></label>
        <textarea id="f-notiz" rows="3" placeholder="z. B. weniger Salz nehmen">${esc(F.notiz)}</textarea>
      </section>

      <section class="block">
        <label class="block-titel" for="f-text">Rezepttext <span class="leise" style="font-weight:400;font-size:17px">(freiwillig)</span></label>
        <button type="button" class="knopf breit" data-a="textEinfuegen" style="margin-bottom:10px">📋 Text einfügen</button>
        <textarea id="f-text" rows="7" placeholder="Zutaten und Zubereitung">${esc(F.rezepttext)}</textarea>
      </section>

      <div class="fuss">
        <p id="f-fehler" class="fehler-text" hidden></p>
        <button type="submit" class="knopf gross primaer">Speichern</button>
      </div>
    </form>`;

  renderLinkInfo();
  renderHinweis();
  renderVorschlag();
  renderFormKats();
  renderFormTags();

  const form = $('#formular');
  form.addEventListener('submit', formularSpeichern);
  form.addEventListener('input', () => { F.geaendert = true; $('#f-fehler').hidden = true; });

  const link = $('#f-link');
  link.addEventListener('paste', (e) => {
    const t = e.clipboardData && e.clipboardData.getData('text');
    if (t && (/\n/.test(t.trim()) || /#rezeptbox/i.test(t) || !istLink(t.trim()))) {
      e.preventDefault();
      uebernehmeEinfuegeText(t);
    }
  });
  link.addEventListener('input', () => { F.link = link.value.trim(); renderLinkInfo(); link.classList.remove('feld-fehler'); });
  link.addEventListener('blur', () => {
    if (link.value.trim() && istLink(link.value)) { link.value = bereinigeLink(link.value); F.link = link.value; renderLinkInfo(); }
  });
  $('#f-name').addEventListener('input', (e) => { F.name = e.target.value; e.target.classList.remove('feld-fehler'); renderVorschlag(); });
  $('#f-text').addEventListener('input', (e) => {
    F.rezepttext = e.target.value;
    if (F.hinweis && F.rezepttext.trim()) { F.hinweis = false; renderHinweis(); }
  });

  if (vorausgefuellt) {
    history.replaceState(null, '', '#/neu');
    aktuelleRoute = '#/neu';
    $('#f-name').focus();
  }
}

function renderLinkInfo() {
  const box = $('#f-link-info');
  if (!box) return;
  const link = (F.link || '').trim();
  if (!link) { box.innerHTML = ''; return; }
  if (!istLink(link)) { box.innerHTML = '<p class="link-falsch">Das sieht noch nicht wie ein Link aus.</p>'; return; }
  const q = quelleVon(link);
  const dupe = findeDuplikat(bereinigeLink(link), F.id);
  box.innerHTML = `
    <p class="link-ok">✓ ${q === 'instagram' ? 'Instagram-Link erkannt' : q === 'tiktok' ? 'TikTok-Link erkannt' : 'Link erkannt'}</p>
    ${dupe ? `<div class="hinweis warnung"><p><b>Dieses Rezept hast du schon gespeichert:</b><br>„${esc(dupe.name)}“</p>
      <a class="knopf klein" href="#/rezept/${esc(dupe.id)}">Zum gespeicherten Rezept</a></div>` : ''}`;
}

function renderHinweis() {
  const box = $('#f-hinweis');
  if (!box) return;
  box.innerHTML = F.hinweis ? `
    <div class="hinweis">
      <p><b>Das Rezept konnte leider nicht automatisch geholt werden.</b></p>
      <p>So geht's von Hand:</p>
      <ol>
        <li>Öffne den Beitrag in Instagram oder TikTok und tippe auf <b>„mehr“</b>, damit die ganze Beschreibung zu sehen ist.</li>
        <li>Mach einen <b>Screenshot</b>.</li>
        <li>Öffne den Screenshot, halte den Finger auf den Text → <b>„Alles auswählen“</b> → <b>„Kopieren“</b>.</li>
        <li>Komm zurück und tippe auf <b>„Text einfügen“</b>.</li>
      </ol>
      <button type="button" class="knopf breit" data-a="textEinfuegen">📋 Text einfügen</button>
      <p class="leise" style="margin-top:10px">Du kannst das Rezept auch jetzt schon ohne Text speichern und ihn später über „Bearbeiten“ ergänzen.</p>
    </div>` : '';
}

function renderVorschlag() {
  const box = $('#f-vorschlag');
  if (!box) return;
  box.innerHTML = F.vorschlag && !F.name.trim()
    ? `<button type="button" class="chip vorschlag" data-a="vorschlagNehmen">Vorschlag: „${esc(F.vorschlag)}“ – antippen zum Übernehmen</button>`
    : '';
}

function renderFormKats() {
  const rest = weitereKats();
  const gewaehlt = rest.filter((k) => F.kategorien.has(k.id)).length;
  $('#f-kats').innerHTML = `
    <div class="kacheln">${schnellKats().map((k) => kachelHtml(k, F.kategorien.has(k.id), 'formKat')).join('')}</div>
    <details class="mehr" ${F.mehrOffen ? 'open' : ''}>
      <summary class="knopf breit">Mehr Kategorien <span class="zaehler">${gewaehlt ? `(${gewaehlt} gewählt)` : ''}</span></summary>
      <div class="chips umbruch">
        ${rest.map((k) => `<button type="button" class="chip" data-a="formKat" data-id="${k.id}" aria-pressed="${F.kategorien.has(k.id)}">${esc(katLabel(k))}</button>`).join('')}
        <button type="button" class="chip neu" data-a="formNeueKategorie">+ Neue Kategorie</button>
      </div>
    </details>`;
  $('#f-kats details').addEventListener('toggle', (e) => { F.mehrOffen = e.target.open; });
}

function renderFormTags() {
  $('#f-tags').innerHTML = `<div class="chips umbruch">
    ${tagsSortiert().map((t) => `<button type="button" class="chip" data-a="formTag" data-id="${t.id}" aria-pressed="${F.tags.has(t.id)}">${esc(t.name)}</button>`).join('')}
    <button type="button" class="chip neu" data-a="formNeuerTag">+ Neuer Tag</button>
  </div>`;
}

A.formKat = (el) => {
  const id = el.dataset.id;
  if (F.kategorien.has(id)) F.kategorien.delete(id); else F.kategorien.add(id);
  el.setAttribute('aria-pressed', F.kategorien.has(id));
  F.geaendert = true;
  $('#f-fehler').hidden = true;
  const n = weitereKats().filter((k) => F.kategorien.has(k.id)).length;
  $('#f-kats .zaehler').textContent = n ? `(${n} gewählt)` : '';
};
A.formTag = (el) => {
  const id = el.dataset.id;
  if (F.tags.has(id)) F.tags.delete(id); else F.tags.add(id);
  el.setAttribute('aria-pressed', F.tags.has(id));
  F.geaendert = true;
};
A.formNeueKategorie = async () => {
  const k = await neueKategorieDialog();
  if (!k) return;
  F.kategorien.add(k.id);
  F.mehrOffen = true;
  F.geaendert = true;
  renderFormKats();
};
A.formNeuerTag = async () => {
  const t = await neuerTagDialog();
  if (!t) return;
  F.tags.add(t.id);
  F.geaendert = true;
  renderFormTags();
};
A.vorschlagNehmen = () => {
  F.name = F.vorschlag;
  $('#f-name').value = F.vorschlag;
  F.geaendert = true;
  renderVorschlag();
};

async function zwischenablageLesen() {
  if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('nicht unterstützt');
  return navigator.clipboard.readText();
}

A.linkEinfuegen = async () => {
  let t;
  try {
    t = await zwischenablageLesen();
  } catch {
    await info('Einfügen hat nicht geklappt', 'Halte den Finger in das Feld unter dem Knopf und tippe dann auf „Einsetzen“.');
    $('#f-link').focus();
    return;
  }
  uebernehmeEinfuegeText(t);
};

function uebernehmeEinfuegeText(t) {
  const z = zerlegeEinfuegeText(t);
  if (!z.link) {
    info('Kein Link gefunden', 'In der Zwischenablage ist kein Link. Tippe in Instagram oder TikTok auf „Teilen“ und dann auf „Zur Rezeptbox“ oder „Link kopieren“.');
    return;
  }
  F.link = z.link;
  $('#f-link').value = z.link;
  $('#f-link').classList.remove('feld-fehler');
  F.geaendert = true;
  if (z.text) {
    if (!F.rezepttext.trim()) { F.rezepttext = z.text; $('#f-text').value = z.text; }
    F.hinweis = false;
    F.vorschlag = namensVorschlag(z.text);
  } else {
    F.hinweis = !F.rezepttext.trim();
  }
  $('[data-a="linkEinfuegen"]').classList.remove('primaer');
  renderLinkInfo();
  renderHinweis();
  renderVorschlag();
  toast(z.text ? 'Link und Text eingefügt ✓' : 'Link eingefügt ✓');
  if (!$('#f-name').value.trim()) $('#f-name').focus();
}

A.textEinfuegen = async () => {
  let t;
  try {
    t = await zwischenablageLesen();
  } catch {
    await info('Einfügen hat nicht geklappt', 'Halte den Finger in das Feld „Rezepttext“ und tippe dann auf „Einsetzen“.');
    $('#f-text').focus();
    return;
  }
  t = String(t || '').trim();
  if (!t) { await info('Die Zwischenablage ist leer', 'Kopiere zuerst den Rezepttext und tippe dann noch einmal auf „Text einfügen“.'); return; }

  let text = t;
  const z = zerlegeEinfuegeText(t);
  if (z.link && (/#rezeptbox/i.test(t) || !F.link.trim())) {
    if (!F.link.trim()) { F.link = z.link; $('#f-link').value = z.link; renderLinkInfo(); }
    text = z.text;
  } else {
    text = bereinigeCaption(t);
  }
  if (!text) { await info('Kein Text gefunden', 'In der Zwischenablage ist nur ein Link, aber kein Rezepttext.'); return; }

  const ta = $('#f-text');
  if (ta.value.trim()) {
    const r = await dialog({
      titel: 'Es steht schon Text da',
      text: 'Soll der neue Text den alten ersetzen oder unten angehängt werden?',
      knoepfe: [{ label: 'Unten anhängen', wert: 'an', art: 'primaer' }, { label: 'Alten Text ersetzen', wert: 'ersetzen' }, { label: 'Abbrechen', wert: null }]
    });
    if (!r.wert) return;
    ta.value = r.wert === 'an' ? ta.value.trim() + '\n\n' + text : text;
  } else {
    ta.value = text;
  }
  F.rezepttext = ta.value;
  F.geaendert = true;
  F.hinweis = false;
  renderHinweis();
  if (!F.name.trim() && !F.vorschlag) { F.vorschlag = namensVorschlag(text); renderVorschlag(); }
  toast('Text eingefügt ✓');
};

A.formZurueck = async () => {
  const ziel = F && F.id ? '#/rezept/' + F.id : '#/';
  if (F && F.geaendert) {
    const ok = await frage('Nicht gespeichert', 'Du hast etwas geändert, aber noch nicht gespeichert. Ohne Speichern zurück?', 'Ohne Speichern zurück', 'gefahr');
    if (!ok) return;
  }
  F = null;
  gehe(ziel);
};

function formFehler(text, sel) {
  const p = $('#f-fehler');
  p.textContent = text;
  p.hidden = false;
  const el = $(sel);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el.matches('input, textarea')) { el.classList.add('feld-fehler'); el.focus({ preventScroll: true }); }
  }
}

async function formularSpeichern(e) {
  e.preventDefault();
  const link = bereinigeLink($('#f-link').value);
  const name = $('#f-name').value.trim();
  const notiz = $('#f-notiz').value.trim();
  const rezepttext = $('#f-text').value.trim();
  const favorit = $('#f-fav').checked;
  const kategorien = [...F.kategorien].filter((id) => kat(id));
  const tags = [...F.tags].filter((id) => tag(id));

  if (!link || !istLink(link)) return formFehler('Bitte füge zuerst den Link ein.', '#f-link');
  if (!name) return formFehler('Bitte gib dem Rezept einen Namen.', '#f-name');
  if (!kategorien.length) return formFehler('Bitte tippe mindestens eine Kategorie an.', '#f-kats-block');

  const dupe = findeDuplikat(link, F.id);
  if (dupe) {
    const ok = await frage('Schon gespeichert', `Diesen Link hast du schon als „${dupe.name}“ gespeichert. Trotzdem noch einmal speichern?`, 'Trotzdem speichern');
    if (!ok) return;
  }

  const alt = F.id ? rezeptVon(F.id) : null;
  const r = {
    id: alt ? alt.id : uuid(),
    name,
    link,
    quelle: quelleVon(link),
    kategorien,
    tags,
    notiz,
    rezepttext,
    favorit,
    erstelltAm: alt ? alt.erstelltAm : jetzt(),
    zuletztGekocht: alt ? alt.zuletztGekocht : null,
    malGekocht: alt ? alt.malGekocht : 0
  };
  await rezeptSpeichern(r);
  F = null;
  toast('Gespeichert ✓');
  if (alt) {
    gehe('#/rezept/' + r.id);
  } else {
    start.kats.clear(); start.nurFav = false; start.suche = ''; start.scrollY = 0;
    gehe('#/');
  }
}

/* ------------------------------------------------------------------ */
/* Neue Kategorie / neuer Tag                                          */
/* ------------------------------------------------------------------ */

async function neueKategorieDialog() {
  const r = await dialog({
    titel: 'Neue Kategorie',
    felder: [
      { name: 'name', label: 'Name', platzhalter: 'z. B. Aufläufe', maxlength: 40 },
      { name: 'emoji', label: 'Bildchen (freiwillig)', platzhalter: 'z. B. 🥘', maxlength: 8 }
    ],
    knoepfe: [{ label: 'Anlegen', wert: 'ok', art: 'primaer' }, { label: 'Abbrechen', wert: null }]
  });
  if (r.wert !== 'ok' || !r.werte.name) return null;
  const vorhanden = S.kategorien.find((k) => normalisiere(k.name) === normalisiere(r.werte.name));
  if (vorhanden) { toast('Diese Kategorie gibt es schon'); return vorhanden; }
  const k = {
    id: uuid(), name: r.werte.name, emoji: r.werte.emoji || '',
    sortierung: Math.max(-1, ...S.kategorien.map((x) => x.sortierung)) + 1,
    istStandard: false, istSchnellwahl: false
  };
  await kategorienSpeichern([k]);
  toast('Kategorie angelegt ✓');
  return k;
}

async function neuerTagDialog() {
  const r = await dialog({
    titel: 'Neuer Tag',
    felder: [{ name: 'name', label: 'Name', platzhalter: 'z. B. Grill', maxlength: 30 }],
    knoepfe: [{ label: 'Anlegen', wert: 'ok', art: 'primaer' }, { label: 'Abbrechen', wert: null }]
  });
  if (r.wert !== 'ok' || !r.werte.name) return null;
  const vorhanden = S.tags.find((t) => normalisiere(t.name) === normalisiere(r.werte.name));
  if (vorhanden) { toast('Diesen Tag gibt es schon'); return vorhanden; }
  const t = { id: uuid(), name: r.werte.name };
  await db.schreiben([{ store: 'tags', put: t }]);
  S.tags.push(t);
  toast('Tag angelegt ✓');
  return t;
}

/* ------------------------------------------------------------------ */
/* Rezept-Detail                                                       */
/* ------------------------------------------------------------------ */

let wakeLock = null;
let wachGewuenscht = false;
async function wakeLockAnfordern() {
  wachGewuenscht = true;
  if (!('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
    if (!wachGewuenscht) { wakeLock.release().catch(() => {}); return; }
    const p = $('#wachhalten');
    if (p) p.hidden = false;
  } catch { /* nicht verfügbar */ }
}
function wakeLockFreigeben() {
  wachGewuenscht = false;
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wachGewuenscht && !wakeLock) wakeLockAnfordern();
});

function gekochtText(r) {
  if (!r.zuletztGekocht) return 'Noch nie gekocht';
  return `Zuletzt gekocht: <b>${vorWann(r.zuletztGekocht)}</b> · ${r.malGekocht}× gekocht`;
}

function absaetzeHtml(t) {
  return t.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('');
}

function rezeptHtml(r) {
  if (!r.rezepttext.trim()) {
    return `<section class="block"><h2>Rezept</h2>
      <p class="leise">Noch kein Rezepttext gespeichert. Über „Bearbeiten“ kannst du ihn ergänzen.</p></section>`;
  }
  const g = gliedereRezept(r.rezepttext);
  const haken = abgehakt.get(r.id) || new Set();
  let html = '';
  if (g.erkannt) {
    if (g.intro.length) html += `<p class="intro">${esc(g.intro.join('\n'))}</p>`;
    if (g.zutaten.length) {
      html += `<section class="block"><h2>Zutaten</h2><div class="zutaten">${g.zutaten.map((z, i) => z.gruppe
        ? `<p class="zutat-gruppe">${esc(z.text)}</p>`
        : `<label class="zutat ${haken.has(i) ? 'erledigt' : ''}"><input type="checkbox" data-zutat="${i}" ${haken.has(i) ? 'checked' : ''}><span>${esc(z.text)}</span></label>`
      ).join('')}</div></section>`;
    }
    if (g.schritte.length) {
      html += `<section class="block"><h2>Zubereitung</h2><ol class="schritte">${g.schritte.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>`;
    }
    if (g.rest.length) html += `<section class="block"><p class="weiteres">${esc(g.rest.join('\n'))}</p></section>`;
  } else {
    html += `<section class="block"><h2>Rezept</h2><div class="rohtext">${absaetzeHtml(g.sauber || r.rezepttext)}</div></section>`;
  }
  html += `<details class="block original"><summary class="knopf klein">Originaltext anzeigen</summary>
    <div class="rohtext">${esc(r.rezepttext)}</div></details>`;
  return html;
}

function zeigeDetail(id) {
  const r = rezeptVon(id);
  if (!r) return nichtGefunden();
  document.title = r.name;
  const zurueck = vorherigeRoute.startsWith('#/heute') ? '#/heute' : '#/';
  const quelleName = { instagram: 'Instagram', tiktok: 'TikTok' }[r.quelle];
  const kats = r.kategorien.map(kat).filter(Boolean);
  const tags = r.tags.map(tag).filter(Boolean);

  app.innerHTML = `
    <header class="kopf">
      <a class="knopf klein" href="${zurueck}">‹ Zurück</a>
      <button type="button" class="knopf klein" data-a="favUmschalten" data-id="${esc(r.id)}" aria-pressed="${r.favorit}">${r.favorit ? '⭐ Favorit' : '☆ Favorit'}</button>
    </header>
    <h1 class="rezept-titel">${esc(r.name)}</h1>
    <div class="etiketten">
      ${kats.map((k) => `<span class="etikett">${esc(katLabel(k))}</span>`).join('')}
      ${tags.map((t) => `<span class="etikett tag">🏷️ ${esc(t.name)}</span>`).join('')}
    </div>
    <a class="knopf gross primaer" href="${esc(r.link)}" target="_blank" rel="noopener">${quelleName ? `Auf ${quelleName} öffnen` : 'Link öffnen'} ↗</a>

    <section class="block gekocht">
      <p id="gekocht-info">${gekochtText(r)}</p>
      <button type="button" class="knopf gross gut" data-a="heuteGekocht" data-id="${esc(r.id)}">Heute gekocht ✓</button>
    </section>

    ${r.notiz ? `<section class="block"><h2>Notiz</h2><p class="notiz">${esc(r.notiz)}</p></section>` : ''}

    ${rezeptHtml(r)}

    <p id="wachhalten" class="leise" hidden>💡 Der Bildschirm bleibt an, solange dieses Rezept offen ist.</p>

    <div class="knopf-reihe">
      <a class="knopf" href="#/bearbeiten/${esc(r.id)}">✏️ Bearbeiten</a>
      <button type="button" class="knopf gefahr-rand" data-a="rezeptLoeschen" data-id="${esc(r.id)}">🗑️ Löschen</button>
    </div>`;

  $$('[data-zutat]').forEach((cb) => cb.addEventListener('change', () => {
    const set = abgehakt.get(r.id) || new Set();
    const i = +cb.dataset.zutat;
    if (cb.checked) set.add(i); else set.delete(i);
    abgehakt.set(r.id, set);
    cb.closest('.zutat').classList.toggle('erledigt', cb.checked);
  }));

  wakeLockAnfordern();
}

A.favUmschalten = async (el) => {
  const r = rezeptVon(el.dataset.id);
  if (!r) return;
  const neu = { ...r, favorit: !r.favorit };
  await rezeptSpeichern(neu);
  el.setAttribute('aria-pressed', neu.favorit);
  el.textContent = neu.favorit ? '⭐ Favorit' : '☆ Favorit';
  toast(neu.favorit ? 'Zu Favoriten hinzugefügt ⭐' : 'Kein Favorit mehr');
};

A.heuteGekocht = async (el) => {
  const r = rezeptVon(el.dataset.id);
  if (!r) return;
  if (r.zuletztGekocht && tageSeit(r.zuletztGekocht) === 0) {
    toast('Für heute schon eingetragen ✓');
    return;
  }
  const neu = { ...r, zuletztGekocht: jetzt(), malGekocht: (r.malGekocht || 0) + 1 };
  await rezeptSpeichern(neu);
  $('#gekocht-info').innerHTML = gekochtText(neu);
  toast('Eingetragen – guten Appetit! ✓');
};

A.rezeptLoeschen = async (el) => {
  const r = rezeptVon(el.dataset.id);
  if (!r) return;
  const ok = await frage(`„${r.name}“ löschen?`, 'Das Rezept wird aus der App entfernt. Das kann man nicht rückgängig machen.', 'Ja, löschen', 'gefahr');
  if (!ok) return;
  await db.schreiben([{ store: 'rezepte', del: r.id }]);
  S.rezepte = S.rezepte.filter((x) => x.id !== r.id);
  abgehakt.delete(r.id);
  if (heute.aktuell === r.id) heute.aktuell = null;
  toast('Gelöscht');
  gehe('#/');
};

/* ------------------------------------------------------------------ */
/* Was koche ich heute?                                                */
/* ------------------------------------------------------------------ */

function passtZuAuswahl(r, auswahl) {
  if (auswahl.nurFav && !r.favorit) return false;
  if (auswahl.kats.size && !r.kategorien.some((id) => auswahl.kats.has(id))) return false;
  for (const t of auswahl.tags) if (!r.tags.includes(t)) return false;
  return true;
}

function gewicht(r) {
  const tage = r.zuletztGekocht ? tageSeit(r.zuletztGekocht) : null;
  let w = tage === null ? 10 : 1 + Math.min(Math.max(tage, 0), 90) / 10;
  if (r.favorit) w *= 1.3;
  return w;
}

function zufallGewichtet(liste) {
  const summe = liste.reduce((s, r) => s + gewicht(r), 0);
  let x = Math.random() * summe;
  for (const r of liste) {
    x -= gewicht(r);
    if (x <= 0) return r;
  }
  return liste[liste.length - 1];
}

function zeigeHeute() {
  document.title = 'Was koche ich heute?';
  if (!S.rezepte.length) {
    app.innerHTML = `
      <header class="kopf"><a class="knopf klein" href="#/">‹ Zurück</a></header>
      <h1>🍳 Was koche ich heute?</h1>
      <div class="leer"><p class="leer-gross">Noch keine Rezepte da.</p>
      <p>Speichere zuerst ein paar Rezepte, dann mache ich dir hier Vorschläge.</p>
      <a class="knopf breit" href="#/neu">+ Rezept speichern</a></div>`;
    return;
  }
  const rest = weitereKats();
  const restOffen = rest.some((k) => heute.kats.has(k.id));
  app.innerHTML = `
    <header class="kopf"><a class="knopf klein" href="#/">‹ Zurück</a></header>
    <h1>🍳 Was koche ich heute?</h1>
    <p class="leise">Alles ist freiwillig. Tippe an, worauf du Lust hast – oder gleich unten auf „Vorschlag zeigen“.</p>

    <section class="block">
      <h2>Worauf hast du Lust?</h2>
      <div class="kacheln">${schnellKats().map((k) => kachelHtml(k, heute.kats.has(k.id), 'heuteKat')).join('')}</div>
      <details class="mehr" ${restOffen ? 'open' : ''}>
        <summary class="knopf breit">Mehr Kategorien</summary>
        <div class="chips umbruch">
          ${rest.map((k) => `<button type="button" class="chip" data-a="heuteKat" data-id="${k.id}" aria-pressed="${heute.kats.has(k.id)}">${esc(katLabel(k))}</button>`).join('')}
        </div>
      </details>
    </section>

    <section class="block">
      <h2>Wie soll es sein?</h2>
      <div class="chips umbruch">
        ${tagsSortiert().map((t) => `<button type="button" class="chip" data-a="heuteTag" data-id="${t.id}" aria-pressed="${heute.tags.has(t.id)}">${esc(t.name)}</button>`).join('')}
      </div>
    </section>

    <section class="block">
      <label class="schalter-zeile"><span>⭐ Nur Favoriten</span>
        <input type="checkbox" class="schalter" id="h-fav" ${heute.nurFav ? 'checked' : ''}></label>
    </section>

    <button type="button" class="knopf gross primaer" data-a="vorschlag">Vorschlag zeigen</button>
    <div id="ergebnis" class="ergebnis" aria-live="polite"></div>`;

  $('#h-fav').addEventListener('change', (e) => { heute.nurFav = e.target.checked; auswahlGeaendert(); });

  const r = heute.aktuell && rezeptVon(heute.aktuell);
  if (r && passtZuAuswahl(r, heute)) zeigeVorschlagKarte(r, false);
}

function auswahlGeaendert() {
  heute.verlauf = [];
  heute.aktuell = null;
  $('#ergebnis').innerHTML = '';
}

A.heuteKat = (el) => {
  const id = el.dataset.id;
  if (heute.kats.has(id)) heute.kats.delete(id); else heute.kats.add(id);
  el.setAttribute('aria-pressed', heute.kats.has(id));
  auswahlGeaendert();
};
A.heuteTag = (el) => {
  const id = el.dataset.id;
  if (heute.tags.has(id)) heute.tags.delete(id); else heute.tags.add(id);
  el.setAttribute('aria-pressed', heute.tags.has(id));
  auswahlGeaendert();
};

A.vorschlag = () => {
  let pool = S.rezepte.filter((r) => passtZuAuswahl(r, heute));
  const box = $('#ergebnis');
  if (!pool.length) {
    box.innerHTML = `<div class="hinweis"><p><b>Dazu habe ich nichts gefunden.</b> Nimm eine Auswahl raus.</p></div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const nichtKuerzlich = pool.filter((r) => !r.zuletztGekocht || tageSeit(r.zuletztGekocht) >= 3);
  if (nichtKuerzlich.length) pool = nichtKuerzlich;

  if (pool.length === 1 && heute.aktuell === pool[0].id) {
    toast('Dazu gibt es nur dieses eine Rezept');
    return;
  }
  // Die letzten Vorschläge nicht gleich wiederholen (bei wenigen Rezepten nur den letzten),
  // sonst rein nach Gewicht: lange nicht Gekochtes kommt häufiger.
  const sperre = Math.min(3, Math.floor((pool.length - 1) / 2)) || (pool.length > 1 ? 1 : 0);
  const zuletzt = new Set(heute.verlauf.slice(-sperre));
  if (heute.aktuell && pool.length > 1) zuletzt.add(heute.aktuell);
  let kandidaten = pool.filter((r) => !zuletzt.has(r.id));
  if (!kandidaten.length) kandidaten = pool;
  const r = zufallGewichtet(kandidaten);
  heute.verlauf.push(r.id);
  if (heute.verlauf.length > 10) heute.verlauf.shift();
  heute.aktuell = r.id;
  zeigeVorschlagKarte(r, true);
};

function zeigeVorschlagKarte(r, scrollen) {
  const kats = r.kategorien.map(kat).filter(Boolean).map(katLabel).join(' · ');
  const box = $('#ergebnis');
  box.innerHTML = `
    <div class="vorschlag-karte">
      <p class="leise">Wie wäre es mit …</p>
      <h2 class="vorschlag-name">${esc(r.name)}${r.favorit ? ' ⭐' : ''}</h2>
      <p>${esc(kats)}</p>
      <p class="leise">${r.zuletztGekocht ? `Zuletzt gekocht: ${vorWann(r.zuletztGekocht)}` : 'Noch nie gekocht'}</p>
      <a class="knopf gross primaer" href="#/rezept/${esc(r.id)}">Nehm ich!</a>
      <button type="button" class="knopf gross" data-a="vorschlag">Anderer Vorschlag</button>
    </div>`;
  if (scrollen) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ */
/* Einstellungen                                                       */
/* ------------------------------------------------------------------ */

function zeigeEinstellungen() {
  document.title = 'Einstellungen';
  const letztes = S.meta.letztesBackup;
  app.innerHTML = `
    <header class="kopf"><a class="knopf klein" href="#/">‹ Zurück</a></header>
    <h1>⚙️ Einstellungen</h1>

    <section class="block menue">
      <a class="knopf gross" href="#/einstellungen/kategorien">📂 Kategorien verwalten</a>
      <a class="knopf gross" href="#/einstellungen/tags">🏷️ Tags verwalten</a>
      <a class="knopf gross" href="#/hilfe">❓ Hilfe &amp; Anleitungen</a>
    </section>

    <section class="block">
      <h2>💾 Backup</h2>
      <p>Ein Backup ist eine Sicherheitskopie all deiner Rezepte. Speichere sie in „Dateien“ oder schick sie dir per WhatsApp selbst.</p>
      <p><b>Letztes Backup:</b> ${letztes ? `${datumText(letztes)} (${vorWann(letztes)})` : 'noch nie'}</p>
      <div class="menue">
        <button type="button" class="knopf gross primaer" data-a="backupExport">📤 Backup exportieren</button>
        <label class="knopf gross">📥 Backup importieren
          <input type="file" id="import-datei" class="unsichtbar" accept=".json,application/json"></label>
      </div>
    </section>

    <section class="block">
      <h2>ℹ️ Info</h2>
      <ul class="info-liste">
        <li>${S.rezepte.length} ${S.rezepte.length === 1 ? 'Rezept' : 'Rezepte'} gespeichert</li>
        <li id="speicher-info">Speicher wird geprüft …</li>
        <li>Version ${VERSION}</li>
      </ul>
    </section>`;

  $('#import-datei').addEventListener('change', async (e) => {
    const datei = e.target.files && e.target.files[0];
    e.target.value = '';
    if (datei) {
      try { await backupImport(datei); } catch (err) {
        console.error(err);
        info('Import hat nicht geklappt', String(err && err.message || err));
      }
    }
  });

  const si = $('#speicher-info');
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then((ok) => {
      si.textContent = ok ? '✓ Rezepte sind dauerhaft auf dem iPhone gespeichert' : 'Rezepte sind auf diesem Gerät gespeichert';
    }).catch(() => { si.textContent = 'Rezepte sind auf diesem Gerät gespeichert'; });
  } else {
    si.textContent = 'Rezepte sind auf diesem Gerät gespeichert';
  }
}

function backupDaten() {
  return {
    app: 'mamas-kueche',
    format: 1,
    version: VERSION,
    exportiertAm: jetzt(),
    rezepte: S.rezepte,
    kategorien: S.kategorien,
    tags: S.tags
  };
}

A.backupExport = async () => {
  // Wichtig: navigator.share muss direkt im Klick passieren (ohne vorheriges await).
  const json = JSON.stringify(backupDaten(), null, 2);
  const name = `Mamas-Kueche-Backup-${heuteIso()}.json`;
  let datei = null;
  try { datei = new File([json], name, { type: 'application/json' }); } catch { datei = null; }

  if (datei && navigator.canShare && navigator.canShare({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: 'Backup Mamas Küche' });
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      herunterladen(json, name);
    }
  } else {
    herunterladen(json, name);
  }
  await setMeta('letztesBackup', jetzt());
  toast('Backup erstellt ✓');
  if (aktuelleRoute.startsWith('#/einstellungen')) zeigeEinstellungen();
  else if (istStartRoute(aktuelleRoute)) zeigeStart();
};

function herunterladen(json, name) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const str = (v, d = '') => (typeof v === 'string' ? v : v == null ? d : String(v));
function normRezept(r) {
  const link = str(r.link);
  return {
    id: str(r.id) || uuid(),
    name: str(r.name) || 'Ohne Namen',
    link,
    quelle: ['instagram', 'tiktok', 'sonstige'].includes(r.quelle) ? r.quelle : quelleVon(link),
    kategorien: Array.isArray(r.kategorien) ? r.kategorien.map((x) => str(x)) : [],
    tags: Array.isArray(r.tags) ? r.tags.map((x) => str(x)) : [],
    notiz: str(r.notiz),
    rezepttext: str(r.rezepttext),
    favorit: !!r.favorit,
    erstelltAm: str(r.erstelltAm) || jetzt(),
    zuletztGekocht: r.zuletztGekocht ? str(r.zuletztGekocht) : null,
    malGekocht: Number(r.malGekocht) || 0
  };
}
function normKategorie(k, i) {
  return {
    id: str(k.id) || uuid(),
    name: str(k.name) || 'Ohne Namen',
    emoji: str(k.emoji),
    sortierung: Number.isFinite(Number(k.sortierung)) ? Number(k.sortierung) : i,
    istStandard: !!k.istStandard,
    istSchnellwahl: !!k.istSchnellwahl
  };
}
const normTag = (t) => ({ id: str(t.id) || uuid(), name: str(t.name) || 'Ohne Namen' });

async function backupImport(datei) {
  let daten;
  try { daten = JSON.parse(await datei.text()); } catch { daten = null; }
  if (!daten || !Array.isArray(daten.rezepte) || !Array.isArray(daten.kategorien)) {
    await info('Das ist kein Backup', 'Diese Datei ist kein gültiges Backup von „Mamas Küche“.');
    return;
  }
  const rezepte = daten.rezepte.filter((r) => r && typeof r === 'object').map(normRezept);
  const kategorien = daten.kategorien.filter((k) => k && typeof k === 'object').map(normKategorie);
  const tags = (Array.isArray(daten.tags) ? daten.tags : []).filter((t) => t && typeof t === 'object').map(normTag);

  const wahl = await dialog({
    titel: 'Backup importieren',
    text: `Im Backup sind ${rezepte.length} Rezepte${daten.exportiertAm ? ` (gesichert am ${datumText(daten.exportiertAm)})` : ''}.`,
    html: `<p><b>Zusammenführen:</b> Die Rezepte aus dem Backup kommen dazu. Deine jetzigen bleiben.</p>
           <p><b>Ersetzen:</b> Alles Jetzige wird gelöscht und durch das Backup ersetzt.</p>`,
    knoepfe: [
      { label: 'Zusammenführen', wert: 'zusammen', art: 'primaer' },
      { label: 'Ersetzen', wert: 'ersetzen', art: 'gefahr-rand' },
      { label: 'Abbrechen', wert: null }
    ]
  });
  if (!wahl.wert) return;

  if (wahl.wert === 'ersetzen') {
    const ok = await frage('Wirklich ersetzen?', `Deine ${S.rezepte.length} jetzigen Rezepte werden gelöscht und durch die ${rezepte.length} Rezepte aus dem Backup ersetzt.`, 'Ja, ersetzen', 'gefahr');
    if (!ok) return;
    await db.schreiben([
      { clear: 'rezepte' }, { clear: 'kategorien' }, { clear: 'tags' },
      ...kategorien.map((k) => ({ store: 'kategorien', put: k })),
      ...tags.map((t) => ({ store: 'tags', put: t })),
      ...rezepte.map((r) => ({ store: 'rezepte', put: r }))
    ]);
    await allesNeuLaden();
    toast('Backup eingespielt ✓');
    zeigeEinstellungen();
    await info('Fertig', `${rezepte.length} Rezepte wurden aus dem Backup übernommen.`);
    return;
  }

  // Zusammenführen
  const ops = [];
  const katMap = new Map();
  let maxSort = Math.max(-1, ...S.kategorien.map((k) => k.sortierung));
  for (const k of kategorien) {
    const gleicheId = kat(k.id);
    const gleicherName = S.kategorien.find((x) => normalisiere(x.name) === normalisiere(k.name));
    if (gleicheId) katMap.set(k.id, k.id);
    else if (gleicherName) katMap.set(k.id, gleicherName.id);
    else {
      const neu = { ...k, sortierung: ++maxSort };
      katMap.set(k.id, k.id);
      ops.push({ store: 'kategorien', put: neu });
    }
  }
  const tagMap = new Map();
  for (const t of tags) {
    const gleicheId = tag(t.id);
    const gleicherName = S.tags.find((x) => normalisiere(x.name) === normalisiere(t.name));
    if (gleicheId) tagMap.set(t.id, t.id);
    else if (gleicherName) tagMap.set(t.id, gleicherName.id);
    else { tagMap.set(t.id, t.id); ops.push({ store: 'tags', put: t }); }
  }
  const vorhandeneLinks = new Set(S.rezepte.map((r) => linkSchluessel(r.link)));
  let neu = 0;
  let doppelt = 0;
  for (const r of rezepte) {
    if (rezeptVon(r.id) || vorhandeneLinks.has(linkSchluessel(r.link))) { doppelt++; continue; }
    vorhandeneLinks.add(linkSchluessel(r.link));
    ops.push({
      store: 'rezepte',
      put: {
        ...r,
        kategorien: [...new Set(r.kategorien.map((id) => katMap.get(id)).filter(Boolean))],
        tags: [...new Set(r.tags.map((id) => tagMap.get(id)).filter(Boolean))]
      }
    });
    neu++;
  }
  await db.schreiben(ops);
  await allesNeuLaden();
  toast('Backup eingespielt ✓');
  zeigeEinstellungen();
  await info('Fertig', `${neu} ${neu === 1 ? 'Rezept' : 'Rezepte'} hinzugefügt.${doppelt ? ` ${doppelt} waren schon da und wurden übersprungen.` : ''}`);
}

/* ------------------------------------------------------------------ */
/* Kategorien verwalten                                                */
/* ------------------------------------------------------------------ */

function zeigeKategorienVerwalten() {
  document.title = 'Kategorien';
  const y = window.scrollY;
  const z = zaehleKategorien();
  const zeile = (k, i, liste) => `
    <div class="zeile">
      <button type="button" class="stern-knopf" data-a="katStern" data-id="${k.id}" aria-pressed="${k.istSchnellwahl}"
        aria-label="${k.istSchnellwahl ? 'Aus der Schnellwahl nehmen' : 'Zur Schnellwahl hinzufügen'}">${k.istSchnellwahl ? '★' : '☆'}</button>
      <button type="button" class="zeile-name" data-a="katBearbeiten" data-id="${k.id}">${esc(katLabel(k))} <span class="leise">(${z[k.id] || 0})</span></button>
      <button type="button" class="pfeil" data-a="katHoch" data-id="${k.id}" aria-label="Nach oben" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button type="button" class="pfeil" data-a="katRunter" data-id="${k.id}" aria-label="Nach unten" ${i === liste.length - 1 ? 'disabled' : ''}>▼</button>
    </div>`;
  const schnell = schnellKats();
  const rest = weitereKats();
  app.innerHTML = `
    <header class="kopf"><a class="knopf klein" href="#/einstellungen">‹ Zurück</a></header>
    <h1>📂 Kategorien</h1>
    <p class="leise">Tippe auf den <b>Stern</b>, damit eine Kategorie ganz vorne steht. Tippe auf den <b>Namen</b> zum Umbenennen oder Löschen. Mit <b>▲ ▼</b> änderst du die Reihenfolge.</p>
    <section class="block">
      <h2>★ Schnellwahl (ganz vorne)</h2>
      ${schnell.length ? schnell.map(zeile).join('') : '<p class="leise">Noch keine. Tippe unten bei einer Kategorie auf den Stern ☆.</p>'}
    </section>
    <section class="block">
      <h2>Weitere Kategorien</h2>
      ${rest.map(zeile).join('')}
    </section>
    <button type="button" class="knopf gross" data-a="katNeu">+ Neue Kategorie</button>`;
  window.scrollTo(0, y);
}

async function reihenfolgeSpeichern(schnell, rest) {
  const alle = [...schnell, ...rest];
  const geaendert = [];
  alle.forEach((k, i) => {
    if (k.sortierung !== i) geaendert.push({ ...k, sortierung: i });
  });
  await kategorienSpeichern(geaendert);
}

A.katStern = async (el) => {
  const k = kat(el.dataset.id);
  if (!k) return;
  let schnell = schnellKats().filter((x) => x.id !== k.id);
  let rest = weitereKats().filter((x) => x.id !== k.id);
  const neu = { ...k, istSchnellwahl: !k.istSchnellwahl };
  if (neu.istSchnellwahl) schnell.push(neu); else rest.unshift(neu);
  await kategorienSpeichern([neu]);
  await reihenfolgeSpeichern(schnell.map((x) => kat(x.id)), rest.map((x) => kat(x.id)));
  toast(neu.istSchnellwahl ? `${k.name} steht jetzt ganz vorne ★` : `${k.name} ist nicht mehr in der Schnellwahl`);
  zeigeKategorienVerwalten();
};

async function verschieben(id, richtung) {
  const k = kat(id);
  if (!k) return;
  const schnell = schnellKats();
  const rest = weitereKats();
  const liste = k.istSchnellwahl ? schnell : rest;
  const i = liste.findIndex((x) => x.id === id);
  const j = i + richtung;
  if (j < 0 || j >= liste.length) return;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  await reihenfolgeSpeichern(schnell, rest);
  zeigeKategorienVerwalten();
}
A.katHoch = (el) => verschieben(el.dataset.id, -1);
A.katRunter = (el) => verschieben(el.dataset.id, 1);
A.katNeu = async () => { if (await neueKategorieDialog()) zeigeKategorienVerwalten(); };

A.katBearbeiten = async (el) => {
  const k = kat(el.dataset.id);
  if (!k) return;
  const r = await dialog({
    titel: 'Kategorie bearbeiten',
    felder: [
      { name: 'name', label: 'Name', wert: k.name, maxlength: 40 },
      { name: 'emoji', label: 'Bildchen (freiwillig)', wert: k.emoji, maxlength: 8 }
    ],
    knoepfe: [
      { label: 'Speichern', wert: 'speichern', art: 'primaer' },
      { label: 'Kategorie löschen', wert: 'loeschen', art: 'gefahr-rand' },
      { label: 'Abbrechen', wert: null }
    ]
  });
  if (r.wert === 'speichern') {
    const name = r.werte.name;
    if (!name) { toast('Der Name darf nicht leer sein'); return; }
    const andere = S.kategorien.find((x) => x.id !== k.id && normalisiere(x.name) === normalisiere(name));
    if (andere) { await info('Gibt es schon', `Eine Kategorie „${andere.name}“ gibt es schon.`); return; }
    await kategorienSpeichern([{ ...k, name, emoji: r.werte.emoji }]);
    toast('Gespeichert ✓');
    zeigeKategorienVerwalten();
  } else if (r.wert === 'loeschen') {
    const anzahl = S.rezepte.filter((x) => x.kategorien.includes(k.id)).length;
    const ok = await frage(`„${k.name}“ löschen?`,
      anzahl ? `${anzahl} ${anzahl === 1 ? 'Rezept hat' : 'Rezepte haben'} diese Kategorie. Die Rezepte bleiben erhalten, nur die Kategorie wird bei ihnen entfernt.` : 'Kein Rezept hat diese Kategorie.',
      'Ja, löschen', 'gefahr');
    if (!ok) return;
    const betroffen = S.rezepte.filter((x) => x.kategorien.includes(k.id)).map((x) => ({ ...x, kategorien: x.kategorien.filter((id) => id !== k.id) }));
    await db.schreiben([{ store: 'kategorien', del: k.id }, ...betroffen.map((x) => ({ store: 'rezepte', put: x }))]);
    S.kategorien = S.kategorien.filter((x) => x.id !== k.id);
    for (const b of betroffen) S.rezepte[S.rezepte.findIndex((x) => x.id === b.id)] = b;
    start.kats.delete(k.id);
    heute.kats.delete(k.id);
    toast('Kategorie gelöscht');
    zeigeKategorienVerwalten();
  }
};

/* ------------------------------------------------------------------ */
/* Tags verwalten                                                      */
/* ------------------------------------------------------------------ */

function zeigeTagsVerwalten() {
  document.title = 'Tags';
  const y = window.scrollY;
  const z = {};
  for (const r of S.rezepte) for (const id of r.tags) z[id] = (z[id] || 0) + 1;
  app.innerHTML = `
    <header class="kopf"><a class="knopf klein" href="#/einstellungen">‹ Zurück</a></header>
    <h1>🏷️ Tags</h1>
    <p class="leise">Tags beschreiben, <i>wie</i> ein Rezept ist – z. B. „schnell“ oder „Airfryer“. Tippe auf einen Tag zum Umbenennen oder Löschen.</p>
    <section class="block">
      ${tagsSortiert().map((t) => `<div class="zeile"><button type="button" class="zeile-name" data-a="tagBearbeiten" data-id="${t.id}">🏷️ ${esc(t.name)} <span class="leise">(${z[t.id] || 0})</span></button></div>`).join('') || '<p class="leise">Noch keine Tags.</p>'}
    </section>
    <button type="button" class="knopf gross" data-a="tagNeu">+ Neuer Tag</button>`;
  window.scrollTo(0, y);
}

A.tagNeu = async () => { if (await neuerTagDialog()) zeigeTagsVerwalten(); };
A.tagBearbeiten = async (el) => {
  const t = tag(el.dataset.id);
  if (!t) return;
  const r = await dialog({
    titel: 'Tag bearbeiten',
    felder: [{ name: 'name', label: 'Name', wert: t.name, maxlength: 30 }],
    knoepfe: [
      { label: 'Speichern', wert: 'speichern', art: 'primaer' },
      { label: 'Tag löschen', wert: 'loeschen', art: 'gefahr-rand' },
      { label: 'Abbrechen', wert: null }
    ]
  });
  if (r.wert === 'speichern') {
    if (!r.werte.name) { toast('Der Name darf nicht leer sein'); return; }
    const andere = S.tags.find((x) => x.id !== t.id && normalisiere(x.name) === normalisiere(r.werte.name));
    if (andere) { await info('Gibt es schon', `Einen Tag „${andere.name}“ gibt es schon.`); return; }
    const neu = { ...t, name: r.werte.name };
    await db.schreiben([{ store: 'tags', put: neu }]);
    S.tags[S.tags.findIndex((x) => x.id === t.id)] = neu;
    toast('Gespeichert ✓');
    zeigeTagsVerwalten();
  } else if (r.wert === 'loeschen') {
    const ok = await frage(`„${t.name}“ löschen?`, 'Die Rezepte bleiben erhalten, nur der Tag wird bei ihnen entfernt.', 'Ja, löschen', 'gefahr');
    if (!ok) return;
    const betroffen = S.rezepte.filter((x) => x.tags.includes(t.id)).map((x) => ({ ...x, tags: x.tags.filter((id) => id !== t.id) }));
    await db.schreiben([{ store: 'tags', del: t.id }, ...betroffen.map((x) => ({ store: 'rezepte', put: x }))]);
    S.tags = S.tags.filter((x) => x.id !== t.id);
    for (const b of betroffen) S.rezepte[S.rezepte.findIndex((x) => x.id === b.id)] = b;
    heute.tags.delete(t.id);
    toast('Tag gelöscht');
    zeigeTagsVerwalten();
  }
};

/* ------------------------------------------------------------------ */
/* Hilfe                                                               */
/* ------------------------------------------------------------------ */

function zeigeHilfe() {
  document.title = 'Hilfe';
  const zurueck = vorherigeRoute.startsWith('#/einstellungen') ? '#/einstellungen' : '#/';
  app.innerHTML = `
    <header class="kopf"><a class="knopf klein" href="${zurueck}">‹ Zurück</a></header>
    <h1>❓ Hilfe</h1>
    ${hilfeHtml({ adresse: location.origin + location.pathname })}`;
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

async function init() {
  try {
    await allesNeuLaden();
    if (!S.meta.eingerichtet) await einrichten();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="hinweis warnung"><p><b>Die Rezepte konnten nicht geladen werden.</b></p>
      <p>Bitte schließe die App ganz und öffne sie noch einmal.</p><p class="leise">${esc(err && err.message || err)}</p></div>`;
    return;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  window.addEventListener('hashchange', route);
  route();
}

// Für Tests in der Konsole
window.__rezeptbox = { S, gliedereRezept, zerlegeEinfuegeText, namensVorschlag };

init();
