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
export { calculateGs1CheckDigit } from "./check-digit.js";
export {
  allKeyToAi,
  attributeKeyToAi,
  extractAttributeValue,
  extractPrimaryValue,
  extractQualifierValue,
  primaryKeyToAi,
  qualifierKeyToAi,
  type KnownAttributeKey,
  type KnownPrimaryKey,
  type KnownQualifierKey
} from "./extract.js";
export { decodeDigitalLink, encodeDigitalLink, isDigitalLinkUri } from "./uri.js";
export type { AiPair, DigitalLink, DigitalLinkError, DigitalLinkErrorCode } from "./types.js";
