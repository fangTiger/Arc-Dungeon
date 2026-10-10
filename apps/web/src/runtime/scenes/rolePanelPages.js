import { getSkillsForClass } from "../../core/combat/skills.js";
import { getSkinAppearanceLabel } from "../../core/economy/skinAppearance.js";
import { localizeSkin } from "../../core/economy/skins.js";
import { MAX_TICKET_HOLDINGS } from "../../core/economy/tickets.js";
import { explorationRate } from "../../core/run/runState.js";
import { getUpgradesByIds } from "../../core/run/upgrades.js";
import { getRarityBorderColor } from "../ui/pixelUi.js";
import { translate } from "../../core/i18n/index.js";

export function createAttributeLines({ run, player, heroIdentity }, t = translate) {
  const classId =
    player?.classId ??
    run?.heroClass ??
    heroIdentity?.selectedClassId ??
    "knight";
  const hp = player
    ? `${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`
    : t("role.attribute.notInDungeon");
  const attack = player?.attackDamage ?? player?.damage ?? "-";
  const speed = player?.movementMultiplier
    ? `${Math.round(player.movementMultiplier * 100)}%`
    : "100%";
  const depth = run?.depth
    ? t("role.attribute.floor", { depth: run.depth })
    : t("role.attribute.hub");
  const rate = run
    ? `${Math.round(explorationRate(run) * 100)}%`
    : "-";
  const upgrades =
    getUpgradesByIds(run?.build?.upgradeIds ?? [], t)
      .slice(0, 2)
      .map((upgrade) => upgrade.name)
      .join(" / ") || t("common.none");

  return [
    { text: t("role.attribute.class", { classId }) },
    { text: t("role.attribute.hp", { hp }) },
    { text: t("role.attribute.attackMove", { attack, speed }) },
    { text: t("role.attribute.locationExplore", { location: depth, rate }) },
    { text: t("role.attribute.upgrades", { upgrades }) },
  ];
}

export function createSkillLines({ skillSlots = [], player, run, heroIdentity }, t = translate) {
  if (skillSlots.length > 0) {
    return skillSlots.map((slot) => ({
      text: t("role.skill.slot", {
        key: slot.key,
        name: slot.id ? t(`class.skill.${slot.id}.name`) : slot.name,
        state: t(slot.ready ? "common.ready" : "common.cooling"),
      }),
      color: slot.ready ? "#f7efd0" : "#b8c7df",
    }));
  }

  const classId =
    player?.classId ??
    run?.heroClass ??
    heroIdentity?.selectedClassId ??
    "knight";
  return getSkillsForClass(classId, t).map((skill) => ({
    text: t("role.skill.cooldown", {
      key: skill.slot,
      name: skill.name,
      seconds: Math.round(skill.cooldownMs / 1000),
    }),
  }));
}

export function createBagLines({ run, economySnapshot }, t = translate) {
  const profile = economySnapshot?.profile ?? {};
  const balance = economySnapshot?.balance ?? {};

  return [
    { text: t("role.bag.balance", { tokens: balance.tokens ?? "..." }) },
    { text: t("role.bag.tickets", { tickets: profile.tickets ?? 0, max: MAX_TICKET_HOLDINGS }) },
    { text: t("role.bag.runTokens", { tokens: run?.bag?.tokens ?? 0 }) },
    { text: t("role.bag.boxesSkins", { boxes: profile.skinBoxes ?? 0, skins: profile.ownedSkins?.length ?? 0 }) },
    { text: `Seed  ${run?.seed ?? "-"}`, color: "#b8c7df" },
  ];
}

export function createSkinLines({ economySnapshot }, state, t = translate) {
  const profile = economySnapshot?.profile ?? {};
  const ownedSkins = normalizeOwnedSkins(profile.ownedSkins);
  const equipped = ownedSkins.find((skin) => skin.id === profile.equippedSkinId);
  const current = equipped
    ? localizeSkin(equipped, t).name
    : t("role.skin.none");
  const lines = [
    { text: t("role.skin.summary", { count: ownedSkins.length, current }) },
  ];

  if (equipped) {
    lines.push({ text: t("role.skin.overridesClass"), color: "#f4d06f" });
  }

  if (ownedSkins.length === 0) {
    lines.push(
      { text: t("role.skin.empty") },
      { text: t("role.skin.exchangeHint"), color: "#b8c7df" },
    );
  }

  if (state.message) {
    lines.push({ text: state.message, color: "#b8c7df" });
  }

  return lines;
}

export function createSkinActions({ economySnapshot }, state, t = translate) {
  const profile = economySnapshot?.profile ?? {};
  const pending = state.pendingSkinId !== null;
  const actions = [{
    id: "skin-none",
    kind: "skin",
    skinId: null,
    label: t("role.skin.none"),
    accent: "#96cdff",
    color: profile.equippedSkinId === null ? "#f4d06f" : "#f7efd0",
    disabled: pending,
    disabledReason: t("role.skin.pending"),
  }];

  return actions.concat(normalizeOwnedSkins(profile.ownedSkins).map((skin) => {
    const equipped = skin.id === profile.equippedSkinId;
    const localizedSkin = localizeSkin(skin, t);

    return {
      id: `skin-${skin.id}`,
      kind: "skin",
      skinId: skin.id,
      label: t("skin.list.label", {
        name: localizedSkin.name,
        appearance: getSkinAppearanceLabel(skin.id, t),
        rarity: localizedSkin.rarityLabel,
        equipped: equipped ? `  ${t("role.skin.equipped")}` : "",
      }),
      accent: getRarityBorderColor(skin.rarity),
      color: equipped ? "#f4d06f" : "#f7efd0",
      disabled: pending,
      disabledReason: t("role.skin.pending"),
    };
  }));
}

export function createIdentityLines({ heroIdentity }, t = translate) {
  if (!heroIdentity) {
    return [
      { text: t("role.identity.empty") },
      {
        text: t("role.identity.createHint"),
        color: "#b8c7df",
      },
    ];
  }

  return [
    { text: t("role.identity.name", { name: heroIdentity.displayName }) },
    { text: t("role.identity.title", { title: heroIdentity.title }) },
    { text: t("role.identity.soulClass", { soul: heroIdentity.archetype, classId: heroIdentity.selectedClassId }) },
    { text: t("role.identity.faction", { faction: heroIdentity.factionAffinity?.join(" / ") ?? "-" }) },
    { text: t("role.identity.portrait", { portrait: heroIdentity.spriteVariant }) },
  ];
}

export function normalizeOwnedSkins(ownedSkins) {
  return Array.isArray(ownedSkins)
    ? ownedSkins.filter(
      (skin) => typeof skin?.id === "string" && skin.id.length > 0,
    )
    : [];
}
