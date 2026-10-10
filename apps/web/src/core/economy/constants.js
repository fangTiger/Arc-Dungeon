import { SKIN_BOX_TOKEN_COST } from "./skins.js";
import { EXTRA_TICKET_TOKEN_COST } from "./tickets.js";

export const RUN_TICKET_TOKEN_COST = 0;
export const NEW_ACCOUNT_INITIAL_TOKENS = 15;
export const LOCAL_ACCOUNT_ID = "local-player";

export const NEW_ACCOUNT_INITIAL_BALANCE = Object.freeze({
  tokens: NEW_ACCOUNT_INITIAL_TOKENS,
});

export { EXTRA_TICKET_TOKEN_COST, SKIN_BOX_TOKEN_COST };
