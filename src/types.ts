export type AiPair = {
  readonly ai: string;
  readonly value: string;
};

export type DigitalLink = {
  readonly stem: string;
  readonly primary: AiPair;
  readonly qualifiers?: readonly AiPair[];
  readonly attributes?: readonly AiPair[];
};

export type DigitalLinkErrorCode =
  | "InvalidUri"
  | "UnsupportedScheme"
  | "MissingPrimaryKey"
  | "UnsupportedPrimaryKey"
  | "UnsupportedQualifier"
  | "UnsupportedAttribute"
  | "InvalidCheckDigit"
  | "InvalidValue"
  | "InvalidPathOrder"
  | "InvalidStem"
  | "InvalidQuery"
  | "InvalidCompression"
  | "UnsupportedCompressionScheme"
  | "LegacyConvenienceAlpha"
  | "ReservedExtensionKey";

export type DigitalLinkError = {
  readonly code: DigitalLinkErrorCode;
  readonly message: string;
  readonly ai?: string;
};

export type CompressedDigitalLinkFormat = "hex" | "base64url";

export type Sgtin96CompressionOptions = {
  readonly companyPrefixLength: 6 | 7 | 8 | 9 | 10 | 11 | 12;
  readonly filter?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly format?: CompressedDigitalLinkFormat;
};
