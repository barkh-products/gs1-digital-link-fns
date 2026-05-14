# GS1 Digital Link Encoding/Decoding Specification

Status: URI Syntax 1.6.0 conformance specification for the library's uncompressed URI encoder/decoder.

Target standard: GS1 Digital Link Standard: URI Syntax 1.6.0, ratified March 2025.

## Source Notes

- GS1 Sweden describes Digital Link as a GS1 identifier in a web link, optionally with more details such as batch or serial number, and resolver-based routing to multiple information sources.
- The GS1 reference directory identifies "GS1 Digital Link Standard: URI Syntax" as the foundational standard for representing GS1 identification keys in web addresses.
- URI Syntax 1.6.0 states that GTIN-8, GTIN-12, and GTIN-13 must be expressed as 14 digits in Digital Link paths, using leading zero fill.
- URI Syntax 1.6.0 removed the old convenience alpha path names such as `/gtin/`; numeric AI path components are the supported representation.
- A GS1 Digital Link URI has exactly one primary key in the path. Additional primary keys, when needed, are encoded as query data attributes.
- Primary keys and key qualifiers are encoded as path AI/value pairs. Data attributes and extensions are encoded as query key/value pairs.
- Query keys must not repeat. If a key repeats in input, the last value takes precedence.

References:

- https://gs1.se/en/guides/how-to-guides/how-gs1-digital-link-works/
- https://ref.gs1.org/standards/digital-link/
- https://ref.gs1.org/standards/digital-link/uri-syntax/
- https://github.com/gs1/digital-link.js/

## Library Design

The library is deliberately functional:

- Public functions are pure.
- No function throws for user input validation. Failures return `Result<DigitalLinkError, A>`.
- Input objects are readonly.
- Encoding and decoding keep the GS1 AI values as strings because leading zeroes are significant.
- GTIN normalization from 8/12/13 digits to 14 digits is explicit via `normalizeGtin`; `encodeDigitalLink` and `decodeDigitalLink` validate the Digital Link form itself.

## Conformance Scope

Version 0.0 targets the uncompressed URI syntax defined in GS1 Digital Link URI Syntax 1.6.0.

Included:

- Decode uncompressed HTTP/HTTPS GS1 Digital Link URIs.
- Encode uncompressed HTTP/HTTPS GS1 Digital Link URIs.
- Preserve custom URI stems before the GS1 path.
- Validate primary key value formats for the primary AIs listed in URI Syntax 1.6.0 section 4.5.
- Validate key qualifier formats and path variants from sections 4.6 through 4.9, including mandatory `415` + `8020`, `upui-path`, `eoid-path`, `fid-path`, and `mid-path`.
- Validate the complete section 4.10 data attribute query catalogue included in URI Syntax 1.6.0.
- Validate extension query parameters from section 4.10.1, including rejection of all-numeric extension keys and reserved `linkType` / `context` keys.
- Parse query strings delimited by either `&` or `;`.
- Collapse duplicate query keys by last value.
- Reject fragment identifiers because the formal section 4.11 URI patterns do not include fragments.
- Accept the section 5 example URIs covered by the initial conformance suite.

Out of scope for this URI syntax library:

- Element string parsing and FNC1 group separator handling.
- GS1 check digit validation from the General Specifications.
- Resolver behavior and Resolver Description File checks from GS1-Conformant Resolver Standard.
- Semantic data relationship constraints from GS1 General Specifications section 4.14.

## API Sketch

```ts
type Result<E, A> =
  | { readonly tag: "Ok"; readonly value: A }
  | { readonly tag: "Err"; readonly error: E };

type AiPair = {
  readonly ai: string;
  readonly value: string;
};

type DigitalLink = {
  readonly stem: string;
  readonly primary: AiPair;
  readonly qualifiers?: readonly AiPair[];
  readonly attributes?: readonly AiPair[];
};

declare const encodeDigitalLink: (link: DigitalLink) => Result<DigitalLinkError, string>;
declare const decodeDigitalLink: (uri: string) => Result<DigitalLinkError, DigitalLink>;
declare const normalizeGtin: (value: string) => Result<DigitalLinkError, string>;
```

## Acceptance Tests

- Encoding GTIN `09520123456788` with stem `https://id.example` yields `https://id.example/01/09520123456788`.
- Decoding that URI returns the same stem and primary AI/value pair.
- GTIN values shorter than 14 digits are rejected in Digital Link paths.
- `normalizeGtin("9520123456788")` returns `09520123456788`.
- A GTIN path may contain qualifiers in the order `22`, `10`, `21`; `21` before `10` is rejected.
- Path values are percent-encoded so a lot value `ABC/123` is emitted as `ABC%2F123`.
- `/gtin/09520123456788` is rejected.
- Duplicate query keys decode with the last value taking precedence.
- `https://id.gs1.org/01/09520123456788?17=201225&3103=000195&3922=0299` is accepted.
- `https://id.gs1.org/414/9520123456788/254/32a%2Fb` decodes the qualifier value as `32a/b`.
- Query parameter `236=12098` is rejected because all-numeric extension keys are forbidden and AI `236` is not a defined data attribute.
- Query parameter `23P=12098` is accepted as an extension parameter.
