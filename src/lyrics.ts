// Mitsing-Text: aktuelle Zeile groß, Wörter werden nacheinander „angesungen“, Schlüsselwörter leuchten.
import { Sheet, keywordOf } from './cues';

export class Lyrics {
  private cur = document.getElementById('line-cur')!;
  private next = document.getElementById('line-next')!;
  private idx = -2;
  private words: HTMLSpanElement[] = [];
  private sungCount = 0;
  visible = true;

  update(sheet: Sheet, t: number) {
    const lines = sheet.lines.filter(l => l.t != null) as { t: number; text: string }[];
    let i = -1;
    for (let k = 0; k < lines.length; k++) if (lines[k].t <= t) i = k; else break;
    // nach 8 s ohne neue Zeile ausblenden
    if (i >= 0 && t - lines[i].t > Math.max(8, (lines[i + 1]?.t ?? Infinity) - lines[i].t > 30 ? 8 : 99)) i = -1;
    const show = this.visible && lines.length > 0;
    (this.cur.parentElement as HTMLElement).style.display = show ? '' : 'none';
    if (!show) return;

    if (i !== this.idx) {
      this.idx = i;
      this.cur.innerHTML = ''; this.words = []; this.sungCount = 0;
      if (i >= 0) {
        for (const w of lines[i].text.split(/\s+/).filter(Boolean)) {
          const s = document.createElement('span');
          s.className = 'w';
          const k = keywordOf(w);
          if (k) s.classList.add('kw-' + k);
          s.textContent = w;
          this.cur.appendChild(s); this.words.push(s);
        }
        this.cur.classList.remove('enter'); void this.cur.offsetWidth; this.cur.classList.add('enter');
      }
      const nx = lines[i + 1];
      this.next.textContent = nx && (i < 0 ? nx.t - t < 4 : true) ? nx.text : '';
    }
    if (i < 0) {
      const nx = lines[0];
      this.next.textContent = nx && nx.t - t < 4 && nx.t > t ? nx.text : '';
      return;
    }
    const start = lines[i].t;
    const end = Math.min(lines[i + 1]?.t ?? start + 5, start + 8);
    const prog = Math.min(1, (t - start) / Math.max(0.5, (end - start) * 0.85));
    const n = Math.ceil(prog * this.words.length + 0.001);
    if (n !== this.sungCount) {
      for (let k = 0; k < this.words.length; k++) {
        const sung = k < n;
        if (sung && !this.words[k].classList.contains('sung')) {
          this.words[k].classList.add('sung');
          if ([...this.words[k].classList].some(c => c.startsWith('kw-'))) this.words[k].classList.add('pop');
        } else if (!sung) this.words[k].classList.remove('sung', 'pop');
      }
      this.sungCount = n;
    }
  }
  reset() { this.idx = -2; }
}
