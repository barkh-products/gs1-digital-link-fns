import { validatePrimary, validateQualifiers } from "./ai.js";
import { err, isErr, ok, type Result } from "./result.js";
import type { DigitalLink, DigitalLinkError, Sgtin96CompressionOptions } from "./types.js";

type EpcBits = {
  readonly bits: bigint;
  readonly bitLength: number;
};

type Partition = {
  readonly partition: number;
  readonly companyPrefixBits: number;
  readonly companyPrefixDigits: Sgtin96CompressionOptions["companyPrefixLength"];
  readonly itemReferenceBits: number;
  readonly itemReferenceDigits: number;
};

const sgtin96Header = 0x30;
const sgtin96BitLength = 96;
const maxSgtin96Serial = (1n << 38n) - 1n;
const base64UrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const partitionTable = [
  { partition: 0, companyPrefixBits: 40, companyPrefixDigits: 12, itemReferenceBits: 4, itemReferenceDigits: 1 },
  { partition: 1, companyPrefixBits: 37, companyPrefixDigits: 11, itemReferenceBits: 7, itemReferenceDigits: 2 },
  { partition: 2, companyPrefixBits: 34, companyPrefixDigits: 10, itemReferenceBits: 10, itemReferenceDigits: 3 },
  { partition: 3, companyPrefixBits: 30, companyPrefixDigits: 9, itemReferenceBits: 14, itemReferenceDigits: 4 },
  { partition: 4, companyPrefixBits: 27, companyPrefixDigits: 8, itemReferenceBits: 17, itemReferenceDigits: 5 },
  { partition: 5, companyPrefixBits: 24, companyPrefixDigits: 7, itemReferenceBits: 20, itemReferenceDigits: 6 },
  { partition: 6, companyPrefixBits: 20, companyPrefixDigits: 6, itemReferenceBits: 24, itemReferenceDigits: 7 }
] as const satisfies readonly Partition[];

export const isCompressedPathSegment = (segment: string): boolean =>
  /^(eh|ex)[0-9A-Za-z_-]{10,}$/.test(segment);

const calculateGs1CheckDigitValue = (valueWithoutCheckDigit: string): string => {
  let sum = 0;
  let reverseIndex = 0;

  for (let index = valueWithoutCheckDigit.length - 1; index >= 0; index -= 1) {
    sum += Number(valueWithoutCheckDigit[index]) * (reverseIndex % 2 === 0 ? 3 : 1);
    reverseIndex += 1;
  }

  return String((10 - (sum % 10)) % 10);
};

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

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const readBits = (epc: EpcBits, offset: number, length: number): bigint => {
  const shift = BigInt(epc.bitLength - offset - length);
  const mask = (1n << BigInt(length)) - 1n;

  return (epc.bits >> shift) & mask;
};

const appendBits = (current: bigint, value: bigint, length: number): bigint => (current << BigInt(length)) | value;

const leftPad = (value: string, length: number): string => value.padStart(length, "0");

const epcBitsFromHex = (payload: string): Result<DigitalLinkError, EpcBits> =>
  /^[0-9a-f]+$/.test(payload) && payload.length % 2 === 0
    ? ok({ bits: BigInt(`0x${payload}`), bitLength: payload.length * 4 })
    : err({
        code: "InvalidCompression",
        message: "Hex-compressed Digital Link payload must contain lowercase hexadecimal octets."
      });

const epcBitsFromBase64Url = (payload: string): Result<DigitalLinkError, EpcBits> => {
  let bits = 0n;

  for (const character of payload) {
    const value = base64UrlAlphabet.indexOf(character);

    bits = appendBits(bits, BigInt(value), 6);
  }

  return ok({ bits, bitLength: payload.length * 6 });
};

const epcBitsFromCompressedSegment = (segment: string): Result<DigitalLinkError, EpcBits> => {
  if (segment.startsWith("eh")) {
    return epcBitsFromHex(segment.slice(2));
  }

  return epcBitsFromBase64Url(segment.slice(2));
};

const decodeSgtin96 = (epc: EpcBits, stem: string): Result<DigitalLinkError, DigitalLink> => {
  if (epc.bitLength !== sgtin96BitLength) {
    return err({
      code: "InvalidCompression",
      message: "SGTIN-96 compressed Digital Link payload must contain exactly 96 bits."
    });
  }

  const header = Number(readBits(epc, 0, 8));

  if (header !== sgtin96Header) {
    return err({
      code: "UnsupportedCompressionScheme",
      message: `Unsupported EPC binary header 0x${header.toString(16).padStart(2, "0")}.`
    });
  }

  const partition = Number(readBits(epc, 11, 3));
  const partitionMetadata = partitionTable[partition];

  if (partitionMetadata === undefined) {
    return err({
      code: "InvalidCompression",
      message: `SGTIN-96 partition ${partition} is outside the valid range.`
    });
  }

  const companyPrefix = leftPad(
    readBits(epc, 14, partitionMetadata.companyPrefixBits).toString(),
    partitionMetadata.companyPrefixDigits
  );
  const itemReference = leftPad(
    readBits(epc, 14 + partitionMetadata.companyPrefixBits, partitionMetadata.itemReferenceBits).toString(),
    partitionMetadata.itemReferenceDigits
  );
  const serial = readBits(epc, 58, 38).toString();
  const body = `${itemReference[0]}${companyPrefix}${itemReference.slice(1)}`;
  const checkDigit = calculateGs1CheckDigitValue(body);

  return ok({
    stem,
    primary: { ai: "01", value: `${body}${checkDigit}` },
    qualifiers: [{ ai: "21", value: serial }],
    attributes: []
  });
};

const compressedStem = (url: URL, segment: string): string => {
  const pathBeforeSegment = url.pathname.slice(0, url.pathname.length - segment.length - 1);

  return pathBeforeSegment.length === 0 ? url.origin : `${url.origin}${pathBeforeSegment}`;
};

export const decodeCompressedDigitalLink = (uri: string): Result<DigitalLinkError, DigitalLink> => {
  const parsed = parseUrl(uri);

  if (isErr(parsed)) {
    return parsed;
  }

  const scheme = validateUrlScheme(parsed.value);

  if (isErr(scheme)) {
    return scheme;
  }

  if (parsed.value.search.length > 0 || parsed.value.hash.length > 0) {
    return err({
      code: "InvalidCompression",
      message: "Compressed Digital Link URIs must not include query strings or fragment identifiers."
    });
  }

  if (parsed.value.pathname.length <= 1 || parsed.value.pathname.endsWith("/")) {
    return err({
      code: "InvalidCompression",
      message: "Compressed Digital Link URI must end with a compressed path segment."
    });
  }

  const segment = parsed.value.pathname.split("/").at(-1)!;

  if (!isCompressedPathSegment(segment)) {
    return err({
      code: "InvalidCompression",
      message: "URI does not contain a supported compressed Digital Link path segment."
    });
  }

  const epc = epcBitsFromCompressedSegment(segment);

  if (isErr(epc)) {
    return epc;
  }

  return decodeSgtin96(epc.value, compressedStem(parsed.value, segment));
};

const partitionForCompanyPrefixLength = (
  companyPrefixLength: Sgtin96CompressionOptions["companyPrefixLength"]
): Partition => partitionTable.find((partition) => partition.companyPrefixDigits === companyPrefixLength)!;

const encodeBase64UrlBits = (value: bigint, bitLength: number): string => {
  let encoded = "";

  for (let offset = 0; offset < bitLength; offset += 6) {
    const shift = BigInt(bitLength - offset - 6);
    const index = Number((value >> shift) & 0x3fn);

    encoded += base64UrlAlphabet[index]!;
  }

  return encoded;
};

const encodeSgtin96Bits = (
  link: DigitalLink,
  options: Sgtin96CompressionOptions
): Result<DigitalLinkError, bigint> => {
  const primary = validatePrimary(link.primary);

  if (isErr(primary)) {
    return primary;
  }

  if (link.primary.ai !== "01") {
    return err({
      ai: link.primary.ai,
      code: "UnsupportedCompressionScheme",
      message: "Only SGTIN-96 compression for GTIN + serial Digital Links is currently supported."
    });
  }

  const qualifiers = link.qualifiers ?? [];
  const qualifierResult = validateQualifiers(link.primary.ai, qualifiers);

  if (isErr(qualifierResult)) {
    return qualifierResult;
  }

  if (qualifiers.length !== 1 || qualifiers[0]!.ai !== "21") {
    return err({
      code: "InvalidCompression",
      message: "SGTIN-96 compression requires exactly one serial number qualifier AI 21."
    });
  }

  if ((link.attributes ?? []).length > 0) {
    return err({
      code: "InvalidCompression",
      message: "SGTIN-96 compression cannot encode query data attributes."
    });
  }

  const serial = qualifiers[0]!.value;

  if (!/^\d+$/.test(serial)) {
    return err({
      ai: "21",
      code: "InvalidCompression",
      message: "SGTIN-96 serial values must be numeric."
    });
  }

  const serialValue = BigInt(serial);

  if (serialValue > maxSgtin96Serial) {
    return err({
      ai: "21",
      code: "InvalidCompression",
      message: "SGTIN-96 serial value exceeds the 38-bit limit."
    });
  }

  const partition = partitionForCompanyPrefixLength(options.companyPrefixLength);
  const gtinBody = link.primary.value.slice(0, 13);
  const companyPrefix = gtinBody.slice(1, 1 + partition.companyPrefixDigits);
  const itemReference = `${gtinBody[0]}${gtinBody.slice(1 + partition.companyPrefixDigits)}`;
  const filter = options.filter ?? 0;

  let bits = 0n;

  bits = appendBits(bits, BigInt(sgtin96Header), 8);
  bits = appendBits(bits, BigInt(filter), 3);
  bits = appendBits(bits, BigInt(partition.partition), 3);
  bits = appendBits(bits, BigInt(companyPrefix), partition.companyPrefixBits);
  bits = appendBits(bits, BigInt(itemReference), partition.itemReferenceBits);
  bits = appendBits(bits, serialValue, 38);

  return ok(bits);
};

export const encodeCompressedDigitalLink = (
  link: DigitalLink,
  options: Sgtin96CompressionOptions
): Result<DigitalLinkError, string> => {
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

  const bits = encodeSgtin96Bits(link, options);

  if (isErr(bits)) {
    return bits;
  }

  const format = options.format ?? "base64url";
  const compressed =
    format === "hex"
      ? `eh${bits.value.toString(16).padStart(24, "0")}`
      : `ex${encodeBase64UrlBits(bits.value, sgtin96BitLength)}`;

  return ok(`${trimTrailingSlash(link.stem)}/${compressed}`);
};
