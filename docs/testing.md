# Testing

The test suite is intentionally tied to GS1 Digital Link URI Syntax 1.6.0:

- `test/uri-syntax-conformance.test.ts` encodes the normative ABNF sections as data-driven test matrices.
- Every primary identifier key listed in section 4.3 is tested with a valid and invalid section 4.5 value.
- Every key qualifier listed in section 4.4 is tested with valid and invalid section 4.6 values.
- Every `gs1path` variant listed in section 4.9 is tested, including negative tests for forbidden sequences.
- Every data attribute code or code family listed in section 4.10 is represented in the query attribute matrix.
- GS1 check digit positions from the Digital Link validation guidance are tested for primary identifiers and data attributes `02`, `410`, `411`, `412`, `413`, `414`, `415`, and `416`.
- The suite does not depend on `digital-link.js`. That package can be used temporarily to validate fixture design, then the resulting cases must be committed as static standard-based tests.
- Primary key value formats, including the 14-digit GTIN rule, come from section 4.5 of the GS1 URI Syntax specification.
- Key qualifier value formats come from section 4.6.
- Numeric AI/value path concatenation comes from sections 4.7 and 4.8.
- Qualifier ordering, including the valid GTIN order `22`, `10`, `21`, is covered from section 4.9.
- Data attributes encoded as query key/value pairs are covered from section 4.10.
- Extension parameters, all-numeric extension key rejection, and reserved `linkType` / `context` handling are covered from section 4.10.1.
- `&` and `;` query delimiters are covered from section 4.11.
- The section 5 example URI set is represented in table-driven decoding tests.
- Percent encoding of literal `/` characters in AI values is covered by the examples in section 5.
- Percent encoding of literal `!`, `'`, `(`, `)`, and `*` is covered because JavaScript's standard `encodeURIComponent` does not escape those characters by default.
- Fragment identifiers are rejected because the formal `referenceGS1webURI` and `uncompressedCustomGS1webURI` rules do not include fragments.

Reference: https://ref.gs1.org/standards/digital-link/uri-syntax/

Coverage is enforced at 100% for statements, branches, functions, and lines:

```sh
npm run coverage
```

Runtime dependency policy is enforced separately:

```sh
npm run check:runtime-deps
```

That check fails if runtime dependency fields are added to the package manifest or root lockfile entry, or if source files import bare external runtime modules.
