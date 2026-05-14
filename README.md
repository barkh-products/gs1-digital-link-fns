# gs1-digital-link-fns

Production-ready functional TypeScript utilities for encoding, decoding, and validating uncompressed GS1 Digital Link URIs.

The library targets **GS1 Digital Link URI Syntax 1.6.0**. Its public API is pure, typed, and returns `Result` values instead of throwing for user-input validation failures.

## Installation

```sh
npm install gs1-digital-link-fns
```

Runtime requirements:

- Node.js 22 or newer
- ESM-compatible TypeScript or JavaScript project

Runtime dependency policy:

- Zero package runtime dependencies
- No peer, optional, bundled, or transitive runtime dependency contract
- No bare external runtime imports from `src`

## What It Does

- Encodes structured GS1 Digital Link data into uncompressed HTTP/HTTPS URIs.
- Decodes uncompressed GS1 Digital Link URIs into typed data.
- Validates primary identifier keys from URI Syntax 1.6.0.
- Validates key qualifier formats and allowed qualifier path variants.
- Validates GS1 data attributes and extension query parameters.
- Validates GS1 check digits where the URI syntax validation guidance identifies a check digit position.
- Normalizes GTIN-8, GTIN-12, GTIN-13, and GTIN-14 values to the 14-digit Digital Link path form.
- Preserves custom URI stems before the GS1 path.
- Percent-encodes path and query values according to the URI syntax character rules.

## Scope

Included:

- Uncompressed GS1 Digital Link URI syntax
- HTTP and HTTPS URI schemes
- Numeric AI path components
- Query data attributes and extension parameters
- Duplicate query keys collapsed by last value
- Query strings delimited by either `&` or `;`

Not included:

- Compressed Digital Link URI syntax
- GS1 resolver behavior
- Resolver Description File validation
- Element string parsing
- FNC1 group separator handling
- Semantic relationship rules from the GS1 General Specifications

## Quick Start

```ts
import { decodeDigitalLink, encodeDigitalLink, isOk } from "gs1-digital-link-fns";

const encoded = encodeDigitalLink({
  stem: "https://id.example",
  primary: { ai: "01", value: "09520123456788" },
  qualifiers: [{ ai: "10", value: "ABC/123" }],
  attributes: [{ ai: "17", value: "250101" }]
});

if (isOk(encoded)) {
  console.log(encoded.value);
  // https://id.example/01/09520123456788/10/ABC%2F123?17=250101
}

const decoded = decodeDigitalLink("https://id.example/01/09520123456788/10/ABC%2F123?17=250101");

if (isOk(decoded)) {
  console.log(decoded.value.primary);
  // { ai: "01", value: "09520123456788" }
}
```

## API

### `encodeDigitalLink(link)`

Encodes a structured `DigitalLink` object as a GS1 Digital Link URI.

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

Returns:

```ts
Result<DigitalLinkError, string>
```

### `decodeDigitalLink(uri)`

Parses, validates, and decodes an uncompressed GS1 Digital Link URI.

Returns:

```ts
Result<DigitalLinkError, DigitalLink>
```

### `isDigitalLinkUri(uri)`

Returns `true` when `decodeDigitalLink(uri)` succeeds.

```ts
import { isDigitalLinkUri } from "gs1-digital-link-fns";

isDigitalLinkUri("https://id.gs1.org/01/09520123456788");
```

### `normalizeGtin(value)`

Pads GTIN-8, GTIN-12, and GTIN-13 values to the 14-digit Digital Link path form.

```ts
import { normalizeGtin } from "gs1-digital-link-fns";

const gtin = normalizeGtin("9520123456788");
// Ok("09520123456788")
```

### `calculateGs1CheckDigit(valueWithoutCheckDigit)`

Calculates the GS1 modulo-10 check digit for a numeric value body.

```ts
import { calculateGs1CheckDigit } from "gs1-digital-link-fns";

const digit = calculateGs1CheckDigit("0952012345678");
// Ok("8")
```

## Result Handling

Validation errors are returned as data.

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

The package also exports small `Result` helpers:

- `ok`
- `err`
- `isOk`
- `isErr`
- `map`
- `flatMap`

## Error Codes

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

## Conformance And Testing

The test suite is mapped to GS1 Digital Link URI Syntax 1.6.0 and enforces 100% coverage for statements, branches, functions, and lines.

```sh
npm run check
```

`npm run check` runs:

- Runtime dependency policy validation
- Type checking with `tsgo`
- Vitest with coverage
- ESM and declaration builds through `tsdown`

Additional project notes:

- [docs/specification.md](docs/specification.md) describes the supported URI syntax scope.
- [docs/testing.md](docs/testing.md) describes the standard-based test coverage.

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

The project is configured for TypeScript 7 beta through `@typescript/native-preview` and `tsgo`. `typescript` is kept as a compatibility dependency for tools that still resolve the classic package.
