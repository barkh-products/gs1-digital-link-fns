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
export { decodeCompressedDigitalLink, encodeCompressedDigitalLink, isCompressedPathSegment } from "./compressed.js";
export { decodeDigitalLink, encodeDigitalLink, isDigitalLinkUri } from "./uri.js";
export type {
  AiPair,
  CompressedDigitalLinkFormat,
  DigitalLink,
  DigitalLinkError,
  DigitalLinkErrorCode,
  Sgtin96CompressionOptions
} from "./types.js";
