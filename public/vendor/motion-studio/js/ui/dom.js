// Fabrique d'elements : `el('div.row', {onclick}, [enfants])`.
export function el(spec, props = {}, children = []) {
    const [tag, ...classes] = String(spec).split('.');
    const node = document.createElement(tag || 'div');
    if (classes.length) node.className = classes.join(' ');
    Object.entries(props).forEach(([k, v]) => {
        if (v === undefined || v === null || v === false) return;
        if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style') Object.assign(node.style, v);
        else if (k in node && k !== 'list') node[k] = v;
        else node.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(children) ? children : [children])
        .filter(Boolean)
        .forEach((c) => node.append(c));
    return node;
}

export function segmented(options, value, onPick) {
    return el('div.seg', {}, options.map(([val, label]) => el('button', {
        type: 'button',
        text: label,
        'aria-pressed': String(val) === String(value),
        onclick: () => onPick(val),
    })));
}

export function pickFile(accept, onFile, multiple = false) {
    const input = el('input', {
        type: 'file', accept, multiple, style: { display: 'none' },
    });
    input.addEventListener('change', () => {
        const files = Array.from(input.files || []);
        if (files.length) onFile(multiple ? files : files[0]);
        input.remove();
    });
    document.body.append(input);
    input.click();
}
