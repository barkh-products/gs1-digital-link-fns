import type { AiPair, DigitalLink } from "./types.js";
export { allKeyToAi, attributeKeyToAi, primaryKeyToAi, qualifierKeyToAi } from "./ai-keys.js";
import { attributeKeyToAi, primaryKeyToAi, qualifierKeyToAi } from "./ai-keys.js";

export type KnownPrimaryKey = keyof typeof primaryKeyToAi;
export type KnownAttributeKey = keyof typeof attributeKeyToAi;
export type KnownQualifierKey = keyof typeof qualifierKeyToAi;

const resolveAi = <KnownKey extends string>(lookup: Readonly<Record<KnownKey, string>>, key: KnownKey): string => lookup[key];

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
  key: KnownAttributeKey
): string | undefined => extractPairValue(link.attributes, resolveAi(attributeKeyToAi, key));

export const extractQualifierValue = (
  link: DigitalLink,
  key: KnownQualifierKey
): string | undefined => extractPairValue(link.qualifiers, resolveAi(qualifierKeyToAi, key));

export const extractPrimaryValue = (link: DigitalLink, key: KnownPrimaryKey): string | undefined => {
  const ai = resolveAi(primaryKeyToAi, key);

  return link.primary.ai === ai ? link.primary.value : undefined;
};
