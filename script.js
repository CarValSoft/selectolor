class HexColorPicker {
  constructor(canvas, { rows = 6 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.center = { x: canvas.width / 2, y: canvas.height / 2 };
    this.rows = rows;
    this.hexRadius = 18;
    this.hexagons = [];
    this.selectedIndex = -1;
    this.value = 1;
    this.alpha = 1;
    this.onColorChanged = null;

    this.buildHexGrid();
    this.draw();
    this.bindEvents();
  }

  buildHexGrid() {
    const size = this.hexRadius;
    const spacingX = Math.sqrt(3) * size;
    const spacingY = 1.5 * size;
    const n = this.rows;

    for (let q = -n; q <= n; q++) {
      const r1 = Math.max(-n, -q - n);
      const r2 = Math.min(n, -q + n);
      for (let r = r1; r <= r2; r++) {
        const x = this.center.x + (Math.sqrt(3) * (q + r / 2)) * size;
        const y = this.center.y + spacingY * r;

        const dx = x - this.center.x;
        const dy = y - this.center.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = n * spacingY;

        let hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        let sat = Math.min(1, dist / maxDist);

        if (dist < size * 0.45) {
          sat = 0;
          hue = 0;
        }

        this.hexagons.push({ x, y, hue, sat });
      }
    }
  }

  bindEvents() {
    let dragging = false;

    const handle = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      const i = this.findHexagonAt(x, y);
      if (i !== -1) {
        this.selectedIndex = i;
        this.draw();
        this.emitColor();
      }
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      handle(e);
      this.canvas.setPointerCapture(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (dragging) handle(e);
    });

    this.canvas.addEventListener('pointerup', (e) => {
      dragging = false;
      this.canvas.releasePointerCapture(e.pointerId);
    });
  }

  findHexagonAt(x, y) {
    const hitRadius = this.hexRadius * 0.95;
    let winner = -1;
    let best = Infinity;

    this.hexagons.forEach((h, i) => {
      const d = Math.hypot(x - h.x, y - h.y);
      if (d <= hitRadius && d < best) {
        best = d;
        winner = i;
      }
    });

    return winner;
  }

  setBrightness(percent) {
    this.value = Math.min(1, Math.max(0, percent / 100));
    this.draw();
    this.emitColor();
  }

  setAlpha(percent) {
    this.alpha = Math.min(1, Math.max(0, percent / 100));
    this.draw();
    this.emitColor();
  }

  currentColor() {
    const selected = this.hexagons[this.selectedIndex] || { hue: 0, sat: 0 };
    const { r, g, b } = hsvToRgb(selected.hue, selected.sat, this.value);
    return { r, g, b, a: this.alpha };
  }

  emitColor() {
    if (typeof this.onColorChanged === 'function') {
      this.onColorChanged(this.currentColor());
    }
  }

  drawHex(x, y, size, fill, stroke = 'rgba(0,0,0,.12)', width = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = ((60 * i - 30) * Math.PI) / 180;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.hexagons.forEach((h, index) => {
      const { r, g, b } = hsvToRgb(h.hue, h.sat, this.value);
      const fill = `rgba(${r},${g},${b},${this.alpha})`;
      this.drawHex(h.x, h.y, this.hexRadius, fill);

      if (index === this.selectedIndex) {
        this.drawHex(h.x, h.y, this.hexRadius + 3, 'rgba(0,0,0,0)', '#ffffff', 3.5);
        this.drawHex(h.x, h.y, this.hexRadius + 5, 'rgba(0,0,0,0)', 'rgba(0,0,0,.55)', 1.2);
      }
    });
  }
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let [r1, g1, b1] = [0, 0, 0];
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const m = v - c;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

function toHex({ r, g, b, a }) {
  const alpha = Math.round(a * 255);
  const hex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${hex(alpha)}${hex(r)}${hex(g)}${hex(b)}`;
}

function toRgbaString({ r, g, b, a }) {
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

const picker = new HexColorPicker(document.getElementById('color-wheel'), { rows: 6 });
const brightnessInput = document.getElementById('brightness');
const alphaInput = document.getElementById('alpha');
const preview = document.getElementById('preview');
const hexValue = document.getElementById('hex-value');
const rgbaValue = document.getElementById('rgba-value');

picker.selectedIndex = Math.floor(picker.hexagons.length / 2);
picker.draw();

picker.onColorChanged = (color) => {
  const hex = toHex(color);
  const rgba = toRgbaString(color);
  preview.style.setProperty('--selected', rgba);
  hexValue.textContent = hex;
  rgbaValue.textContent = rgba;
};

brightnessInput.addEventListener('input', (e) => picker.setBrightness(Number(e.target.value)));
alphaInput.addEventListener('input', (e) => picker.setAlpha(Number(e.target.value)));

picker.emitColor();
