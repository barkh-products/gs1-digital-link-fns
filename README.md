# gs1-digital-link-fns

[![CI](https://github.com/barkh-products/gs1-digital-link-fns/actions/workflows/ci.yml/badge.svg)](https://github.com/barkh-products/gs1-digital-link-fns/actions/workflows/ci.yml)

A small, production-ready TypeScript library for working with uncompressed GS1 Digital Link URIs.

`gs1-digital-link-fns` helps you turn structured GS1 Application Identifier data into valid Digital Link URLs, and parse those URLs back into typed data. It is built for services and applications that need predictable validation, no runtime dependencies, and explicit error handling.

The implementation targets **GS1 Digital Link URI Syntax 1.6.0**.

## Install

```sh
npm install gs1-digital-link-fns
```

Requirements:

- Node.js 22 or newer
- ESM-compatible JavaScript or TypeScript project

The package has no runtime dependencies.

## Quick Start

```ts
import { decodeDigitalLink, encodeDigitalLink } from "gs1-digital-link-fns";

const encoded = encodeDigitalLink({
  stem: "https://id.example",
  primary: { ai: "01", value: "09520123456788" },
  qualifiers: [{ ai: "10", value: "ABC/123" }],
  attributes: [{ ai: "17", value: "250101" }]
});

if (encoded.ok) {
  console.log(encoded.value);
  // https://id.example/01/09520123456788/10/ABC%2F123?17=250101
}

const decoded = decodeDigitalLink("https://id.example/01/09520123456788/10/ABC%2F123?17=250101");

if (decoded.ok) {
  console.log(decoded.value.primary);
  // { ai: "01", value: "09520123456788" }
}
```

## Extracting Values

Decoded links keep GS1 values as AI/value pairs, but helpers are available when application code wants named fields.

```ts
import { decodeDigitalLink, extractAttributeValue, extractQualifierValue } from "gs1-digital-link-fns";

const result = decodeDigitalLink("https://id.example/01/09520123456788/10/LOT123?17=250101");

if (result.ok) {
  const expiryDate = extractAttributeValue(result.value, "EXPIRY_DATE");
  const lot = extractQualifierValue(result.value, "BATCH_OR_LOT");
}
```

Extractor keys can be:

- semantic keys such as `EXPIRY_DATE`, `BATCH_OR_LOT`, or `PAYMENT_REFERENCE`
- generated AI keys such as `AI_17`, `AI_10`, or `AI_8020`
- raw AI strings such as `17`, `10`, or `8020`

The package exports `attributeKeyToAi`, `qualifierKeyToAi`, `primaryKeyToAi`, and `allKeyToAi`. These lookup maps are generated from the documented AI catalogue encoded by the library, so every supported documented AI has at least an `AI_<code>` key.

## Design

The public API is intentionally functional:

- Functions are pure.
- Validation failures are returned as `Result` values instead of thrown exceptions.
- GS1 AI values are kept as strings because leading zeroes are significant.
- Input and output types are readonly.
- Encoding and decoding do not depend on process state, clocks, network calls, or global configuration.

This makes the library straightforward to use in request handlers, background jobs, validation pipelines, and tests.

## What Is Supported

The library covers the uncompressed URI syntax parts of GS1 Digital Link URI Syntax 1.6.0:

- HTTP and HTTPS Digital Link URIs
- Numeric AI path components
- Custom URI stems before the GS1 path
- Primary identifier keys listed by the URI syntax standard
- Key qualifier formats and allowed path variants
- GS1 data attributes in query parameters
- Extension query parameters
- GS1 check digit validation where identified by the Digital Link validation guidance
- Percent-encoding for path and query values
- Duplicate query keys, with the last value taking precedence
- Query strings using either `&` or `;` delimiters

It does not implement:

- Compressed Digital Link URI syntax
- GS1 resolver behavior
- Resolver Description File validation
- Element string parsing
- FNC1 group separator handling
- Semantic relationship rules from the GS1 General Specifications

## API

### `encodeDigitalLink(link)`

Encodes a structured `DigitalLink` object into a GS1 Digital Link URI.

```ts
type DigitalLink = {
  readonly stem: string;
  readonly primary: AiPair;
  readonly qualifiers?: readonly AiPair[];
  readonly attributes?: readonly AiPair[];
};

type AiPair = {
  readonly ai: string;
  readonly value: string;
};
```

```ts
const result = encodeDigitalLink({
  stem: "https://id.gs1.org",
  primary: { ai: "01", value: "09520123456788" },
  qualifiers: [{ ai: "21", value: "SERIAL123" }]
});
```

Returns `Result<DigitalLinkError, string>`.

### `decodeDigitalLink(uri)`

Parses, validates, and decodes an uncompressed GS1 Digital Link URI.

```ts
const result = decodeDigitalLink("https://id.gs1.org/01/09520123456788/21/SERIAL123");
```

Returns `Result<DigitalLinkError, DigitalLink>`.

### `isDigitalLinkUri(uri)`

Returns `true` when a URI can be decoded as a supported GS1 Digital Link URI.

```ts
isDigitalLinkUri("https://id.gs1.org/01/09520123456788");
```

### `normalizeGtin(value)`

Normalizes GTIN-8, GTIN-12, GTIN-13, or GTIN-14 input to the 14-digit Digital Link path form.

```ts
const gtin = normalizeGtin("9520123456788");

if (isOk(gtin)) {
  console.log(gtin.value);
  // 09520123456788
}
```

### `calculateGs1CheckDigit(valueWithoutCheckDigit)`

Calculates the GS1 modulo-10 check digit for a numeric value body.

```ts
const digit = calculateGs1CheckDigit("0952012345678");

if (isOk(digit)) {
  console.log(digit.value);
  // 8
}
```

### Extraction helpers

Decoded links keep AI/value pairs in their GS1 form. For application code that wants named accessors, the package also exports lookup maps and small extraction helpers:

```ts
const link = decodeDigitalLink("https://id.example/01/09520123456788/10/LOT123?17=250101");

if (isOk(link)) {
  extractPrimaryValue(link.value, "GTIN");
  extractQualifierValue(link.value, "LOT");
  extractAttributeValue(link.value, "EXPIRY_DATE");
}
```

You can pass semantic keys such as `GTIN`, lookup keys such as `AI_01`, or raw AI strings such as `01`.

## Handling Errors

Every validation function returns a boolean-discriminated `Result` union, so validation errors are handled as data. You can narrow with `isOk`, `isErr`, or `result.ok`.

```ts
import { encodeDigitalLink, isErr } from "gs1-digital-link-fns";

const result = encodeDigitalLink({
  stem: "https://id.example",
  primary: { ai: "01", value: "9520123456788" }
});

if (isErr(result)) {
  console.error(result.error.code);
  // InvalidValue
}
```

The package also exports small `Result` helpers for composition-heavy code:

- `ok`
- `err`
- `isOk`
- `isErr`
- `map`
- `flatMap`

`DigitalLinkError.code` is one of:

- `InvalidUri`
- `UnsupportedScheme`
- `MissingPrimaryKey`
- `UnsupportedPrimaryKey`
- `UnsupportedQualifier`
- `UnsupportedAttribute`
- `InvalidCheckDigit`
- `InvalidValue`
- `InvalidPathOrder`
- `InvalidStem`
- `InvalidQuery`
- `LegacyConvenienceAlpha`
- `ReservedExtensionKey`

## Conformance

The test suite is mapped to GS1 Digital Link URI Syntax 1.6.0 and enforces 100% coverage for statements, branches, functions, and lines.

```sh
npm run check
```

`npm run check` runs:

- Runtime dependency policy validation
- Type checking with `tsgo`
- Vitest with coverage
- ESM and declaration builds through `tsdown`

More detail:

- [docs/specification.md](docs/specification.md) describes the supported URI syntax scope.
- [docs/testing.md](docs/testing.md) explains how the test suite maps back to the standard.

## Development

```sh
npm ci
npm run check
```

Useful commands:

```sh
npm run typecheck
npm run test
npm run coverage
npm run build
npm run check:runtime-deps
```

The project currently uses TypeScript 7 beta through `@typescript/native-preview` and `tsgo`. `typescript` is kept as a compatibility dependency for tools that still resolve the classic package.
