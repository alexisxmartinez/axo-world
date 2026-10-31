/* A small, original star atlas. Transparent Canvas2D; no assets or dependencies. */
const COSMIC_PALETTE = ['#e0b1cb', '#be95c4', '#9f86c0', '#f2e8f3'];
const cosmicLimit = (value, low, high) => Math.max(low, Math.min(high, value));

/** Reproducible coordinates keep a constellation familiar after resizing. */
export function createStarMap(width, height, seed = 431, count) {
  let value = seed >>> 0;
  const random = () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  const amount = Math.round(count ?? cosmicLimit(width * height / 6500, 96, 225));
  return Array.from({ length: amount }, (_, index) => {
    let u = random(), v = random();
    // A few denser pockets echo the nebula instead of a uniformly dotted grid.
    if (index % 5 === 0) {
      const center = index % 10 ? [.77, .22] : [.19, .29];
      u = cosmicLimit(center[0] + (u - .5) * .34, .02, .98);
      v = cosmicLimit(center[1] + (v - .5) * .33, .02, .98);
    }
    return { u, v, size: .45 + Math.pow(random(), 3) * 1.65,
      brightness: .26 + random() * .61, phase: random() * Math.PI * 2,
      depth: .25 + random() * .75, color: COSMIC_PALETTE[index % COSMIC_PALETTE.length] };
  });
}

export class Cosmos {
  constructor(canvas, { reducedMotion = false } = {}) {
    if (!canvas) throw new Error('Cosmos needs a canvas.');
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: true });
    if (!this.context) throw new Error('Canvas2D is unavailable.');
    this.motion = !reducedMotion;
    this.reading = false;
    this.visible = !document.hidden;
    this.destroyed = false;
    this.time = 0;
    this.lastTime = 0;
    this.frame = null;
    this.width = this.height = 1;
    this.pixelRatio = 1;
    this.pointer = { x: 0, y: 0, active: false };
    this.parallax = { x: 0, y: 0 };
    this.stars = [];
    this.bursts = [];
    this.shootingStars = [];
    this.links = 0;
    this.interactions = 0;
    this.listeners = [];
    this.flashTimer = null;
    this.pointerStart = null;
    this.tick = (stamp) => {
      this.frame = null;
      if (this.destroyed || !this.visible || this.reading) return;
      const elapsed = this.lastTime ? Math.min((stamp - this.lastTime) / 1000, .06) : 0;
      this.lastTime = stamp;
      if (this.motion) {
        this.time += elapsed;
        const ease = 1 - Math.exp(-elapsed * 5);
        const targetX = this.pointer.active ? (this.pointer.x / this.width - .5) * 10 : 0;
        const targetY = this.pointer.active ? (this.pointer.y / this.height - .5) * 8 : 0;
        this.parallax.x += (targetX - this.parallax.x) * ease;
        this.parallax.y += (targetY - this.parallax.y) * ease;
        this.bursts = this.bursts.filter((item) => this.time - item.born < 1.5);
        this.shootingStars = this.shootingStars.filter((item) => this.time - item.born < 1.25);
      }
      this.draw();
      if (this.motion) this.requestDraw();
    };
    this.bind();
    this.resize();
    this.requestDraw();
  }

  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.listeners.push(() => target.removeEventListener(type, handler, options));
  }

  bind() {
    const isControl = (target) => Boolean(target?.closest?.('a,button,input,textarea,select,dialog,[role="dialog"],[data-no-cosmos]'));
    this.listen(window, 'pointermove', (event) => {
      if (event.isPrimary === false) return;
      this.pointer.x = cosmicLimit(event.clientX, 0, this.width);
      this.pointer.y = cosmicLimit(event.clientY, 0, this.height);
      // A touch scroll should not leave a constellation following the page.
      this.pointer.active = event.pointerType !== 'touch' && !isControl(event.target);
      this.requestDraw();
    }, { passive: true });
    this.listen(window, 'pointerdown', (event) => {
      if (event.isPrimary === false || (event.button != null && event.button !== 0) || isControl(event.target)) return;
      this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    }, { passive: true });
    this.listen(window, 'pointerup', (event) => {
      const start = this.pointerStart;
      this.pointerStart = null;
      if (!start || start.id !== event.pointerId || event.axoWorldHandled || isControl(event.target)) return;
      if (Math.hypot(start.x - event.clientX, start.y - event.clientY) > 8) return;
      // Only an actual star hit responds. Ordinary world clicks remain quiet.
      const star = this.nearest(event.clientX, event.clientY, 26);
      if (star) this.pulse(star.x, star.y);
      if (event.pointerType === 'touch') {
        this.pointer.active = false;
        this.requestDraw();
      }
    }, { passive: true });
    this.listen(window, 'pointercancel', () => { this.pointerStart = null; this.pointer.active = false; this.requestDraw(); }, { passive: true });
    this.listen(window, 'pointerout', (event) => {
      if (!event.relatedTarget) { this.pointer.active = false; this.requestDraw(); }
    }, { passive: true });
    this.listen(window, 'resize', () => this.resize(), { passive: true });
    this.listen(document, 'visibilitychange', () => {
      this.visible = !document.hidden;
      this.lastTime = 0;
      if (this.visible) this.requestDraw();
      else if (this.frame != null) { cancelAnimationFrame(this.frame); this.frame = null; }
    });
  }

  resize() {
    if (this.destroyed) return;
    this.width = Math.max(1, window.innerWidth || this.canvas.clientWidth || 1);
    this.height = Math.max(1, window.innerHeight || this.canvas.clientHeight || 1);
    this.pixelRatio = cosmicLimit(window.devicePixelRatio || 1, 1, 2);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.stars = createStarMap(this.width, this.height);
    if (!this.reading) this.draw();
    this.requestDraw();
  }

  position(star) {
    return { x: star.u * this.width + this.parallax.x * star.depth,
      y: star.v * this.height + this.parallax.y * star.depth };
  }

  nearest(x, y, radius) {
    let chosen = null, distance = radius;
    for (const star of this.stars) {
      const point = this.position(star), delta = Math.hypot(point.x - x, point.y - y);
      if (delta < distance) { chosen = point; distance = delta; }
    }
    return chosen;
  }

  requestDraw() {
    if (this.destroyed || !this.visible || this.reading || this.frame != null) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  setMotion(enabled) {
    if (this.destroyed) return;
    this.motion = Boolean(enabled);
    this.lastTime = 0;
    this.parallax = { x: 0, y: 0 };
    this.bursts = [];
    this.shootingStars = [];
    clearTimeout(this.flashTimer);
    if (this.frame != null) { cancelAnimationFrame(this.frame); this.frame = null; }
    if (!this.reading && this.visible) this.draw();
    if (this.motion) this.requestDraw();
  }

  // Reading is a temporary suspension, separate from the visitor's motion setting.
  setReading(reading) {
    if (this.destroyed || this.reading === Boolean(reading)) return;
    this.reading = Boolean(reading);
    this.lastTime = 0;
    this.pointerStart = null;
    this.pointer.active = false;
    if (this.frame != null) { cancelAnimationFrame(this.frame); this.frame = null; }
    if (!this.reading && this.visible) {
      if (this.motion) this.requestDraw();
      else this.draw();
    }
  }

  /** Coordinates are CSS pixels. Accessible controls may call pulse() without a pointer. */
  pulse(x = this.width * .73, y = this.height * .23) {
    if (this.destroyed) return;
    x = cosmicLimit(Number.isFinite(x) ? x : this.width * .73, 8, Math.max(8, this.width - 8));
    y = cosmicLimit(Number.isFinite(y) ? y : this.height * .23, 8, Math.max(8, this.height - 8));
    this.interactions++;
    this.bursts.push({ x, y, born: this.time, phase: this.interactions * .71 });
    this.bursts = this.bursts.slice(-4);
    if (this.motion) {
      this.shootingStars.push({ x, y, born: this.time, direction: x > this.width * .7 ? -1 : 1 });
      this.shootingStars = this.shootingStars.slice(-3);
    } else {
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => { this.bursts = []; this.requestDraw(); }, 700);
    }
    this.requestDraw();
  }

  draw() {
    if (this.destroyed) return;
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    const nearby = [];
    for (const star of this.stars) {
      const point = this.position(star);
      const distance = this.pointer.active ? Math.hypot(point.x - this.pointer.x, point.y - this.pointer.y) : Infinity;
      if (distance < 138) nearby.push({ ...point, distance });
      const proximity = Math.max(0, 1 - distance / 110);
      const twinkle = this.motion ? .86 + Math.sin(this.time * (.38 + star.depth * .22) + star.phase) * .14 : 1;
      ctx.globalAlpha = cosmicLimit(star.brightness * twinkle + proximity * .5, 0, 1);
      ctx.fillStyle = star.color;
      ctx.beginPath(); ctx.arc(point.x, point.y, star.size + proximity * .5, 0, Math.PI * 2); ctx.fill();
      if (star.size > 1.65 || proximity > .65) {
        ctx.globalAlpha *= .45;
        ctx.strokeStyle = star.color; ctx.lineWidth = .6;
        const ray = star.size * 3 + proximity * 2;
        ctx.beginPath();
        ctx.moveTo(point.x - ray, point.y); ctx.lineTo(point.x + ray, point.y);
        ctx.moveTo(point.x, point.y - ray); ctx.lineTo(point.x, point.y + ray); ctx.stroke();
      }
    }
    nearby.sort((a, b) => a.distance - b.distance);
    const selected = nearby.slice(0, 7);
    this.links = 0;
    // Local links reveal a small constellation rather than a full-screen net.
    for (let index = 1; index < selected.length; index++) {
      const point = selected[index];
      const neighbor = selected.slice(0, index).reduce((best, item) =>
        Math.hypot(item.x - point.x, item.y - point.y) < Math.hypot(best.x - point.x, best.y - point.y) ? item : best, selected[0]);
      if (Math.hypot(neighbor.x - point.x, neighbor.y - point.y) > 108) continue;
      ctx.globalAlpha = Math.max(0, 1 - point.distance / 138) * .34;
      ctx.strokeStyle = '#e0b1cb'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(neighbor.x, neighbor.y); ctx.lineTo(point.x, point.y); ctx.stroke();
      this.links++;
    }
    for (const item of this.bursts) this.drawBurst(ctx, item);
    for (const item of this.shootingStars) this.drawShootingStar(ctx, item);
    ctx.globalAlpha = 1;
  }

  drawBurst(ctx, item) {
    const age = this.motion ? cosmicLimit((this.time - item.born) / 1.5, 0, 1) : .28;
    const distance = 9 + age * 63;
    ctx.globalAlpha = (1 - age) * .45;
    ctx.strokeStyle = '#be95c4'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.arc(item.x, item.y, distance, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2 + item.phase;
      const radius = distance * (.56 + (i % 3) * .16);
      const x = item.x + Math.cos(angle) * radius, y = item.y + Math.sin(angle) * radius;
      ctx.fillStyle = COSMIC_PALETTE[i % COSMIC_PALETTE.length];
      ctx.globalAlpha = (1 - age) * .7;
      ctx.beginPath(); ctx.arc(x, y, (1 - age) * 1.5 + .3, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawShootingStar(ctx, item) {
    const age = cosmicLimit((this.time - item.born) / 1.25, 0, 1);
    const speed = 150 + this.width * .1;
    const x = item.x + item.direction * speed * age;
    const y = item.y + speed * .43 * age;
    const tail = Math.min(92, 12 + age * 300);
    const gradient = ctx.createLinearGradient(x - item.direction * tail, y - tail * .43, x, y);
    gradient.addColorStop(0, 'rgba(159,134,192,0)');
    gradient.addColorStop(.65, 'rgba(224,177,203,.45)');
    gradient.addColorStop(1, '#f2e8f3');
    ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, age * 1.3)) * .9;
    ctx.strokeStyle = gradient; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - item.direction * tail, y - tail * .43); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#f2e8f3';
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  getState() {
    return { stars: this.stars.length, links: this.links, bursts: this.bursts.length,
      shootingStars: this.shootingStars.length, particleCount: this.bursts.length * 16,
      motion: this.motion, reading: this.reading, visible: this.visible, width: this.width, height: this.height,
      pixelRatio: this.pixelRatio, pointer: { ...this.pointer }, framePending: this.frame != null,
      destroyed: this.destroyed, interactions: this.interactions };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.frame = null;
    clearTimeout(this.flashTimer);
    this.listeners.forEach((remove) => remove());
    this.listeners = [];
    this.bursts = [];
    this.shootingStars = [];
    this.context.clearRect(0, 0, this.width, this.height);
  }
}
