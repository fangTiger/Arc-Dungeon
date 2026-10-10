const UINT32_MAX_PLUS_ONE = 0x100000000;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function createRng(seed) {
  let state = normalizeSeed(seed);

  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / UINT32_MAX_PLUS_ONE;
    },

    int(minInclusive, maxExclusive) {
      if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
        throw new TypeError("随机整数边界必须是整数");
      }

      if (maxExclusive <= minInclusive) {
        throw new RangeError("随机整数上界必须大于下界");
      }

      return Math.floor(this.next() * (maxExclusive - minInclusive)) + minInclusive;
    },

    pick(array) {
      if (!Array.isArray(array) || array.length === 0) {
        throw new RangeError("随机选择需要非空数组");
      }

      return array[this.int(0, array.length)];
    },

    shuffle(array) {
      if (!Array.isArray(array)) {
        throw new TypeError("随机洗牌需要数组");
      }

      const result = [...array];

      for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = this.int(0, index + 1);
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
      }

      return result;
    },
  };
}

export function hashSeed(string) {
  let hash = FNV_OFFSET;

  for (const character of String(string)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return hash >>> 0;
}

function normalizeSeed(seed) {
  if (!Number.isFinite(seed)) {
    return hashSeed(String(seed));
  }

  return seed >>> 0;
}
