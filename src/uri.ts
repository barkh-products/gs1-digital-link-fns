import {
  isLegacyConvenienceAlpha,
  isPrimaryAi,
  isQualifierAi,
  validateAttributes,
  validatePrimary,
  validateQualifiers
} from "./ai.js";
import { err, isErr, ok, type Result } from "./result.js";
import type { AiPair, DigitalLink, DigitalLinkError } from "./types.js";

const encodeGs1Value = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const decodeSegment = (value: string): Result<DigitalLinkError, string> => {
  try {
    return ok(decodeURIComponent(value));
  } catch {
    return err({
      code: "InvalidUri",
      message: `Path segment ${value} is not valid percent-encoded data.`
    });
  }
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const parseUrl = (uri: string): Result<DigitalLinkError, URL> => {
  try {
    return ok(new URL(uri));
  } catch {
    return err({ code: "InvalidUri", message: `${uri} is not a valid absolute URI.` });
  }
};

const validateUrlScheme = (url: URL): Result<DigitalLinkError, URL> =>
  url.protocol === "http:" || url.protocol === "https:"
    ? ok(url)
    : err({
        code: "UnsupportedScheme",
        message: "GS1 Digital Link URIs must use http or https."
      });

const findPrimaryIndex = (segments: readonly string[]): Result<DigitalLinkError, number> => {
  const legacy = segments.find(isLegacyConvenienceAlpha);

  if (legacy !== undefined) {
    return err({
      ai: legacy,
      code: "LegacyConvenienceAlpha",
      message: `Legacy convenience alpha ${legacy} is not supported by URI Syntax 1.6.0.`
    });
  }

  const index = segments.findIndex(isPrimaryAi);

  return index === -1
    ? err({ code: "MissingPrimaryKey", message: "URI path does not contain a supported primary AI." })
    : ok(index);
};

const pairSegments = (segments: readonly string[]): Result<DigitalLinkError, readonly AiPair[]> => {
  if (segments.length % 2 !== 0) {
    return err({
      code: "InvalidUri",
      message: "GS1 path must contain AI/value pairs."
    });
  }

  const pairs: AiPair[] = [];

  for (let index = 0; index < segments.length; index += 2) {
    const ai = segments[index]!;
    const encodedValue = segments[index + 1]!;

    const value = decodeSegment(encodedValue);

    if (isErr(value)) {
      return value;
    }

    pairs.push({ ai, value: value.value });
  }

  return ok(pairs);
};

const decodeQueryComponent = (value: string): Result<DigitalLinkError, string> => {
  try {
    return ok(decodeURIComponent(value));
  } catch {
    return err({
      code: "InvalidQuery",
      message: `Query component ${value} is not valid percent-encoded data.`
    });
  }
};

const queryPairs = (url: URL): Result<DigitalLinkError, readonly AiPair[]> => {
  const collapsed = new Map<string, string>();
  const rawQuery = url.search.startsWith("?") ? url.search.slice(1) : url.search;

  if (rawQuery.length === 0) {
    return ok([]);
  }

  for (const parameter of rawQuery.split(/[&;]/)) {
    const separator = parameter.indexOf("=");

    if (separator === -1) {
      return err({
        code: "InvalidQuery",
        message: `Query parameter ${parameter} is not a key=value pair.`
      });
    }

    const key = decodeQueryComponent(parameter.slice(0, separator));
    const value = decodeQueryComponent(parameter.slice(separator + 1));

    if (isErr(key)) {
      return key;
    }

    if (isErr(value)) {
      return value;
    }

    collapsed.set(key.value, value.value);
  }

  return ok([...collapsed.entries()].map(([ai, value]) => ({ ai, value })));
};

export const decodeDigitalLink = (uri: string): Result<DigitalLinkError, DigitalLink> => {
  const parsed = parseUrl(uri);

  if (isErr(parsed)) {
    return parsed;
  }

  const scheme = validateUrlScheme(parsed.value);

  if (isErr(scheme)) {
    return scheme;
  }

  if (parsed.value.hash.length > 0) {
    return err({
      code: "InvalidUri",
      message: "GS1 Digital Link URI syntax does not include fragment identifiers."
    });
  }

  if (parsed.value.pathname.length > 1 && parsed.value.pathname.endsWith("/")) {
    return err({
      code: "InvalidUri",
      message: "GS1 Digital Link URI syntax does not include a trailing slash."
    });
  }

  const pathSegments = parsed.value.pathname.split("/").filter((segment) => segment.length > 0);
  const primaryIndex = findPrimaryIndex(pathSegments);

  if (isErr(primaryIndex)) {
    return primaryIndex;
  }

  const stemSegments = pathSegments.slice(0, primaryIndex.value);
  const gs1Segments = pathSegments.slice(primaryIndex.value);
  const pairs = pairSegments(gs1Segments);

  if (isErr(pairs)) {
    return pairs;
  }

  const primary = pairs.value[0]!;
  const qualifiers = pairs.value.slice(1);

  const primaryResult = validatePrimary(primary);

  if (isErr(primaryResult)) {
    return primaryResult;
  }

  if (qualifiers.some((pair) => !isQualifierAi(pair.ai))) {
    const invalid = qualifiers.find((pair) => !isQualifierAi(pair.ai));

    return err({
      ai: invalid!.ai,
      code: "UnsupportedQualifier",
      message: `AI ${invalid!.ai} is not a supported key qualifier.`
    });
  }

  const qualifierResult = validateQualifiers(primary.ai, qualifiers);

  if (isErr(qualifierResult)) {
    return qualifierResult;
  }

  const attributes = queryPairs(parsed.value);

  if (isErr(attributes)) {
    return attributes;
  }

  const attributeResult = validateAttributes(attributes.value);

  if (isErr(attributeResult)) {
    return attributeResult;
  }

  const stemPath = stemSegments.length === 0 ? "" : `/${stemSegments.map(encodeGs1Value).join("/")}`;
  const stem = `${parsed.value.origin}${stemPath}`;

  return ok({
    stem,
    primary,
    qualifiers,
    attributes: attributes.value
  });
};

export const encodeDigitalLink = (link: DigitalLink): Result<DigitalLinkError, string> => {
  const stem = parseUrl(link.stem);

  if (isErr(stem)) {
    return err({ code: "InvalidStem", message: `${link.stem} is not a valid URI stem.` });
  }

  const scheme = validateUrlScheme(stem.value);

  if (isErr(scheme)) {
    return scheme;
  }

  if (link.stem.includes("?") || link.stem.includes("#")) {
    return err({
      code: "InvalidStem",
      message: "URI stem must not include a query string or fragment."
    });
  }

  const primary = validatePrimary(link.primary);

  if (isErr(primary)) {
    return primary;
  }

  const qualifiers = link.qualifiers ?? [];
  const qualifierResult = validateQualifiers(link.primary.ai, qualifiers);

  if (isErr(qualifierResult)) {
    return qualifierResult;
  }

  const attributes = link.attributes ?? [];
  const attributeResult = validateAttributes(attributes);

  if (isErr(attributeResult)) {
    return attributeResult;
  }

  const pathPairs = [link.primary, ...qualifiers]
    .flatMap((pair) => [pair.ai, encodeGs1Value(pair.value)])
    .join("/");
  const base = `${trimTrailingSlash(link.stem)}/${pathPairs}`;
  const params = new Map<string, string>();

  for (const attribute of attributes) {
    params.set(attribute.ai, attribute.value);
  }

  const query =
    params.size > 0
      ? `?${[...params.entries()].map(([key, value]) => `${encodeGs1Value(key)}=${encodeGs1Value(value)}`).join("&")}`
      : "";

  return ok(`${base}${query}`);
};

export const isDigitalLinkUri = (uri: string): boolean => decodeDigitalLink(uri).ok;
