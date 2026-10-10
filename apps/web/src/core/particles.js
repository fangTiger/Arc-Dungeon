import { createRng, hashSeed } from "./rng.js";

const DEFAULT_BOUNDS = Object.freeze({ width: 320, height: 180 });
const DEFAULT_FOUNTAIN = Object.freeze({ x: 40, y: 47 });
const DEFAULT_MAX_DUST = 22;
const DEFAULT_MAX_SPLASH = 12;
const DEFAULT_DUST_RATE = 2.4;
const DEFAULT_SPLASH_RATE = 4.2;
const SPLASH_GRAVITY = 42;

export function createParticleState({ seed = "rialo:hub:particles:s4" } = {}) {
  return {
    seed: String(seed),
    dust: [],
    splashes: [],
    nextDustId: 0,
    nextSplashId: 0,
    dustSpawnDebt: 0,
    splashSpawnDebt: 0,
  };
}

export function updateParticles(state, options = {}) {
  const dt = normalizeDt(options.dt);
  const bounds = options.bounds ?? DEFAULT_BOUNDS;
  const fountain = options.fountain ?? DEFAULT_FOUNTAIN;
  const maxDust = normalizeLimit(options.maxDust, DEFAULT_MAX_DUST);
  const maxSplash = normalizeLimit(options.maxSplash, DEFAULT_MAX_SPLASH);
  const dustRate = normalizeRate(options.dustRate, DEFAULT_DUST_RATE);
  const splashRate = normalizeRate(options.splashRate, DEFAULT_SPLASH_RATE);
  const next = {
    seed: String(state?.seed ?? "rialo:hub:particles:s4"),
    dust: updateDustList(state?.dust ?? [], dt, bounds).slice(0, maxDust),
    splashes: updateSplashList(state?.splashes ?? [], dt, bounds).slice(0, maxSplash),
    nextDustId: normalizeCounter(state?.nextDustId),
    nextSplashId: normalizeCounter(state?.nextSplashId),
    dustSpawnDebt: normalizeDebt(state?.dustSpawnDebt) + dustRate * dt,
    splashSpawnDebt: normalizeDebt(state?.splashSpawnDebt) + splashRate * dt,
  };

  spawnDust(next, bounds, maxDust);
  spawnSplashes(next, fountain, maxSplash);
  return next;
}

function updateDustList(particles, dt, bounds) {
  return particles
    .map((particle) => {
      const age = particle.age + dt;
      return {
        ...particle,
        age,
        x: particle.x + particle.vx * dt,
        y: particle.y + particle.vy * dt,
        alpha: fadeAlpha(age, particle.life, particle.baseAlpha),
      };
    })
    .filter((particle) => particle.age < particle.life && isInsideBounds(particle, bounds, 4));
}

function updateSplashList(particles, dt, bounds) {
  return particles
    .map((particle) => {
      const age = particle.age + dt;
      const nextVy = particle.vy + SPLASH_GRAVITY * dt;
      return {
        ...particle,
        age,
        x: particle.x + particle.vx * dt,
        y: particle.y + particle.vy * dt + SPLASH_GRAVITY * dt * dt * 0.5,
        vy: nextVy,
        alpha: fadeAlpha(age, particle.life, particle.baseAlpha),
      };
    })
    .filter((particle) => particle.age < particle.life && isInsideBounds(particle, bounds, 8));
}

function spawnDust(state, bounds, maxDust) {
  while (state.dustSpawnDebt >= 1 && state.dust.length < maxDust) {
    const id = state.nextDustId;
    const rng = createParticleRng(state.seed, "dust", id);

    state.dust.push({
      id,
      type: "dust",
      x: range(rng, 20, bounds.width - 20),
      y: range(rng, 42, bounds.height - 24),
      vx: range(rng, -1.1, 1.1),
      vy: range(rng, -5.8, -2.1),
      age: 0,
      life: range(rng, 4.8, 8.2),
      size: rng.next() > 0.82 ? 2 : 1,
      baseAlpha: range(rng, 0.16, 0.34),
      alpha: 0,
    });
    state.nextDustId += 1;
    state.dustSpawnDebt -= 1;
  }

  if (state.dust.length >= maxDust) {
    state.dustSpawnDebt = Math.min(state.dustSpawnDebt, 0.95);
  }
}

function spawnSplashes(state, fountain, maxSplash) {
  while (state.splashSpawnDebt >= 1 && state.splashes.length < maxSplash) {
    const id = state.nextSplashId;
    const rng = createParticleRng(state.seed, "splash", id);

    state.splashes.push({
      id,
      type: "splash",
      x: fountain.x + range(rng, -7, 7),
      y: fountain.y + range(rng, -2, 3),
      vx: range(rng, -9, 9),
      vy: range(rng, -18, -11),
      age: 0,
      life: range(rng, 1.2, 1.75),
      size: 1,
      baseAlpha: range(rng, 0.42, 0.72),
      alpha: 0,
    });
    state.nextSplashId += 1;
    state.splashSpawnDebt -= 1;
  }

  if (state.splashes.length >= maxSplash) {
    state.splashSpawnDebt = Math.min(state.splashSpawnDebt, 0.95);
  }
}

function createParticleRng(seed, channel, id) {
  return createRng(hashSeed(`${seed}:${channel}:${id}`));
}

function range(rng, min, max) {
  return min + rng.next() * (max - min);
}

function fadeAlpha(age, life, baseAlpha) {
  const normalizedAge = Math.max(0, Math.min(1, age / life));
  const fadeIn = Math.min(1, normalizedAge * 4);
  const fadeOut = Math.max(0, 1 - normalizedAge);
  return baseAlpha * Math.min(fadeIn, fadeOut);
}

function isInsideBounds(particle, bounds, margin) {
  return (
    particle.x >= -margin &&
    particle.y >= -margin &&
    particle.x <= bounds.width + margin &&
    particle.y <= bounds.height + margin
  );
}

function normalizeDt(dt) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError("粒子步长必须是非负数");
  }

  return dt;
}

function normalizeLimit(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError("粒子数量上限必须是非负整数");
  }

  return value;
}

function normalizeRate(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("粒子生成频率必须是非负数");
  }

  return value;
}

function normalizeCounter(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeDebt(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
