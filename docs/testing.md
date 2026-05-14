# Testing

The test suite is intentionally tied to GS1 Digital Link URI Syntax 1.6.0:

- Primary key value formats, including the 14-digit GTIN rule, come from section 4.5 of the GS1 URI Syntax specification.
- Key qualifier value formats come from section 4.6.
- Numeric AI/value path concatenation comes from sections 4.7 and 4.8.
- Qualifier ordering, including the valid GTIN order `22`, `10`, `21`, is covered from section 4.9.
- Data attributes encoded as query key/value pairs are covered from section 4.10.
- Extension parameters, all-numeric extension key rejection, and reserved `linkType` / `context` handling are covered from section 4.10.1.
- `&` and `;` query delimiters are covered from section 4.11.
- The section 5 example URI set is represented in table-driven decoding tests.
- Percent encoding of literal `/` characters in AI values is covered by the examples in section 5.
- Fragment identifiers are rejected because the formal `referenceGS1webURI` and `uncompressedCustomGS1webURI` rules do not include fragments.

Reference: https://ref.gs1.org/standards/digital-link/uri-syntax/

Coverage is enforced at 100% for statements, branches, functions, and lines:

```sh
npm run coverage
```
