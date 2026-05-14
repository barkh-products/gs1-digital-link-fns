export {
  flatMap,
  isErr,
  isOk,
  map,
  ok,
  err,
  type Err,
  type Ok,
  type Result
} from "./result.js";
export { normalizeGtin } from "./ai.js";
export { decodeDigitalLink, encodeDigitalLink, isDigitalLinkUri } from "./uri.js";
export type { AiPair, DigitalLink, DigitalLinkError, DigitalLinkErrorCode } from "./types.js";
