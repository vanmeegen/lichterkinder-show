// Editor: Text einfügen, beim Abspielen Zeilen und Effekte mittippen, Zeiten feinjustieren.
import { Sheet, CueType, CUE_LABEL, saveSheet, emptySheet, fmtTime } from './cues';

const KEYMAP: Record<string, CueType> = {
  r: 'refrain', v: 'strophe', p: 'ruhig', h: 'herz', l: 'lichter', s: 'stern', n: 'schnee', g: 'glocken', k: 'lichterkinder',
};

type Undo = { kind: 'line'; idx: number } | { kind: 'cue' };

export class Editor {
  el = document.getElementById('editor')!;
  recording = false;
  private recIdx = 0;
  private undo: Undo[] = [];
  private taps: number[] = [];

  constructor(
    private sheet: () => Sheet,
    private setSheet: (s: Sheet) => void,
    private now: () => number,
    private play: (from: number) => Promise<void>,
    private stop: () => Promise<void>,
    private seek: (t: number) => Promise<void>,
    private toast: (s: string) => void,
  ) {
    this.el.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(b => b.onclick = () => this.tab(b.dataset.tab!));
    const ta = document.getElementById('ed-text') as HTMLTextAreaElement;
    document.getElementById('ed-apply')!.onclick = () => {
      const texts = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
      const old = this.sheet().lines;
      const keep = old.length === texts.length;
      this.changed({ ...this.sheet(), lines: texts.map((text, i) => ({ text, t: keep ? old[i].t : null })) });
      this.toast(`${texts.length} Zeilen übernommen`);
      this.tab('rec');
    };
    document.getElementById('ed-rec')!.onclick = () => this.startRec();
    document.getElementById('ed-stop')!.onclick = () => this.stopRec();
    document.getElementById('ed-close')!.onclick = () => this.close();
    document.getElementById('ed-add')!.onclick = () => {
      const type = (document.getElementById('ed-add-type') as HTMLSelectElement).value as CueType;
      const s = this.sheet();
      this.changed({ ...s, cues: [...s.cues, { t: round(this.now()), type }] });
    };
    document.getElementById('ed-export')!.onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(this.sheet(), null, 1)], { type: 'application/json' }));
      a.download = 'lichterkinder-ablauf.json'; a.click();
    };
    const file = document.getElementById('ed-file') as HTMLInputElement;
    document.getElementById('ed-import')!.onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files?.[0]; if (!f) return;
      try { const s = JSON.parse(await f.text()); if (!Array.isArray(s.lines)) throw 0; this.changed({ bpm: 100, ...s }); this.toast('Ablauf geladen ✔'); }
      catch { this.toast('Datei konnte nicht gelesen werden'); }
      file.value = '';
    };
    document.getElementById('ed-clear')!.onclick = () => {
      if (confirm('Text und alle Markierungen löschen?')) { this.changed(emptySheet()); ta.value = ''; }
    };
  }

  open() {
    this.el.classList.remove('hidden');
    (document.getElementById('ed-text') as HTMLTextAreaElement).value = this.sheet().lines.map(l => l.text).join('\n');
    this.renderList();
    this.tab(this.sheet().lines.length ? 'list' : 'text');
  }
  close() { this.stopRec(); this.el.classList.add('hidden'); }
  isOpen() { return !this.el.classList.contains('hidden'); }

  tab(name: string) {
    this.el.querySelectorAll<HTMLElement>('.tab').forEach(t => t.classList.toggle('hidden', t.dataset.tab !== name));
    this.el.querySelectorAll<HTMLElement>('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    if (name === 'list') this.renderList();
    if (name === 'rec') this.recInfo();
  }

  private changed(s: Sheet) { this.setSheet(s); saveSheet(s); if (!this.el.classList.contains('hidden')) this.renderList(); }

  async startRec() {
    const s = this.sheet();
    this.changed({ ...s, lines: s.lines.map(l => ({ ...l, t: null })), cues: [] });
    this.recIdx = 0; this.undo = []; this.taps = []; this.recording = true;
    document.getElementById('ed-rec')!.classList.add('active');
    await this.play(0);
    this.recInfo();
  }
  async stopRec() {
    if (!this.recording) return;
    this.recording = false;
    document.getElementById('ed-rec')!.classList.remove('active');
    await this.stop();
    this.recInfo('Aufnahme beendet. Im Feinschliff kannst du Zeiten noch anpassen.');
  }

  /** Tasten während der Aufnahme. true = verarbeitet. */
  key(e: KeyboardEvent): boolean {
    if (!this.recording) return false;
    const t = round(this.now());
    const s = this.sheet();
    if (e.key === 'Enter') {
      if (this.recIdx < s.lines.length) {
        const lines = s.lines.slice(); lines[this.recIdx] = { ...lines[this.recIdx], t };
        this.undo.push({ kind: 'line', idx: this.recIdx }); this.recIdx++;
        this.changed({ ...s, lines });
      }
    } else if (e.key === 'Backspace') {
      const u = this.undo.pop();
      if (u?.kind === 'line') { const lines = s.lines.slice(); lines[u.idx] = { ...lines[u.idx], t: null }; this.recIdx = u.idx; this.changed({ ...s, lines }); }
      else if (u?.kind === 'cue') this.changed({ ...s, cues: s.cues.slice(0, -1) });
    } else if (e.key.toLowerCase() === 't') {
      this.taps.push(performance.now()); this.taps = this.taps.slice(-9);
      if (this.taps.length >= 4) {
        const d = (this.taps[this.taps.length - 1] - this.taps[0]) / (this.taps.length - 1);
        const bpm = Math.round(60000 / d);
        this.changed({ ...s, bpm });
        (document.getElementById('set-bpm') as HTMLInputElement).value = String(bpm);
        document.getElementById('bpm-val')!.textContent = String(bpm);
      }
    } else if (KEYMAP[e.key.toLowerCase()]) {
      const type = KEYMAP[e.key.toLowerCase()];
      this.undo.push({ kind: 'cue' });
      this.changed({ ...s, cues: [...s.cues, { t, type }] });
      this.toast(CUE_LABEL[type] + ' @ ' + fmtTime(t));
    } else return false;
    this.recInfo();
    return true;
  }

  private recInfo(msg?: string) {
    const el = document.getElementById('ed-recinfo')!;
    const s = this.sheet();
    if (msg) { el.textContent = msg; return; }
    if (!this.recording) { el.textContent = s.lines.length ? '' : 'Tipp: Erst unter „1. Text“ den Liedtext einfügen.'; return; }
    const nx = s.lines[this.recIdx];
    el.innerHTML = nx
      ? `Zeile ${this.recIdx + 1}/${s.lines.length} – bei Beginn <kbd>Enter</kbd>:<br><b>${esc(nx.text)}</b>`
      : 'Alle Zeilen gesetzt 🎉 – Effekte kannst du weiter tippen.';
  }

  renderList() {
    const s = this.sheet();
    const items = [
      ...s.lines.map((l, i) => ({ t: l.t, label: esc(l.text), cls: '', kind: 'line' as const, i })),
      ...s.cues.map((c, i) => ({ t: c.t as number | null, label: CUE_LABEL[c.type], cls: 'cue', kind: 'cue' as const, i })),
    ].sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9));
    const list = document.getElementById('ed-list')!;
    list.innerHTML = items.length ? '' : '<p class="hint">Noch nichts eingetragen.</p>';
    for (const it of items) {
      const row = document.createElement('div'); row.className = 'it';
      row.innerHTML = `<button title="hierhin springen">▶</button><input type="number" step="0.1" min="0" value="${it.t ?? ''}" placeholder="–"><span class="${it.cls}">${it.label}</span><button title="entfernen">✕</button>`;
      const [go, , , del] = row.children as unknown as HTMLElement[];
      const inp = row.querySelector('input')!;
      go.onclick = () => { if (it.t != null) this.seek(Math.max(0, it.t - 1.5)); };
      inp.onchange = () => {
        const v = inp.value === '' ? null : round(parseFloat(inp.value));
        const cur = this.sheet();
        if (it.kind === 'line') { const lines = cur.lines.slice(); lines[it.i] = { ...lines[it.i], t: v }; this.changed({ ...cur, lines }); }
        else if (v != null) { const cues = cur.cues.slice(); cues[it.i] = { ...cues[it.i], t: v }; this.changed({ ...cur, cues }); }
      };
      del.onclick = () => {
        const cur = this.sheet();
        if (it.kind === 'line') { const lines = cur.lines.slice(); lines[it.i] = { ...lines[it.i], t: null }; this.changed({ ...cur, lines }); }
        else this.changed({ ...cur, cues: cur.cues.filter((_, j) => j !== it.i) });
      };
      list.appendChild(row);
    }
  }
}

const round = (t: number) => Math.round(Math.max(0, t) * 10) / 10;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
