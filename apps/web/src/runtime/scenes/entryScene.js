import { createPixelHero } from "../../core/identity/heroFactory.js";
import { createI18n } from "../../core/i18n/index.js";
import { drawEntryScene } from "./entrySceneUi.js";

const DISCORD_OPTION_ID = "discord";
const GUEST_OPTION_ID = "guest";

export function createEntryScene({
  surface,
  tileset,
  identityFlow,
  activityAvailable = false,
  webOAuthAvailable = false,
  authorizeDiscord,
  onIdentityResolved,
  enterClassSelection,
  i18n = createI18n(),
}) {
  const options = createLoginOptions(activityAvailable, webOAuthAvailable);
  let selectedIndex = options.findIndex(({ disabled }) => !disabled);
  let statusKey = activityAvailable
    ? "entry.status.chooseLogin"
    : webOAuthAvailable
      ? "entry.status.webOAuthAvailable"
      : "entry.status.discordUnavailable";
  let authorizing = false;
  let continued = false;
  let elapsedMs = 0;

  async function update(input, dt = 0) {
    elapsedMs += Number.isFinite(dt) && dt > 0 ? dt * 1000 : 0;
    if (input.wasPressed("language")) {
      i18n.toggleLanguage();
      return;
    }
    if (continued || authorizing) {
      return;
    }

    const direction = readDirection(input);
    if (direction !== 0) {
      selectedIndex = moveToEnabledOption(options, selectedIndex, direction);
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    const selectedOption = options[selectedIndex];
    if (selectedOption.id === GUEST_OPTION_ID) {
      continueAsGuest();
      return;
    }

    await loginWithDiscord();
  }

  async function loginWithDiscord() {
    authorizing = true;
    statusKey = "entry.status.requesting";

    try {
      const result = await authorizeDiscord?.();
      if (result?.redirecting) {
        statusKey = "entry.status.redirecting";
        return;
      }
      const activityIdentity = result?.activityIdentity;
      const authenticated = activityIdentity?.kind === "discord"
        && activityIdentity.authenticated === true;

      if (!authenticated) {
        applyGuestFallback(result);
        return;
      }

      identityFlow.setHeroIdentity(result.heroIdentity, result.personaPreview?.source);
      await onIdentityResolved?.(result);
      statusKey = "entry.status.connected";
      continued = true;
      enterClassSelection();
    } catch {
      applyGuestFallback(null);
    } finally {
      authorizing = false;
    }
  }

  function applyGuestFallback(result) {
    const guestIdentity = result?.heroIdentity ?? createPixelHero({ t: i18n.t });
    identityFlow.setHeroIdentity(guestIdentity);
    void onIdentityResolved?.(result ?? {
      activityIdentity: { kind: "guest", authenticated: false },
      personaPreview: null,
      heroIdentity: guestIdentity,
    });
    selectedIndex = options.findIndex(({ id }) => id === GUEST_OPTION_ID);
    statusKey = "entry.status.authorizationFailedContinue";
  }

  function continueAsGuest() {
    const guestIdentity = createPixelHero({ t: i18n.t });
    identityFlow.setHeroIdentity(guestIdentity);
    void onIdentityResolved?.({
      activityIdentity: { kind: "guest", authenticated: false },
      personaPreview: null,
      heroIdentity: guestIdentity,
    });
    continued = true;
    enterClassSelection();
  }

  function render(context) {
    const localizedOptions = localizeLoginOptions(options, i18n.t);
    return drawEntryScene(context, {
      width: surface.width,
      height: surface.height,
      tileset,
      options: localizedOptions,
      selectedIndex,
      statusKey,
      statusText: i18n.t(statusKey),
      authorizing,
      elapsedMs,
      t: i18n.t,
    });
  }

  return {
    update,
    render,
    getSelectedOptionId: () => options[selectedIndex].id,
    getStatusText: () => i18n.t(statusKey),
    getLanguage: i18n.getLanguage,
  };
}

function createLoginOptions(activityAvailable, webOAuthAvailable) {
  const discordAvailable = activityAvailable || webOAuthAvailable;
  return [
    {
      id: DISCORD_OPTION_ID,
      labelKey: "entry.option.discord.label",
      disabled: !discordAvailable,
      disabledReasonKey: discordAvailable
        ? null
        : "entry.option.discord.unavailableReason",
    },
    {
      id: GUEST_OPTION_ID,
      labelKey: "entry.option.guest.label",
      disabled: false,
      disabledReasonKey: null,
    },
  ];
}

function localizeLoginOptions(options, t) {
  return options.map((option) => ({
    id: option.id,
    label: t(option.labelKey),
    disabled: option.disabled,
    disabledReason: option.disabledReasonKey ? t(option.disabledReasonKey) : null,
  }));
}

function moveToEnabledOption(options, selectedIndex, direction) {
  for (let step = 1; step <= options.length; step += 1) {
    const index = (selectedIndex + direction * step + options.length) % options.length;
    if (!options[index].disabled) {
      return index;
    }
  }
  return selectedIndex;
}

function readDirection(input) {
  if (input.wasPressed("up") || input.wasPressed("left")) {
    return -1;
  }
  if (input.wasPressed("down") || input.wasPressed("right")) {
    return 1;
  }
  return 0;
}
