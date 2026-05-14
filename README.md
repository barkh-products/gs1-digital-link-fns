# gs1-digital-link-fns

Functional TypeScript utilities for encoding and decoding GS1 Digital Link URIs.

This is an early scaffold targeting GS1 Digital Link URI Syntax 1.6.0. The core API is pure and returns `Result` values instead of throwing.

```ts
import { decodeDigitalLink, encodeDigitalLink } from "gs1-digital-link-fns";

const encoded = encodeDigitalLink({
  stem: "https://id.example",
  primary: { ai: "01", value: "09520123456788" },
  qualifiers: [{ ai: "10", value: "ABC/123" }],
  attributes: [{ ai: "17", value: "250101" }]
});

const decoded = decodeDigitalLink("https://id.example/01/09520123456788/10/ABC%2F123?17=250101");
```

## Development

```sh
npm install
npm run check
```

The project is configured for TypeScript 7 beta through `@typescript/native-preview` and `tsgo`. `typescript` is kept as a compatibility dependency for tools that still resolve the classic package.

The test suite enforces 100% coverage and is mapped to the online GS1 Digital Link URI Syntax specification in `docs/testing.md`.
