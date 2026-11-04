// Inhalt der Hilfe-Seite (mit einfachen Skizzen statt Screenshots).

// iCloud-Link zum fertigen Kurzbefehl. Wenn eingetragen, erscheint in der Hilfe ein Knopf zum Laden.
export const KURZBEFEHL_LINK = '';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Skizzen ---------- */

const teilenIcon = (x, y) => `
  <path class="sk-linie" d="M${x - 11} ${y - 4} h-3 v20 h28 v-20 h-3"/>
  <path class="sk-linie" d="M${x} ${y + 8} v-24 M${x - 7} ${y - 9} l7 -7 l7 7"/>`;

const SKIZZE_SAFARI = `
<svg class="skizze" viewBox="0 0 300 120" role="img" aria-label="Skizze: Teilen-Symbol unten in Safari">
  <rect class="sk-flaeche" x="6" y="22" width="288" height="68" rx="16"/>
  <path class="sk-linie" d="M44 48 l-9 9 l9 9"/>
  <path class="sk-linie" d="M88 48 l9 9 l-9 9"/>
  ${teilenIcon(150, 58)}
  <circle class="sk-mark" cx="150" cy="57" r="27"/>
  <rect class="sk-linie" x="197" y="46" width="22" height="22" rx="3"/>
  <circle class="sk-text" cx="252" cy="57" r="2.6"/><circle class="sk-text" cx="262" cy="57" r="2.6"/><circle class="sk-text" cx="272" cy="57" r="2.6"/>
  <text class="sk-leise" x="150" y="112" text-anchor="middle">Teilen-Symbol (manchmal hinter •••)</text>
</svg>`;

const SKIZZE_HOME = `
<svg class="skizze" viewBox="0 0 300 200" role="img" aria-label="Skizze: Menüpunkt Zum Home-Bildschirm">
  <rect class="sk-flaeche" x="6" y="6" width="288" height="188" rx="16"/>
  <rect class="sk-zeile" x="18" y="20" width="264" height="44" rx="10"/>
  <text class="sk-text" x="32" y="47">Kopieren</text>
  <rect class="sk-zeile" x="18" y="74" width="264" height="44" rx="10"/>
  <text class="sk-text" x="32" y="101">Zur Leseliste hinzufügen</text>
  <rect class="sk-zeile" x="18" y="128" width="264" height="44" rx="10"/>
  <text class="sk-text" x="32" y="155">Zum Home-Bildschirm</text>
  <rect class="sk-linie" x="246" y="140" width="20" height="20" rx="4"/>
  <path class="sk-linie" d="M256 145 v10 M251 150 h10"/>
  <rect class="sk-mark" x="13" y="123" width="274" height="54" rx="13"/>
</svg>`;

const SKIZZE_KURZBEFEHL = `
<svg class="skizze" viewBox="0 0 300 220" role="img" aria-label="Skizze: Zur Rezeptbox im Teilen-Menü">
  <rect class="sk-flaeche" x="6" y="6" width="288" height="208" rx="16"/>
  <circle class="sk-zeile" cx="50" cy="44" r="22"/><circle class="sk-zeile" cx="115" cy="44" r="22"/>
  <circle class="sk-zeile" cx="180" cy="44" r="22"/><circle class="sk-zeile" cx="245" cy="44" r="22"/>
  <text class="sk-leise" x="50" y="82" text-anchor="middle">Nachricht</text>
  <text class="sk-leise" x="115" y="82" text-anchor="middle">Mail</text>
  <text class="sk-leise" x="180" y="82" text-anchor="middle">WhatsApp</text>
  <text class="sk-leise" x="245" y="82" text-anchor="middle">Mehr</text>
  <rect class="sk-zeile" x="18" y="100" width="264" height="44" rx="10"/>
  <text class="sk-text" x="32" y="127">Kopieren</text>
  <rect class="sk-zeile" x="18" y="154" width="264" height="44" rx="10"/>
  <text class="sk-text" x="32" y="181">Zur Rezeptbox</text>
  <path class="sk-akzent" d="M256 166 l10 10 l-10 10 l-10 -10 z"/>
  <path class="sk-linie" d="M248 170 l-6 6 l10 10"/>
  <rect class="sk-mark" x="13" y="149" width="274" height="54" rx="13"/>
</svg>`;

const SKIZZE_APP = `
<svg class="skizze" viewBox="0 0 320 230" role="img" aria-label="Skizze: In der App auf Plus Rezept und dann auf Link einfügen tippen">
  <rect class="sk-flaeche" x="6" y="6" width="130" height="218" rx="18"/>
  <text class="sk-text" x="20" y="34">Mamas Küche</text>
  <rect class="sk-zeile" x="18" y="48" width="106" height="26" rx="7"/>
  <rect class="sk-zeile" x="18" y="82" width="106" height="26" rx="7"/>
  <rect class="sk-zeile" x="18" y="116" width="106" height="26" rx="7"/>
  <rect class="sk-akzent" x="52" y="176" width="74" height="34" rx="17"/>
  <text class="sk-akzent-text" x="89" y="198" text-anchor="middle">+ Rezept</text>
  <rect class="sk-mark" x="46" y="170" width="86" height="46" rx="23"/>
  <path class="sk-linie" d="M146 115 h26 M164 107 l8 8 l-8 8"/>
  <text class="sk-leise" x="159" y="98" text-anchor="middle">dann</text>
  <rect class="sk-flaeche" x="184" y="6" width="130" height="218" rx="18"/>
  <text class="sk-text" x="198" y="34">Neues Rezept</text>
  <rect class="sk-dunkel" x="207" y="56" width="84" height="32" rx="9"/>
  <text class="sk-weiss-text" x="249" y="77" text-anchor="middle">Einsetzen</text>
  <path class="sk-dunkel" d="M243 88 h12 l-6 7 z"/>
  <rect class="sk-akzent" x="196" y="100" width="106" height="40" rx="11"/>
  <text class="sk-akzent-text" x="249" y="125" text-anchor="middle" style="font-size:13px">Link einfügen</text>
  <rect class="sk-mark" x="201" y="50" width="96" height="44" rx="12"/>
  <rect class="sk-zeile" x="196" y="152" width="106" height="24" rx="7"/>
  <rect class="sk-zeile" x="196" y="184" width="106" height="24" rx="7"/>
</svg>`;

/* ---------- Seite ---------- */

export function hilfeHtml({ adresse }) {
  return `<div class="hilfe">

  <details open>
    <summary>📥 Rezept aus Instagram oder TikTok speichern</summary>
    <div class="inhalt">
      <p><b>In Instagram:</b></p>
      <ol>
        <li>Tippe beim Rezept-Video auf das <b>Teilen-Symbol</b> (der kleine Papierflieger).</li>
        <li>Wische in der unteren Reihe nach rechts und tippe auf <b>„Teilen …“</b> oder <b>„Mehr“</b>.</li>
        <li>Tippe auf <b>„Zur Rezeptbox“</b>. Warte kurz, bis <b>„Gemerkt!“</b> erscheint.</li>
      </ol>
      <p><b>In TikTok:</b></p>
      <ol>
        <li>Tippe auf <b>Teilen</b> (der Pfeil rechts).</li>
        <li>Wische in der unteren Reihe ganz nach rechts und tippe auf <b>„Mehr“</b> bzw. <b>„Teilen über …“</b>.</li>
        <li>Tippe auf <b>„Zur Rezeptbox“</b>. Warte kurz, bis <b>„Gemerkt!“</b> erscheint.</li>
      </ol>
      ${SKIZZE_KURZBEFEHL}
      <p><b>Danach in Mamas Küche:</b></p>
      <ol>
        <li>Öffne <b>Mamas Küche</b> auf dem Home-Bildschirm.</li>
        <li>Tippe unten rechts auf <b>„+ Rezept“</b>.</li>
        <li>Tippe auf <b>„📋 Link einfügen“</b> und dann auf das kleine schwarze Feld <b>„Einsetzen“</b>.</li>
        <li>Gib einen <b>Namen</b> ein, tippe eine <b>Kategorie</b> an und dann auf <b>„Speichern“</b>. Fertig!</li>
      </ol>
      ${SKIZZE_APP}
      <p class="unterpunkt"><b>Ohne Kurzbefehl geht es auch:</b> In Instagram oder TikTok beim Teilen auf <b>„Link kopieren“</b> tippen, dann in Mamas Küche wie oben auf „+ Rezept“ und „Link einfügen“. Den Rezepttext musst du dann von Hand einfügen (siehe unten).</p>
    </div>
  </details>

  <details>
    <summary>✍️ Rezepttext von Hand einfügen</summary>
    <div class="inhalt">
      <p>Manchmal kann der Text nicht automatisch geholt werden. Das ist normal. So geht's von Hand:</p>
      <ol>
        <li>Öffne den Beitrag in Instagram oder TikTok und tippe auf <b>„mehr“</b>, damit die ganze Beschreibung zu sehen ist.</li>
        <li>Mach einen <b>Screenshot</b> (Seitentaste und Lauter-Taste gleichzeitig drücken).</li>
        <li>Öffne den Screenshot, halte den Finger auf den Text → <b>„Alles auswählen“</b> → <b>„Kopieren“</b>.</li>
        <li>Öffne das Rezept in Mamas Küche → <b>„Bearbeiten“</b> → <b>„📋 Text einfügen“</b> → <b>„Speichern“</b>.</li>
      </ol>
      <p>Die App sortiert den Text dann automatisch in <b>Zutaten</b> und <b>Zubereitung</b>.</p>
    </div>
  </details>

  <details>
    <summary>📲 App auf dem iPhone installieren</summary>
    <div class="inhalt">
      <ol>
        <li>Öffne diese Adresse in <b>Safari</b>:<br><code>${esc(adresse)}</code></li>
        <li>Tippe unten auf das <b>Teilen-Symbol</b> (Viereck mit Pfeil nach oben). Bei neueren iPhones ist es hinter den drei Punkten <b>„•••“</b>.</li>
        <li>Wische nach unten und tippe auf <b>„Zum Home-Bildschirm“</b>.</li>
        <li>Tippe oben rechts auf <b>„Hinzufügen“</b>.</li>
        <li>Öffne die App ab jetzt immer über das neue Symbol <b>„Mamas Küche“</b> auf dem Home-Bildschirm.</li>
      </ol>
      ${SKIZZE_SAFARI}
      ${SKIZZE_HOME}
      <div class="hinweis"><p><b>⚠️ Wichtig:</b> Die Rezepte sind in der App auf dem Home-Bildschirm gespeichert, nicht in Safari. Wenn du das App-Symbol löschst, sind auch die Rezepte weg. Mach deshalb ab und zu ein Backup.</p></div>
    </div>
  </details>

  <details>
    <summary>💾 Backup machen</summary>
    <div class="inhalt">
      <p><b>Sichern:</b></p>
      <ol>
        <li>Tippe auf der Startseite oben rechts auf <b>„⚙️ Einstellungen“</b>.</li>
        <li>Tippe auf <b>„📤 Backup exportieren“</b>.</li>
        <li>Wähle <b>„In Dateien sichern“</b> oder schick die Datei per <b>WhatsApp</b> an dich selbst.</li>
      </ol>
      <p><b>Zurückholen</b> (z. B. auf einem neuen iPhone):</p>
      <ol>
        <li><b>Einstellungen</b> → <b>„📥 Backup importieren“</b>.</li>
        <li>Die Backup-Datei auswählen (in WhatsApp vorher auf die Datei tippen und „In Dateien sichern“).</li>
        <li><b>„Zusammenführen“</b> fügt die Rezepte dazu, <b>„Ersetzen“</b> tauscht alles aus.</li>
      </ol>
      <p class="unterpunkt">Wenn das letzte Backup länger als 30 Tage her ist, erinnert dich die App auf der Startseite daran.</p>
    </div>
  </details>

  <details>
    <summary>🛟 Wenn etwas nicht klappt</summary>
    <div class="inhalt">
      <ul>
        <li><b>„Link einfügen“ tut nichts:</b> Halte den Finger in das Feld darunter und tippe auf <b>„Einsetzen“</b>.</li>
        <li><b>„Zur Rezeptbox“ fehlt im Teilen-Menü:</b> Ganz unten im Teilen-Menü auf <b>„Aktionen bearbeiten“</b> tippen und „Zur Rezeptbox“ hinzufügen.</li>
        <li><b>Der Rezepttext fehlt:</b> Das ist normal, Instagram und TikTok geben ihn oft nicht heraus. Siehe „Rezepttext von Hand einfügen“.</li>
        <li><b>Instagram öffnet sich im Browser statt in der App:</b> Dort oben auf „Öffnen“ bzw. „In App öffnen“ tippen.</li>
      </ul>
    </div>
  </details>

  <details>
    <summary>🔧 Kurzbefehl einrichten (einmalig)</summary>
    <div class="inhalt">
      <p class="unterpunkt">Diesen Teil macht am besten jemand, der sich mit dem iPhone gut auskennt. Er muss nur einmal gemacht werden.</p>
      ${KURZBEFEHL_LINK ? `<a class="knopf gross primaer" href="${esc(KURZBEFEHL_LINK)}" target="_blank" rel="noopener">Fertigen Kurzbefehl laden</a>
        <p class="unterpunkt">Link öffnen → „Kurzbefehl hinzufügen“. Danach sind die Schritte unten schon erledigt.</p>` : ''}
      <p>Der Kurzbefehl holt Link und Beschreibung und legt beides in die Zwischenablage. Die App holt sich das dann mit „Link einfügen“.</p>
      <ol>
        <li>App <b>Kurzbefehle</b> öffnen → oben rechts <b>„+“</b>.</li>
        <li>Oben auf den Namen tippen → <b>Umbenennen</b> → <code>Zur Rezeptbox</code>.</li>
        <li>Unten auf <b>ⓘ</b> (Details) → <b>„Im Share-Sheet anzeigen“</b> einschalten → Fertig.</li>
        <li>Aktion <b>URLs aus Eingabe abrufen</b> hinzufügen (Suche: „URLs“). Eingabe: <i>Kurzbefehleingabe</i>.</li>
        <li><b>Objekt aus Liste abrufen</b> → „Erstes Objekt“.</li>
        <li><b>Variable festlegen</b> → Name <code>Link</code>.</li>
        <li><b>In Zwischenablage kopieren</b> → <code>Link</code>. <span class="unterpunkt">(Sicherheitsnetz: falls danach etwas schiefgeht, ist der Link schon kopiert.)</span></li>
        <li><b>Wenn</b> → <code>Link</code> <i>enthält</i> <code>tiktok.com</code>. Darin:
          <ol>
            <li><b>URL erweitern</b> → <code>Link</code>, danach <b>Variable festlegen</b> <code>Link</code> auf <i>Erweiterte URL</i>.</li>
            <li><b>URL codieren</b> (Suche: „codieren“) → <code>Link</code>.</li>
            <li><b>URL</b> → <code>https://www.tiktok.com/oembed?url=</code> und direkt dahinter die Variable <i>URL-codierter Text</i>.</li>
            <li><b>Inhalte von URL abrufen</b>.</li>
            <li><b>Wörterbuchwert abrufen</b> → Wert für Schlüssel <code>title</code>.</li>
            <li><b>Variable festlegen</b> → <code>Beschreibung</code>.</li>
          </ol>
        </li>
        <li>Im <b>Sonst</b>-Teil (für Instagram):
          <ol>
            <li><b>Inhalte von URL abrufen</b> → <code>Link</code>.</li>
            <li><b>Text abgleichen</b> mit dem Muster<br><code>&lt;meta(?=[^&gt;]*og:description)[^&gt;]*content="([^"]*)"</code></li>
            <li><b>Gruppe aus übereinstimmendem Text abrufen</b> → Gruppe bei Index <code>1</code>.</li>
            <li><b>Variable festlegen</b> → <code>Beschreibung</code>.</li>
          </ol>
        </li>
        <li>Nach <b>Ende Wenn</b>: Aktion <b>Text</b> mit genau diesem Inhalt (drei Zeilen):<br>
          <code>#rezeptbox</code><br><i>[Variable Link]</i><br><i>[Variable Beschreibung]</i></li>
        <li><b>In Zwischenablage kopieren</b> → <i>Text</i>.</li>
        <li><b>Mitteilung anzeigen</b> → <code>Gemerkt! Öffne jetzt Mamas Küche und tippe auf + Rezept.</code></li>
      </ol>
      <p class="unterpunkt">Die Namen der Aktionen können je nach iOS-Version leicht abweichen. Such einfach nach dem fett gedruckten Stichwort. Beim ersten Mal fragt das iPhone, ob der Kurzbefehl auf instagram.com bzw. tiktok.com zugreifen darf: <b>„Immer erlauben“</b>.</p>
      <p class="unterpunkt">Ohne Internet oder wenn Instagram den Abruf blockiert, kann eine Fehlermeldung kommen. Der Link ist dann trotzdem schon kopiert und „Link einfügen“ funktioniert. Den Text fügt man dann von Hand ein.</p>
      <p class="unterpunkt">Tipp: Im Teilen-Menü ganz unten auf „Aktionen bearbeiten“ tippen und „Zur Rezeptbox“ zu den Favoriten hinzufügen. Dann steht er ganz oben.</p>
    </div>
  </details>

  </div>`;
}
