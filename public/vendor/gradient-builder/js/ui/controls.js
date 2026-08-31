/* Briques d'interface partagees : segments, sliders, chips. */

/*
 * Onglet masque : requestAnimationFrame ne se declenche pas. On retombe alors
 * sur un timer, sinon un rendu demande en arriere-plan ne repart jamais.
 */
export function schedule(fn) {
  if (typeof document !== 'undefined' && document.hidden) return setTimeout(fn, 0);
  return requestAnimationFrame(fn);
}

export function unschedule(handle) {
  cancelAnimationFrame(handle);
  clearTimeout(handle);
}

export function el(tag, className, attrs) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  return node;
}

/*
 * Segment avec pastille glissante. La pastille est positionnee apres coup a
 * partir de la geometrie reelle du bouton actif : c'est ce qui permet des
 * items de largeurs differentes sans calcul de mise en page.
 */
export function segment({ items, active, onSelect, variant = '', render }) {
  const root = el('div', `jg-seg ${variant}`.trim(), { role: 'tablist' });
  const thumb = el('span', 'jg-seg-thumb', { 'aria-hidden': 'true' });
  root.appendChild(thumb);

  const buttons = items.map((item, i) => {
    const b = el('button', 'jg-seg-item', { type: 'button', role: 'tab' });
    if (render) render(b, item, i); else b.textContent = item.label ?? item;
    b.dataset.on = String(i === active);
    b.setAttribute('aria-selected', String(i === active));
    b.addEventListener('click', () => onSelect(i, item));
    root.appendChild(b);
    return b;
  });

  const place = (animate) => {
    const i = buttons.findIndex((b) => b.dataset.on === 'true');
    const target = buttons[i] ?? buttons[0];
    if (!target) return;
    thumb.classList.toggle('jg-seg-thumb--anim', animate !== false);
    thumb.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`;
    thumb.style.width = `${target.offsetWidth}px`;
    thumb.style.height = `${target.offsetHeight}px`;
  };

  root.setActive = (i) => {
    buttons.forEach((b, k) => { b.dataset.on = String(k === i); b.setAttribute('aria-selected', String(k === i)); });
    place(true);
  };
  root.place = place;
  schedule(() => place(false));
  return root;
}

/*
 * Slider "dial" : toute la barre est la zone de saisie, la valeur s'affiche a
 * droite. `format` recoit la valeur brute.
 */
export function dial({ label, value, min = 0, max = 100, step = 1, ticks = 0, format, onInput, onCommit }) {
  const root = el('div', 'dial-slider', { tabindex: '0', role: 'slider', 'aria-label': label });
  const track = el('div', 'dial-track');
  const fill = el('div', 'dial-fill');
  const tickBox = el('div', 'dial-ticks');
  const handle = el('div', 'dial-handle');
  const labelEl = el('span', 'dial-label', { text: label });
  const valueEl = el('span', 'dial-value');
  track.append(fill, tickBox, handle);
  root.append(track, labelEl, valueEl);

  for (let i = 1; i < ticks; i++) {
    const t = el('span');
    t.style.left = `${(i / ticks) * 100}%`;
    tickBox.appendChild(t);
  }

  let current = value;
  const show = () => {
    const pct = ((current - min) / (max - min)) * 100;
    fill.style.width = `${pct}%`;
    handle.style.left = `${pct}%`;
    valueEl.textContent = format ? format(current) : String(current);
    root.setAttribute('aria-valuenow', String(current));
  };

  const fromEvent = (event) => {
    const rect = track.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const raw = min + t * (max - min);
    return Math.round(raw / step) * step;
  };

  let dragging = false;
  const down = (event) => {
    dragging = true;
    root.classList.add('is-active');
    root.setPointerCapture?.(event.pointerId);
    current = fromEvent(event); show(); onInput?.(current);
  };
  const move = (event) => { if (!dragging) return; current = fromEvent(event); show(); onInput?.(current); };
  const up = () => { if (!dragging) return; dragging = false; root.classList.remove('is-active'); onCommit?.(current); };
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('keydown', (event) => {
    const delta = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
    if (!delta) return;
    event.preventDefault();
    current = Math.min(max, Math.max(min, current + delta));
    show(); onInput?.(current); onCommit?.(current);
  });

  root.setValue = (v) => { current = v; show(); };
  show();
  return root;
}

export function fieldRow(label, control) {
  const row = el('div', 'jg-field-row');
  row.append(el('span', 'jg-field-label', { text: label }), control);
  return row;
}

export function group(title, extra) {
  const g = el('div', 'jg-panel-group');
  if (title) {
    const h = el('h4');
    h.textContent = title;
    if (extra) { const dim = el('span', 'jg-dim', { text: ` ${extra}` }); h.appendChild(dim); }
    g.appendChild(h);
  }
  return g;
}
