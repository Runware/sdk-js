import { Environment } from "./types";

export const ENVIRONMENT_URLS = {
  [Environment.DEVELOPMENT]: "wss://dev-ws-api.diffusionmaster.com/v1/",
  [Environment.PRODUCTION]: "wss://dev-ws-api.diffusionmaster.com/v1/",
};

export const removeFromAray = <T>(col: T[], targetElem: T) => {
  if (col == null) {
    return;
  }
  let i = col.indexOf(targetElem);
  if (i === -1) {
    return;
  }
  col.splice(i, 1);
};
