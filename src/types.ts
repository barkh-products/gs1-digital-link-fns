export type AiPair = {
  readonly ai: string;
  readonly value: string;
};

export type DigitalLink = {
  readonly stem: string;
  readonly primary: AiPair;
  readonly qualifiers?: readonly AiPair[];
  readonly attributes?: readonly AiPair[];
  readonly fragment?: string;
};

export type DigitalLinkErrorCode =
  | "InvalidUri"
  | "UnsupportedScheme"
  | "MissingPrimaryKey"
  | "UnsupportedPrimaryKey"
  | "UnsupportedQualifier"
  | "UnsupportedAttribute"
  | "InvalidValue"
  | "InvalidPathOrder"
  | "InvalidStem"
  | "InvalidQuery"
  | "LegacyConvenienceAlpha"
  | "ReservedExtensionKey";

export type DigitalLinkError = {
  readonly code: DigitalLinkErrorCode;
  readonly message: string;
  readonly ai?: string;
};
