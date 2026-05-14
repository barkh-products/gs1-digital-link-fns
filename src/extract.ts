import type { AiPair, DigitalLink } from "./types.js";
import { attributeMetadata, primaryMetadata, qualifierMetadata } from "./ai.js";

const toLookupKey = (label: string): string =>
  label
    .replace(/[^0-9A-Za-z]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

const aiLookupKey = (ai: string): string => `AI_${ai}`;

const createLookup = (metadata: Readonly<Record<string, { readonly ai: string; readonly label: string }>>): Record<string, string> => {
  const entries = Object.values(metadata);
  const labelCounts = new Map<string, number>();

  for (const entry of entries) {
    const key = toLookupKey(entry.label);

    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  }

  const lookup: Record<string, string> = {};

  for (const entry of entries) {
    lookup[aiLookupKey(entry.ai)] = entry.ai;

    const labelKey = toLookupKey(entry.label);

    if (labelCounts.get(labelKey) === 1) {
      lookup[labelKey] = entry.ai;
    }
  }

  return lookup;
};

const manualAttributeAliases = {
  ADDITIONAL_PRODUCT_IDENTIFICATION: "240",
  BEST_BEFORE_DATE: "15",
  BILL_TO_GLN: "411",
  BIRTH_SEQUENCE: "7258",
  COUNTRY_OF_ORIGIN: "422",
  COUNT: "37",
  DUE_DATE: "12",
  EXPIRY_DATE: "17",
  EXPIRY_DATE_TIME: "7003",
  HARVEST_DATE: "7007",
  LOT: "10",
  PACKAGING_DATE: "13",
  PRODUCTION_DATE: "11",
  PRODUCTION_DATE_TIME: "8008",
  SELL_BY_DATE: "16",
  SHIP_TO_GLN: "410",
  VARIANT: "20",
  VARIABLE_COUNT: "30"
} as const;

const manualQualifierAliases = {
  BATCH_OR_LOT: "10",
  CONSUMER_PRODUCT_VARIANT: "22",
  CPID_SERIAL: "8011",
  GLN_EXTENSION: "254",
  LOT: "10",
  PAYMENT_REFERENCE: "8020",
  SERIAL: "21",
  SERVICE_RELATION_INSTANCE: "8019",
  THIRD_PARTY_SERIAL_EXTENSION: "235",
  UIC_EXTENSION: "7040"
} as const;

export const primaryKeyToAi = {
  ...createLookup(primaryMetadata)
} as Readonly<Record<string, string>>;

export const attributeKeyToAi = {
  ...createLookup(attributeMetadata),
  ...manualAttributeAliases
} as Readonly<Record<string, string>>;

export const qualifierKeyToAi = {
  ...createLookup(qualifierMetadata),
  ...manualQualifierAliases
} as Readonly<Record<string, string>>;

export const allKeyToAi = {
  ...primaryKeyToAi,
  ...attributeKeyToAi,
  ...qualifierKeyToAi
} as Readonly<Record<string, string>>;

export type KnownPrimaryKey = keyof typeof primaryKeyToAi;
export type KnownAttributeKey = keyof typeof attributeKeyToAi;
export type KnownQualifierKey = keyof typeof qualifierKeyToAi;
export type AiLookupKey<KnownKey extends string> = KnownKey | (string & {});

const resolveAi = <KnownKey extends string>(
  lookup: Readonly<Record<KnownKey, string>>,
  key: AiLookupKey<KnownKey>
): string => lookup[key as KnownKey] ?? key;

const extractPairValue = (pairs: readonly AiPair[] | undefined, ai: string): string | undefined => {
  if (pairs === undefined) {
    return undefined;
  }

  for (let index = pairs.length - 1; index >= 0; index -= 1) {
    const pair = pairs[index]!;

    if (pair.ai === ai) {
      return pair.value;
    }
  }

  return undefined;
};

export const extractAttributeValue = (
  link: DigitalLink,
  key: AiLookupKey<KnownAttributeKey>
): string | undefined => extractPairValue(link.attributes, resolveAi(attributeKeyToAi, key));

export const extractQualifierValue = (
  link: DigitalLink,
  key: AiLookupKey<KnownQualifierKey>
): string | undefined => extractPairValue(link.qualifiers, resolveAi(qualifierKeyToAi, key));

export const extractPrimaryValue = (link: DigitalLink, key: AiLookupKey<KnownPrimaryKey>): string | undefined => {
  const ai = resolveAi(primaryKeyToAi, key);

  return link.primary.ai === ai ? link.primary.value : undefined;
};
