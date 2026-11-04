// Links erkennen und Rezepttexte ordnen – alles offline, ohne KI, mit einfachen Regeln.

/* ------------------------------------------------------------------ */
/* Suche                                                               */
/* ------------------------------------------------------------------ */

/** Für die Suche: klein, ä→ae, ß→ss, Akzente weg. */
export function normalisiere(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Zweite Schreibweise ohne Umlaute (ä→a), damit auch "kase" "Käse" findet. */
export function normalisiereEinfach(s) {
  return String(s || '').toLowerCase().replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

function mitSchema(s) {
  s = String(s || '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '');
}

function hostVon(link) {
  try { return new URL(mitSchema(link)).hostname.toLowerCase(); } catch { return ''; }
}

export function quelleVon(link) {
  const h = hostVon(link);
  if (/(^|\.)instagram\.com$/.test(h) || /(^|\.)instagr\.am$/.test(h)) return 'instagram';
  if (/(^|\.)tiktok\.com$/.test(h)) return 'tiktok';
  return 'sonstige';
}

export function istLink(s) {
  s = String(s || '').trim();
  if (!s || /\s/.test(s)) return false;
  try {
    const u = new URL(mitSchema(s));
    return /^https?:$/.test(u.protocol) && /\.[a-z]{2,}$/i.test(u.hostname);
  } catch { return false; }
}

/** Macht aus einem Link eine saubere Form (https, ohne Tracking-Anhang bei Instagram/TikTok). */
export function bereinigeLink(s) {
  const roh = mitSchema(s);
  if (!roh) return '';
  try {
    const u = new URL(roh);
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (quelleVon(roh) !== 'sonstige') { u.search = ''; u.hash = ''; }
    return u.toString();
  } catch { return roh; }
}

/** Schlüssel, um doppelte Rezepte zu erkennen (Reel- und Post-Links desselben Beitrags sind gleich). */
export function linkSchluessel(link) {
  try {
    const u = new URL(mitSchema(link));
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    const pfad = u.pathname.replace(/\/+$/, '');
    if (/instagram\.com$|instagr\.am$/.test(host)) {
      const m = pfad.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
      if (m) return 'ig:' + m[1];
    }
    if (/tiktok\.com$/.test(host)) {
      const m = pfad.match(/\/(?:video|photo)\/(\d+)/);
      if (m) return 'tt:' + m[1];
    }
    return host + pfad;
  } catch {
    return String(link || '').trim();
  }
}

/* ------------------------------------------------------------------ */
/* Text aus der Zwischenablage                                         */
/* ------------------------------------------------------------------ */

export function entitaetenDekodieren(s) {
  s = String(s || '');
  if (!/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(s)) return s;
  if (typeof document === 'undefined') return s;
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
}

/** Säubert die abgerufene Beschreibung (HTML-Zeichen, Instagram-Vorspann "123 likes … on …: "). */
export function bereinigeCaption(t) {
  t = entitaetenDekodieren(String(t || '')).replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim();
  const m = t.match(/^[^\n]{0,300}?\s(?:on|am)\s[^\n:]{3,40}?\d{4}\s*:\s*["“„]/);
  if (m) t = t.slice(m[0].length).replace(/["”“]\s*\.?\s*$/, '').trim();
  t = t.replace(/^(?:schau dir|check out)[^\n]*(?:tiktok|video)[^\n]*$/gim, '').trim();
  return t;
}

const LINK_RE = /https?:\/\/[^\s"'<>]+|(?:www\.)?(?:instagram\.com|instagr\.am|(?:vm\.|vt\.|www\.|m\.)?tiktok\.com)\/[^\s"'<>]+/i;

/**
 * Zerlegt eingefügten Text in Link und Beschreibung.
 * Funktioniert mit dem Kurzbefehl-Format ("#rezeptbox", Link, Text) und mit einem nackten Link.
 */
export function zerlegeEinfuegeText(raw) {
  let t = String(raw || '').replace(/\r\n?/g, '\n');
  t = t.replace(/^\s*#rezeptbox[^\n]*\n?/i, '');
  const m = t.match(LINK_RE);
  if (!m) return { link: '', text: bereinigeCaption(t) };
  const link = bereinigeLink(m[0].replace(/[),.;!?…]+$/, ''));
  let rest = t.slice(0, m.index) + '\n' + t.slice(m.index + m[0].length);
  rest = bereinigeCaption(rest);
  if (rest.replace(/[^\p{L}\p{N}]/gu, '').length < 3) rest = '';
  return { link, text: rest };
}

/* ------------------------------------------------------------------ */
/* Rezepttext säubern                                                  */
/* ------------------------------------------------------------------ */

const FLOSKELN = [
  /link\s+(ist\s+)?in\s+(der\s+|meiner\s+|unserer\s+)?bio/i,
  /speicher(e|t|n)?\s+(dir|euch)\s+(das|dieses|den|die)?\s*(rezept|video|beitrag|reel|post)/i,
  /(rezept|video|beitrag|reel|post)\s+(jetzt\s+)?speichern/i,
  /speichern\s+nicht\s+vergessen/i,
  /\bsave\s+(this|it|for later|the recipe)/i,
  /folg(e|t)\s+(mir|uns)/i,
  /\bfollow\s+(me|us|for)/i,
  /teil(e|t)?\s+(das|dieses|es)\s+(rezept|video)?\s*(mit|gerne)/i,
  /schreib(t)?\s+(mir|es|uns)?\s*(gerne\s+)?(in\s+)?die\s+kommentare/i,
  /lass(t)?\s+(mir|uns)?\s*(gerne\s+)?(ein(en)?\s+)?(like|kommentar|herz)/i,
  /^(unbezahlte\s+)?(werbung|anzeige)\b/i,
  /markier(e|t)?\s+(jemanden|eine|einen|deine|deinen)/i,
  /\btag\s+(a friend|someone)/i,
  /mehr\s+rezepte\s+(findest|gibt|auf|im)/i,
  /kochbuch.{0,30}(bio|link)/i,
];

const HAT_INHALT = /[\p{L}\p{N}]/u;

/** Entfernt Hashtags, @-Erwähnungen und typische Floskeln. Absätze bleiben erhalten. */
export function bereinigeText(raw) {
  const t = String(raw || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  const zeilen = t.split('\n').map((z) => {
    let s = z.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, ' ').replace(/(^|\s)@[\w.]+/g, ' ');
    s = s.replace(/[ \t]{2,}/g, ' ').trim();
    if (!HAT_INHALT.test(s)) return '';
    if (s.length < 140 && FLOSKELN.some((re) => re.test(s))) return '';
    return s;
  });
  return zeilen.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Wenn alles in einer Zeile steht: Zeilenumbrüche vor Überschriften, Aufzählungen und Nummern einfügen. */
function vorstrukturieren(t) {
  return t
    .replace(/\s*\b(zutaten|zubereitung|so geht'?s|anleitung|du brauchst|ingredients|instructions|steps|method)\b\s*(\([^)]*\))?\s*:/gi, '\n$1$2:\n')
    .replace(/\s+(?=[-•▪◦‣✅✔➡👉🔸🔹▶]️?\s)/gu, '\n')
    .replace(/\s+(?=\d{1,2}[.)]\s+[\p{Lu}\d])/gu, '\n')
    .replace(/\s*(?=(?:[1-9]️?⃣|🔟))/gu, '\n');
}

/* ------------------------------------------------------------------ */
/* Rezepttext gliedern                                                 */
/* ------------------------------------------------------------------ */

const RE_ZUTATEN = /^(?:die\s+)?(?:zutaten(?:liste)?|du brauchst|ihr braucht|was du brauchst|das brauchst du(?: dafür)?|einkaufsliste|ingredients|you(?:'ll)? need)\b/i;
const RE_SCHRITTE = /^(?:zubereitung|so geht'?s|so gehts|so geht es|und so geht'?s|anleitung|steps|instructions|method|directions|preparation|schritte|so wird'?s gemacht|so machst du'?s|so machst du es|how to make it)\b/i;

const EINHEITEN = [
  'g', 'gr', 'gramm', 'kg', 'mg', 'ml', 'l', 'liter', 'cl', 'dl',
  'el', 'tl', 'essl', 'teel', 'esslöffel', 'teelöffel', 'msp', 'messerspitze',
  'prise', 'prisen', 'stück', 'stk', 'dose', 'dosen', 'pck', 'pkg', 'pkt', 'päckchen', 'packung', 'packungen',
  'zehe', 'zehen', 'bund', 'becher', 'tasse', 'tassen', 'scheibe', 'scheiben', 'handvoll', 'glas', 'gläser',
  'würfel', 'zweig', 'zweige', 'blatt', 'blätter', 'spritzer', 'schuss', 'tropfen', 'kopf', 'stange', 'stangen',
  'knolle', 'knollen', 'beutel', 'tüte', 'rolle', 'portion', 'portionen',
  'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'lbs', 'pinch', 'clove', 'cloves', 'can'
].join('|');

const RE_MENGE = new RegExp(
  `(?:^|[\\s(])(?:\\d+(?:[.,/]\\d+)?|[½¼¾⅓⅔⅛]|\\d+\\s*[½¼¾])\\s*(?:-\\s*\\d+(?:[.,]\\d+)?\\s*)?(?:${EINHEITEN})\\.?(?=[\\s,.)/]|$)`,
  'iu'
);
const RE_ZAHL_WORT = /^(?:\d+(?:[.,/]\d+)?|[½¼¾⅓⅔]|eine?[nr]?|zwei|drei|vier|fünf|etwas|salz|pfeffer)\s+\p{L}/iu;
const RE_AUFZAEHLUNG = /^\s*(?:[-–—•·*▪▫◦‣○●✓✔☑✅➤➡→👉🔸🔹▶]|\p{Extended_Pictographic})/u;
const RE_AUFZ_ENTFERNEN = /^\s*[-–—•·*▪▫◦‣○●✓✔☑✅➤➡→👉🔸🔹▶]️?\s*/u;
const RE_SCHRITT = /^\s*(?:(?:schritt|step)\s*\d+\s*[:.)-]?|\d{1,2}\s*[.)](?!\d)|\d️?⃣|🔟)/iu;

function ohneNummer(z) { return z.replace(RE_SCHRITT, '').replace(/^[\s:.)\-–]+/, '').trim(); }
function ohneAufzaehlung(z) { return z.replace(RE_AUFZ_ENTFERNEN, '').trim(); }
function istSchrittZeile(z) { return RE_SCHRITT.test(z); }

function istMengenZeile(z) {
  const o = ohneAufzaehlung(ohneNummer(z));
  if (o.length <= 90 && RE_MENGE.test(' ' + o)) return true;
  if (o.length <= 50 && RE_ZAHL_WORT.test(o) && !/[.!?]$/.test(o)) return true;
  return false;
}

function istGruppenZeile(z) {
  return /:$/.test(z) && z.length <= 45 && !RE_MENGE.test(' ' + z);
}

function saetzeTeilen(t) {
  return t.replace(/([.!?])\s+(?=[A-ZÄÖÜ])/g, '$1\n').split('\n').map((s) => s.trim()).filter(Boolean);
}

function kopfInfo(zeile) {
  const k = zeile.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  let modus = null;
  let m = k.match(RE_ZUTATEN);
  if (m) modus = 'zutaten';
  else if ((m = k.match(RE_SCHRITTE))) modus = 'schritte';
  if (!modus) return null;
  const nach = k.slice(m[0].length);
  const fuer = nach.match(/^\s*(?:für|for)\s+(?!\d)([^:(]{2,30})/i);
  const label = modus === 'zutaten' && fuer ? 'Für ' + fuer[1].trim() : '';
  const dp = nach.match(/^\s*(?:\([^)]*\)|(?:für|for)\s[^:]{0,40})?\s*:\s*(.*)$/i);
  if (dp) return { modus, rest: dp[1].trim(), label };
  if (k.length <= 50 && !/[.!?]$/.test(k)) return { modus, rest: '', label };
  return null;
}

/**
 * Gliedert einen Rezepttext in Zutaten und Zubereitung.
 * Rückgabe: { erkannt, intro[], zutaten[{text, gruppe}], schritte[], rest[], sauber }
 */
export function gliedereRezept(raw) {
  let sauber = bereinigeText(raw);
  if (sauber.split('\n').filter(Boolean).length < 4 && sauber.length > 140) {
    sauber = bereinigeText(vorstrukturieren(sauber));
  }

  const intro = [];
  const zutaten = [];
  const schritte = [];
  const rest = [];
  let modus = null;
  let hatUeberschrift = false;
  let letzteWarZutat = false;

  const zutatHinzu = (z) => {
    const kommas = (z.match(/,/g) || []).length;
    const teile = z.split(',').map((s) => s.trim()).filter(Boolean);
    if (kommas >= 2 && !/[.!?]$/.test(z) && teile.every((s) => s.length <= 40)) {
      teile.forEach((s) => zutaten.push({ text: s, gruppe: false }));
    } else {
      zutaten.push({ text: ohneAufzaehlung(z), gruppe: false });
    }
  };

  const verarbeite = (z) => {
    if (modus === 'zutaten') {
      if (istSchrittZeile(z) && !istMengenZeile(z)) {
        modus = 'schritte';
        schritte.push(ohneNummer(z));
        return;
      }
      if (istGruppenZeile(z)) { zutaten.push({ text: z.replace(/:$/, ''), gruppe: true }); return; }
      zutatHinzu(z);
      return;
    }
    if (modus === 'schritte') {
      if (istSchrittZeile(z)) schritte.push(ohneNummer(z));
      else schritte.push(...saetzeTeilen(z));
      return;
    }
    // Noch keine Überschrift gesehen: nach Form der Zeile entscheiden
    if (istSchrittZeile(z) && !istMengenZeile(z)) {
      schritte.push(ohneNummer(z));
      letzteWarZutat = false;
      return;
    }
    if (istMengenZeile(z) || (letzteWarZutat && RE_AUFZAEHLUNG.test(z) && z.length <= 70)) {
      zutatHinzu(z);
      letzteWarZutat = true;
      return;
    }
    if (istGruppenZeile(z) && !schritte.length) {
      zutaten.push({ text: z.replace(/:$/, ''), gruppe: true });
      return;
    }
    letzteWarZutat = false;
    if (schritte.length || (zutaten.some((x) => !x.gruppe) && z.length > 30)) {
      schritte.push(...saetzeTeilen(ohneNummer(z)));
      return;
    }
    if (zutaten.length) { rest.push(z); return; }
    intro.push(z);
  };

  for (const roh of sauber.split('\n')) {
    const z = roh.trim();
    if (!z) continue;
    const kopf = kopfInfo(z);
    if (kopf) {
      modus = kopf.modus;
      hatUeberschrift = true;
      if (kopf.label) zutaten.push({ text: kopf.label, gruppe: true });
      if (kopf.rest) verarbeite(kopf.rest);
      continue;
    }
    verarbeite(z);
  }

  // Gruppen-Überschriften ohne Zutaten danach entfernen
  for (let i = zutaten.length - 1; i >= 0; i--) {
    if (zutaten[i].gruppe && (i === zutaten.length - 1 || zutaten[i + 1].gruppe)) zutaten.splice(i, 1);
  }

  const echteZutaten = zutaten.filter((z) => !z.gruppe).length;
  const erkannt = echteZutaten >= 2 || schritte.length >= 2 ||
    (hatUeberschrift && (echteZutaten > 0 || schritte.length > 0));

  return { erkannt, intro, zutaten, schritte, rest, sauber };
}

/** Schlägt aus der ersten Zeile der Beschreibung einen Rezeptnamen vor. */
export function namensVorschlag(text) {
  const zeilen = bereinigeText(text).split('\n').map((z) => z.trim()).filter(Boolean);
  for (let z of zeilen.slice(0, 4)) {
    z = z.replace(/\s*\b(?:zutaten|zubereitung|du brauchst|ingredients|so geht'?s)\b[\s\S]*$/i, '');
    z = z.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N})!?]+$/u, '').trim();
    if (z.length < 3) continue;
    if (kopfInfo(z) || istMengenZeile(z) || istSchrittZeile(z)) break;
    const satz = z.match(/^.*?[.!?](?=\s|$)/);
    let s = (satz ? satz[0] : z).replace(/[.!]+$/, '').trim();
    if (s.length > 60) s = s.slice(0, 58).replace(/\s+\S*$/, '') + ' …';
    if (s.length >= 3) return s;
  }
  return '';
}
