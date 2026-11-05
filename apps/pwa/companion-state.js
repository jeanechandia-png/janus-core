/** Local-only companion state: no sensitive biometrics or third-party services. */
const MAX_STARS = 100000;
const REWARD = 3;
const DAILY_REWARDS = 5;
const allowedId = (catalog, id) => Boolean(catalog.characters.find((c) => c.id === id));
const safeText = (value, max, fallback) => {
  const text = String(value ?? '').replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  return text || fallback;
};
const dayStamp = (date) => [
  date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0'),
].join('-');

export function initialCompanionState(catalog) {
  return {
    selectedId: catalog.characters[0].id,
    ownerName: 'Kendra',
    nicknames: {},
    stars: 0,
    unlocked: catalog.accessories.filter((a) => a.cost === 0).map((a) => a.id),
    equipped: {},
    stageOffset: 0,
    rewards: { day: '', challengeIds: [] },
  };
}

export function restoreCompanionState(input, catalog) {
  const base = initialCompanionState(catalog);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return base;
  const known = new Set(catalog.accessories.map((a) => a.id));
  const selectedId = allowedId(catalog, input.selectedId) ? input.selectedId : base.selectedId;
  const unlocked = Array.isArray(input.unlocked)
    ? [...new Set([...base.unlocked, ...input.unlocked.filter((x) => known.has(x))])]
    : base.unlocked;
  const equipped = {};
  for (const item of catalog.accessories) {
    if (unlocked.includes(item.id) && input.equipped?.[item.category] === item.id) {
      equipped[item.category] = item.id;
    }
  }
  const nicknames = {};
  for (const c of catalog.characters) {
    if (typeof input.nicknames?.[c.id] === 'string') {
      nicknames[c.id] = safeText(input.nicknames[c.id], 20, c.label);
    }
  }
  const amount = Number(input.stars);
  const rewards = input.rewards && typeof input.rewards === 'object' ? input.rewards : {};
  return {
    selectedId,
    ownerName: safeText(input.ownerName, 30, 'Kendra'),
    nicknames,
    stars: Number.isSafeInteger(amount) ? Math.max(0, Math.min(MAX_STARS, amount)) : 0,
    unlocked,
    equipped,
    stageOffset: Number.isFinite(input.stageOffset) ? Math.max(-110, Math.min(110, input.stageOffset)) : 0,
    rewards: {
      day: /^\d{4}-\d{2}-\d{2}$/.test(rewards.day) ? rewards.day : '',
      challengeIds: Array.isArray(rewards.challengeIds)
        ? [...new Set(rewards.challengeIds.filter((x) => typeof x === 'string' && x.length <= 80))].slice(0, DAILY_REWARDS)
        : [],
    },
  };
}

export function activeName(state, character) {
  return safeText(state.nicknames[character.id], 20, character.label);
}

export function renameLocally(state, characterId, ownerName, characterName, fallbackName) {
  return {
    ...state,
    ownerName: safeText(ownerName, 30, 'Kendra'),
    nicknames: { ...state.nicknames, [characterId]: safeText(characterName, 20, fallbackName) },
  };
}

/** Idempotent reward per challenge ID, maximum five awards per local day. */
export function addStarsForChallenge(state, challengeId, date = new Date()) {
  if (typeof challengeId !== 'string' || !challengeId || challengeId.length > 80) {
    return { state, earned: 0 };
  }
  const day = dayStamp(date);
  const ids = state.rewards?.day === day ? state.rewards.challengeIds : [];
  if (ids.includes(challengeId) || ids.length >= DAILY_REWARDS) return { state, earned: 0 };
  return {
    state: { ...state, stars: Math.min(MAX_STARS, state.stars + REWARD),
      rewards: { day, challengeIds: [...ids, challengeId] } },
    earned: REWARD,
  };
}

export function unlockAccessory(state, item, catalog) {
  const registered = catalog.accessories.find((a) => a.id === item?.id);
  if (!registered || registered.cost !== item.cost
    || !Number.isSafeInteger(registered.cost) || registered.cost < 0) {
    return { ok: false, missing: 0, state };
  }
  if (state.unlocked.includes(item.id)) return { ok: true, missing: 0, state };
  if (state.stars < item.cost) return { ok: false, missing: item.cost - state.stars, state };
  return {
    ok: true, missing: 0,
    state: {
      ...state, stars: state.stars - item.cost, unlocked: [...state.unlocked, item.id],
    },
  };
}

export function equipAccessory(state, item, catalog) {
  const registered = catalog.accessories.find((a) => a.id === item?.id);
  if (!registered || !state.unlocked.includes(item.id)) return state;
  return { ...state, equipped: { ...state.equipped, [registered.category]: registered.id } };
}
