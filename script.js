const picker = document.getElementById('color-picker');

const GRID_RADIUS = 6;
const HEX_W = 40;
const HEX_H = 34.64;
const STEP_X = HEX_W * 0.75;
const STEP_Y = HEX_H;

const cells = [];
let selectedCell = null;
let dragging = false;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;

  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = v - c;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToCss({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

function createColor(q, r, centerX, centerY, maxDist) {
  const x = centerX + q * STEP_X;
  const y = centerY + r * STEP_Y + q * (STEP_Y / 2);

  const dx = x - centerX;
  const dy = y - centerY;
  const dist = Math.hypot(dx, dy);
  const hue = (Math.atan2(dy, dx) * 180) / Math.PI + 360;

  const sat = clamp(dist / maxDist, 0, 1);
  const value = clamp(0.62 + ((y - centerY) / (maxDist * 1.7)) * -0.2 + sat * 0.42, 0.52, 1);
  const rgb = hsvToRgb(hue % 360, sat, value);

  return {
    x,
    y,
    rgb,
    color: rgbToCss(rgb),
    hex: rgbToHex(rgb)
  };
}

function applyInteractiveScale(el, active) {
  el.style.transform = active ? 'scale(1.019)' : 'scale(1)';
}

function emitColorChange(cell) {
  if (!cell) return;

  const payload = {
    hex: cell.dataset.hex,
    rgb: cell.dataset.rgb,
    index: Number(cell.dataset.index)
  };

  picker.dispatchEvent(new CustomEvent('colorchange', { detail: payload }));

  if (window.AndroidColorPicker && typeof window.AndroidColorPicker.onColorChange === 'function') {
    window.AndroidColorPicker.onColorChange(payload.hex, payload.rgb);
  }
}

function selectCell(cell) {
  if (!cell || cell === selectedCell) return;

  if (selectedCell) selectedCell.classList.remove('selected');
  cell.classList.add('selected');
  selectedCell = cell;
  emitColorChange(cell);
}

function createHexCell(x, y, color, colorHex, isCenter) {
  const hex = document.createElement('button');
  hex.type = 'button';
  hex.className = 'hex';
  hex.style.left = `${x - HEX_W / 2}px`;
  hex.style.top = `${y - HEX_H / 2}px`;
  hex.style.setProperty('--hex-color', color);
  hex.dataset.cx = String(x);
  hex.dataset.cy = String(y);
  hex.dataset.hex = colorHex;
  hex.dataset.rgb = color;

  if (isCenter) {
    hex.classList.add('selected');
    selectedCell = hex;
  }

  hex.addEventListener('mouseenter', () => applyInteractiveScale(hex, true));
  hex.addEventListener('mouseleave', () => applyInteractiveScale(hex, false));
  hex.addEventListener('focus', () => applyInteractiveScale(hex, true));
  hex.addEventListener('blur', () => applyInteractiveScale(hex, false));
  hex.addEventListener('pointerdown', () => {
    dragging = true;
    applyInteractiveScale(hex, true);
    selectCell(hex);
  });

  hex.addEventListener('click', () => selectCell(hex));

  hex.dataset.index = String(cells.length);
  cells.push(hex);
  picker.appendChild(hex);
}

function nearestCell(clientX, clientY) {
  let closest = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const cell of cells) {
    const dx = clientX - Number(cell.dataset.cx);
    const dy = clientY - Number(cell.dataset.cy);
    const d = (dx * dx) + (dy * dy);
    if (d < minDistance) {
      minDistance = d;
      closest = cell;
    }
  }

  return closest;
}

function updateSelectionFromPointer(event) {
  if (!dragging) return;

  const rect = picker.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const cell = nearestCell(x, y);
  if (cell) selectCell(cell);
}

function bindPointerTracking() {
  picker.addEventListener('pointerdown', (event) => {
    dragging = true;
    picker.setPointerCapture(event.pointerId);
    updateSelectionFromPointer(event);
  });

  picker.addEventListener('pointermove', updateSelectionFromPointer);

  const stopDrag = (event) => {
    dragging = false;
    if (event?.pointerId != null && picker.hasPointerCapture(event.pointerId)) {
      picker.releasePointerCapture(event.pointerId);
    }
  };

  picker.addEventListener('pointerup', stopDrag);
  picker.addEventListener('pointercancel', stopDrag);
  picker.addEventListener('pointerleave', stopDrag);
}

function build() {
  const centerX = picker.clientWidth / 2;
  const centerY = picker.clientHeight / 2;
  const maxDist = GRID_RADIUS * STEP_Y;

  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q += 1) {
    const rMin = Math.max(-GRID_RADIUS, -q - GRID_RADIUS);
    const rMax = Math.min(GRID_RADIUS, -q + GRID_RADIUS);

    for (let r = rMin; r <= rMax; r += 1) {
      const cell = createColor(q, r, centerX, centerY, maxDist);
      const isCenter = q === 0 && r === 0;
      createHexCell(cell.x, cell.y, cell.color, cell.hex, isCenter);
    }
  }

  emitColorChange(selectedCell);
  bindPointerTracking();
}

build();
