import { describe, expect, it } from "vitest";
import {
  decodeCompressedDigitalLink,
  decodeDigitalLink,
  encodeCompressedDigitalLink,
  encodeDigitalLink,
  extractAttributeValue,
  extractPrimaryValue,
  extractQualifierValue,
  flatMap,
  isDigitalLinkUri,
  isErr,
  isOk,
  map,
  normalizeGtin,
  ok,
  allKeyToAi,
  attributeKeyToAi,
  primaryKeyToAi,
  qualifierKeyToAi,
  type DigitalLink
} from "../src/index.js";

const expectOk = <A>(result: { readonly ok: true; readonly value: A } | { readonly ok: false; readonly error: unknown }): A => {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  return result.value;
};

describe("GS1 Digital Link URI encoding", () => {
  it("encodes a GTIN primary key as numeric AI path segments", () => {
    const link: DigitalLink = {
      stem: "https://id.example",
      primary: { ai: "01", value: "09520123456788" }
    };

    expect(expectOk(encodeDigitalLink(link))).toBe("https://id.example/01/09520123456788");
  });

  it("percent-encodes qualifier path values", () => {
    const uri = expectOk(
      encodeDigitalLink({
        stem: "https://id.example/products",
        primary: { ai: "01", value: "09520123456788" },
        qualifiers: [{ ai: "10", value: "ABC/123" }],
        attributes: [{ ai: "17", value: "250101" }]
      })
    );

    expect(uri).toBe("https://id.example/products/01/09520123456788/10/ABC%2F123?17=250101");
  });

  it("percent-encodes GS1 literal symbol characters that encodeURIComponent leaves unescaped", () => {
    const uri = expectOk(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        qualifiers: [{ ai: "10", value: "A!'()*" }],
        attributes: [{ ai: "23P", value: "V!'()*" }]
      })
    );

    expect(uri).toBe("https://id.example/01/09520123456788/10/A%21%27%28%29%2A?23P=V%21%27%28%29%2A");
  });

  it("encodes duplicate attributes with the last value taking precedence", () => {
    const uri = expectOk(
      encodeDigitalLink({
        stem: "https://id.example/",
        primary: { ai: "01", value: "09520123456788" },
        attributes: [
          { ai: "17", value: "240101" },
          { ai: "17", value: "250101" }
        ]
      })
    );

    expect(uri).toBe("https://id.example/01/09520123456788?17=250101");
  });

  it("rejects path qualifiers that violate the primary key order", () => {
    const result = encodeDigitalLink({
      stem: "https://id.example",
      primary: { ai: "01", value: "09520123456788" },
      qualifiers: [
        { ai: "21", value: "SERIAL" },
        { ai: "10", value: "LOT" }
      ]
    });

    expect(result).toMatchObject({ ok: false, error: { code: "InvalidPathOrder" } });
  });

  it("rejects unsupported primary keys and invalid primary values", () => {
    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "99", value: "ABC" }
      })
    ).toMatchObject({ ok: false, error: { code: "UnsupportedPrimaryKey", ai: "99" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "ABC" }
      })
    ).toMatchObject({ ok: false, error: { code: "InvalidValue", ai: "01" } });
  });

  it("rejects unsupported qualifier AIs and invalid qualifier values", () => {
    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        qualifiers: [{ ai: "99", value: "ABC" }]
      })
    ).toMatchObject({ ok: false, error: { code: "UnsupportedQualifier", ai: "99" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        qualifiers: [{ ai: "254", value: "GLN-EXT" }]
      })
    ).toMatchObject({ ok: false, error: { code: "UnsupportedQualifier", ai: "254" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        qualifiers: [{ ai: "10", value: "" }]
      })
    ).toMatchObject({ ok: false, error: { code: "InvalidValue", ai: "10" } });
  });

  it("enforces GS1 path variants from URI Syntax section 4.9", () => {
    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "415", value: "9520123456788" }
      })
    ).toMatchObject({ ok: false, error: { code: "InvalidPathOrder", ai: "415" } });

    expect(
      expectOk(
        encodeDigitalLink({
          stem: "https://id.example",
          primary: { ai: "415", value: "9520123456788" },
          qualifiers: [{ ai: "8020", value: "INV/123" }]
        })
      )
    ).toBe("https://id.example/415/9520123456788/8020/INV%2F123");

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        qualifiers: [
          { ai: "10", value: "LOT" },
          { ai: "235", value: "TPX" }
        ]
      })
    ).toMatchObject({ ok: false, error: { code: "InvalidPathOrder", ai: "235" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "414", value: "9520123456788" },
        qualifiers: [
          { ai: "254", value: "32a" },
          { ai: "7040", value: "123A" }
        ]
      })
    ).toMatchObject({ ok: false, error: { code: "InvalidPathOrder", ai: "7040" } });
  });

  it("validates GS1 data attributes and extension parameters before encoding", () => {
    expect(
      expectOk(
        encodeDigitalLink({
          stem: "https://id.example",
          primary: { ai: "01", value: "09520123456788" },
          attributes: [
            { ai: "3100", value: "000123" },
            { ai: "7007", value: "240101250101" },
            { ai: "23P", value: "12098=abc" }
          ]
        })
      )
    ).toBe("https://id.example/01/09520123456788?3100=000123&7007=240101250101&23P=12098%3Dabc");

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        attributes: [{ ai: "17", value: "ABCDEF" }]
      })
    ).toMatchObject({ ok: false, error: { code: "InvalidValue", ai: "17" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        attributes: [{ ai: "236", value: "12098" }]
      })
    ).toMatchObject({ ok: false, error: { code: "UnsupportedAttribute", ai: "236" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        attributes: [{ ai: "linkType", value: "gs1:traceability" }]
      })
    ).toMatchObject({ ok: false, error: { code: "ReservedExtensionKey", ai: "linkType" } });

    expect(
      expectOk(
        encodeDigitalLink({
          stem: "https://id.example",
          primary: { ai: "01", value: "09520123456788" },
          attributes: [{ ai: "bad#key", value: "ok#value" }]
        })
      )
    ).toBe("https://id.example/01/09520123456788?bad%23key=ok%23value");
  });

  it("rejects invalid stems, unsupported schemes, and stems with query or fragment", () => {
    expect(
      encodeDigitalLink({
        stem: "not a uri",
        primary: { ai: "01", value: "09520123456788" }
      })
    ).toMatchObject({ ok: false, error: { code: "InvalidStem" } });

    expect(
      encodeDigitalLink({
        stem: "ftp://id.example",
        primary: { ai: "01", value: "09520123456788" }
      })
    ).toMatchObject({ ok: false, error: { code: "UnsupportedScheme" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example?existing=1",
        primary: { ai: "01", value: "09520123456788" }
      })
    ).toMatchObject({ ok: false, error: { code: "InvalidStem" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example#part",
        primary: { ai: "01", value: "09520123456788" }
      })
    ).toMatchObject({ ok: false, error: { code: "InvalidStem" } });
  });
});

describe("GS1 Digital Link URI decoding", () => {
  it.each([
    "https://id.gs1.org/01/09520123456788",
    "https://brand.example.com/some-extra/pathinfo/01/09520123456788",
    "https://id.gs1.org/01/09520123456788/22/2A",
    "https://id.gs1.org/01/09520123456788/10/ABC123",
    "https://id.gs1.org/01/09520123456788/21/12345",
    "https://id.gs1.org/01/09520123456788/10/ABC1/21/12345?17=180426",
    "https://id.gs1.org/01/09520123456788?3103=000195",
    "https://id.gs1.org/01/09520123456788?17=201225&3103=000195&3922=0299",
    "https://id.gs1.org/00/195201234567891232",
    "https://id.gs1.org/00/195201234567891232?02=09520123456788&37=25&10=ABC123",
    "https://id.gs1.org/414/9520123456788",
    "https://id.gs1.org/414/9520123456788/254/32a%2Fb",
    "https://example.com/8004/9520614141234567?01=09520123456788",
    "https://example.com/01/09520123456788?8004=9520614141234567"
  ])("accepts GS1 URI Syntax section 5 example %s", (uri) => {
    expect(decodeDigitalLink(uri)).toMatchObject({ ok: true });
  });

  it("decodes a GTIN primary key and stem", () => {
    const decoded = expectOk(decodeDigitalLink("https://id.example/01/09520123456788"));

    expect(decoded).toEqual({
      stem: "https://id.example",
      primary: { ai: "01", value: "09520123456788" },
      qualifiers: [],
      attributes: []
    });
  });

  it("preserves a custom URI stem before the GS1 path", () => {
    const decoded = expectOk(
      decodeDigitalLink("https://brand.example/products/01/09520123456788/10/ABC%2F123?17=250101")
    );

    expect(decoded.stem).toBe("https://brand.example/products");
    expect(decoded.qualifiers).toEqual([{ ai: "10", value: "ABC/123" }]);
    expect(decoded.attributes).toEqual([{ ai: "17", value: "250101" }]);
  });

  it("rejects fragment identifiers because they are outside the GS1 URI syntax pattern", () => {
    expect(decodeDigitalLink("https://id.example/01/09520123456788#details")).toMatchObject({
      ok: false,
      error: { code: "InvalidUri" }
    });
  });

  it("rejects GTIN values that are not 14 digits in the Digital Link path", () => {
    const result = decodeDigitalLink("https://id.example/01/9520123456788");

    expect(result).toMatchObject({ ok: false, error: { code: "InvalidValue", ai: "01" } });
  });

  it("rejects legacy convenience alpha path names", () => {
    const result = decodeDigitalLink("https://id.example/gtin/09520123456788");

    expect(result).toMatchObject({ ok: false, error: { code: "LegacyConvenienceAlpha" } });
  });

  it("rejects malformed URIs, unsupported schemes, and paths without a primary AI", () => {
    expect(decodeDigitalLink("not a uri")).toMatchObject({ ok: false, error: { code: "InvalidUri" } });
    expect(decodeDigitalLink("ftp://id.example/01/09520123456788")).toMatchObject({
      ok: false,
      error: { code: "UnsupportedScheme" }
    });
    expect(decodeDigitalLink("https://id.example/products")).toMatchObject({
      ok: false,
      error: { code: "MissingPrimaryKey" }
    });
  });

  it("rejects invalid path pair structure and invalid percent encoding", () => {
    expect(decodeDigitalLink("https://id.example/01")).toMatchObject({
      ok: false,
      error: { code: "InvalidUri" }
    });
    expect(decodeDigitalLink("https://id.example/01/%E0%A4%A")).toMatchObject({
      ok: false,
      error: { code: "InvalidUri" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788/")).toMatchObject({
      ok: false,
      error: { code: "InvalidUri" }
    });
  });

  it("parses semicolon query delimiters and validates query syntax", () => {
    const decoded = expectOk(decodeDigitalLink("https://id.example/01/09520123456788?17=250101;10=LOT"));

    expect(decoded.attributes).toEqual([
      { ai: "17", value: "250101" },
      { ai: "10", value: "LOT" }
    ]);

    expect(decodeDigitalLink("https://id.example/01/09520123456788?17")).toMatchObject({
      ok: false,
      error: { code: "InvalidQuery" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?%E0%A4%A=1")).toMatchObject({
      ok: false,
      error: { code: "InvalidQuery" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?17=%E0%A4%A")).toMatchObject({
      ok: false,
      error: { code: "InvalidQuery" }
    });
  });

  it("validates data attributes and extension parameters while decoding", () => {
    expect(decodeDigitalLink("https://id.example/01/09520123456788?3100=000123&23P=12098=abc")).toMatchObject({
      ok: true,
      value: {
        attributes: [
          { ai: "3100", value: "000123" },
          { ai: "23P", value: "12098=abc" }
        ]
      }
    });

    expect(decodeDigitalLink("https://id.example/01/09520123456788?17=ABCDEF")).toMatchObject({
      ok: false,
      error: { code: "InvalidValue", ai: "17" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?236=12098")).toMatchObject({
      ok: false,
      error: { code: "UnsupportedAttribute", ai: "236" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?context=abc")).toMatchObject({
      ok: false,
      error: { code: "ReservedExtensionKey", ai: "context" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?bad%23key=ok%23value")).toMatchObject({
      ok: true,
      value: { attributes: [{ ai: "bad#key", value: "ok#value" }] }
    });
  });

  it("rejects unsupported and out-of-order qualifiers from decoded paths", () => {
    expect(decodeDigitalLink("https://id.example/01/09520123456788/99/ABC")).toMatchObject({
      ok: false,
      error: { code: "UnsupportedQualifier", ai: "99" }
    });

    expect(decodeDigitalLink("https://id.example/01/09520123456788/254/GLN-EXT")).toMatchObject({
      ok: false,
      error: { code: "UnsupportedQualifier", ai: "254" }
    });

    expect(decodeDigitalLink("https://id.example/00/123456789012345675/10/LOT")).toMatchObject({
      ok: false,
      error: { code: "UnsupportedQualifier", ai: "10" }
    });

    expect(decodeDigitalLink("https://id.example/01/09520123456788/21/SERIAL/10/LOT")).toMatchObject({
      ok: false,
      error: { code: "InvalidPathOrder", ai: "10" }
    });
  });

  it("collapses duplicate query keys using the last value", () => {
    const decoded = expectOk(decodeDigitalLink("https://id.example/01/09520123456788?17=240101&17=250101"));

    expect(decoded.attributes).toEqual([{ ai: "17", value: "250101" }]);
  });

  it("exposes a boolean recognizer", () => {
    expect(isDigitalLinkUri("https://id.example/01/09520123456788")).toBe(true);
    expect(isDigitalLinkUri("urn:epc:id:sgtin:0614141.112345.400")).toBe(false);
  });
});

describe("Compressed GS1 Digital Link URI syntax", () => {
  const sgtin96Link: DigitalLink = {
    stem: "https://example.com",
    primary: { ai: "01", value: "09528765123457" },
    qualifiers: [{ ai: "21", value: "123456789123" }]
  };

  it("decodes the official SGTIN-96 hex-compressed worked example", () => {
    expect(decodeCompressedDigitalLink("https://example.com/eh30164596f40c0e5cbe991a83")).toEqual({
      ok: true,
      value: {
        ...sgtin96Link,
        attributes: []
      }
    });
  });

  it("decodes the official SGTIN-96 base64url-compressed worked example through the general decoder", () => {
    expect(decodeDigitalLink("https://example.com/exMBZFlvQMDly-mRqD")).toEqual({
      ok: true,
      value: {
        ...sgtin96Link,
        attributes: []
      }
    });
    expect(isDigitalLinkUri("https://example.com/exMBZFlvQMDly-mRqD")).toBe(true);
  });

  it("preserves custom stem path segments while decoding compressed URIs", () => {
    expect(decodeDigitalLink("https://brand.example/path/exMBZFlvQMDly-mRqD")).toMatchObject({
      ok: true,
      value: { stem: "https://brand.example/path" }
    });
  });

  it("encodes SGTIN-96 compressed URIs as hex or base64url", () => {
    expect(
      encodeCompressedDigitalLink(sgtin96Link, {
        companyPrefixLength: 7,
        filter: 0,
        format: "hex"
      })
    ).toEqual({ ok: true, value: "https://example.com/eh30164596f40c0e5cbe991a83" });

    expect(
      encodeCompressedDigitalLink(sgtin96Link, {
        companyPrefixLength: 7,
        filter: 0,
        format: "base64url"
      })
    ).toEqual({ ok: true, value: "https://example.com/exMBZFlvQMDly-mRqD" });
  });

  it("defaults compressed encoding to base64url", () => {
    expect(
      encodeCompressedDigitalLink(sgtin96Link, {
        companyPrefixLength: 7
      })
    ).toEqual({ ok: true, value: "https://example.com/exMBZFlvQMDly-mRqD" });
  });

  it("rejects unsupported compressed payloads and invalid compressed URI structure", () => {
    expect(decodeCompressedDigitalLink("not a uri")).toMatchObject({
      ok: false,
      error: { code: "InvalidUri" }
    });
    expect(decodeCompressedDigitalLink("https://example.com/exMBZFlvQMDly-mRqD?17=250101")).toMatchObject({
      ok: false,
      error: { code: "InvalidCompression" }
    });
    expect(decodeCompressedDigitalLink("https://example.com/xxMBZFlvQMDly-mRqD")).toMatchObject({
      ok: false,
      error: { code: "InvalidCompression" }
    });
    expect(decodeCompressedDigitalLink("ftp://example.com/exMBZFlvQMDly-mRqD")).toMatchObject({
      ok: false,
      error: { code: "UnsupportedScheme" }
    });
    expect(decodeCompressedDigitalLink("https://example.com/eh31164596f40c0e5cbe991a83")).toMatchObject({
      ok: false,
      error: { code: "UnsupportedCompressionScheme" }
    });
    expect(decodeCompressedDigitalLink("https://example.com/eh301e4596f40c0e5cbe991a83")).toMatchObject({
      ok: false,
      error: { code: "InvalidCompression" }
    });
    expect(decodeCompressedDigitalLink("https://example.com/eh30164596f40c0e5cbe991a8X")).toMatchObject({
      ok: false,
      error: { code: "InvalidCompression" }
    });
    expect(decodeCompressedDigitalLink("https://example.com/eh30164596f40c0e5cbe991a8")).toMatchObject({
      ok: false,
      error: { code: "InvalidCompression" }
    });
    expect(decodeCompressedDigitalLink("https://example.com/exMBZFlvQMDly-mRq")).toMatchObject({
      ok: false,
      error: { code: "InvalidCompression" }
    });
    expect(decodeCompressedDigitalLink("https://example.com/exMBZFlvQMDly-mRqD/")).toMatchObject({
      ok: false,
      error: { code: "InvalidCompression" }
    });
  });

  it("rejects SGTIN-96 encoding inputs outside the supported EPC scheme", () => {
    expect(
      encodeCompressedDigitalLink(
        {
          ...sgtin96Link,
          primary: { ai: "01", value: "ABC" }
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "InvalidValue" } });

    expect(
      encodeCompressedDigitalLink(
        {
          stem: "https://example.com",
          primary: { ai: "00", value: "123456789012345675" }
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "UnsupportedCompressionScheme" } });

    expect(
      encodeCompressedDigitalLink(
        {
          ...sgtin96Link,
          qualifiers: []
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "InvalidCompression" } });

    expect(
      encodeCompressedDigitalLink(
        {
          stem: "https://example.com",
          primary: { ai: "01", value: "09528765123457" }
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "InvalidCompression" } });

    expect(
      encodeCompressedDigitalLink(
        {
          ...sgtin96Link,
          qualifiers: [
            { ai: "21", value: "123" },
            { ai: "10", value: "LOT" }
          ]
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "InvalidPathOrder" } });

    expect(
      encodeCompressedDigitalLink(
        {
          ...sgtin96Link,
          qualifiers: [{ ai: "21", value: "ABC" }]
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "InvalidCompression" } });

    expect(
      encodeCompressedDigitalLink(
        {
          ...sgtin96Link,
          attributes: [{ ai: "17", value: "250101" }]
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "InvalidCompression" } });

    expect(
      encodeCompressedDigitalLink(
        {
          ...sgtin96Link,
          qualifiers: [{ ai: "21", value: "274877906944" }]
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "InvalidCompression" } });
  });

  it("rejects invalid compressed URI stems while encoding", () => {
    expect(
      encodeCompressedDigitalLink(
        {
          ...sgtin96Link,
          stem: "not a uri"
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "InvalidStem" } });

    expect(
      encodeCompressedDigitalLink(
        {
          ...sgtin96Link,
          stem: "ftp://example.com"
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "UnsupportedScheme" } });

    expect(
      encodeCompressedDigitalLink(
        {
          ...sgtin96Link,
          stem: "https://example.com?x=1"
        },
        { companyPrefixLength: 7 }
      )
    ).toMatchObject({ ok: false, error: { code: "InvalidStem" } });
  });
});

describe("GTIN normalization", () => {
  it("left-pads GTIN-13 to the required 14-digit Digital Link form", () => {
    expect(expectOk(normalizeGtin("9520123456788"))).toBe("09520123456788");
  });

  it("accepts GTIN-8, GTIN-12, and GTIN-14 and rejects other values", () => {
    expect(expectOk(normalizeGtin("12345670"))).toBe("00000012345670");
    expect(expectOk(normalizeGtin("123456789012"))).toBe("00123456789012");
    expect(expectOk(normalizeGtin("09520123456788"))).toBe("09520123456788");
    expect(normalizeGtin("123")).toMatchObject({ ok: false, error: { code: "InvalidValue", ai: "01" } });
  });
});

describe("AI value extraction helpers", () => {
  it("extracts attributes and qualifiers by semantic keys", () => {
    const decoded = expectOk(
      decodeDigitalLink("https://id.example/01/09520123456788/10/LOT123/21/SERIAL123?17=250101&3103=000195")
    );

    expect(extractAttributeValue(decoded, "EXPIRY_DATE")).toBe("250101");
    expect(extractAttributeValue(decoded, "NET_WEIGHT_KG_APPLICATION_IDENTIFIER_3103")).toBe("000195");
    expect(extractQualifierValue(decoded, "BATCH_OR_LOT")).toBe("LOT123");
    expect(extractQualifierValue(decoded, "SERIAL")).toBe("SERIAL123");
    expect(extractPrimaryValue(decoded, "GTIN")).toBe("09520123456788");
  });

  it("rejects raw AI and generated AI keys at compile time", () => {
    const decoded = expectOk(decodeDigitalLink("https://id.example/01/09520123456788/10/LOT123?17=250101"));

    // @ts-expect-error Extractor keys are semantic string unions, not raw AI strings.
    const rawAttributeKey: Parameters<typeof extractAttributeValue>[1] = "17";
    // @ts-expect-error Extractor keys are semantic string unions, not generated AI code strings.
    const generatedAttributeKey: Parameters<typeof extractAttributeValue>[1] = "AI_17";
    // @ts-expect-error Qualifier extraction also rejects raw AI strings.
    const rawQualifierKey: Parameters<typeof extractQualifierValue>[1] = "10";

    expect(extractAttributeValue(decoded, rawAttributeKey)).toBeUndefined();
    expect(extractAttributeValue(decoded, generatedAttributeKey)).toBeUndefined();
    expect(extractQualifierValue(decoded, rawQualifierKey)).toBeUndefined();
  });

  it("returns undefined for absent fields or mismatched primary keys", () => {
    const decoded = expectOk(decodeDigitalLink("https://id.example/01/09520123456788"));
    const linkWithoutCollections: DigitalLink = {
      stem: "https://id.example",
      primary: { ai: "01", value: "09520123456788" }
    };

    expect(extractAttributeValue(decoded, "EXPIRY_DATE")).toBeUndefined();
    expect(extractQualifierValue(decoded, "SERIAL")).toBeUndefined();
    expect(extractAttributeValue(linkWithoutCollections, "EXPIRY_DATE")).toBeUndefined();
    expect(extractQualifierValue(linkWithoutCollections, "SERIAL")).toBeUndefined();
    expect(extractPrimaryValue(decoded, "SSCC")).toBeUndefined();
  });

  it("uses the last matching value when a caller passes duplicate pairs", () => {
    const link: DigitalLink = {
      stem: "https://id.example",
      primary: { ai: "01", value: "09520123456788" },
      qualifiers: [
        { ai: "10", value: "OLD" },
        { ai: "10", value: "NEW" }
      ],
      attributes: [
        { ai: "17", value: "240101" },
        { ai: "17", value: "250101" }
      ]
    };

    expect(extractAttributeValue(link, "EXPIRY_DATE")).toBe("250101");
    expect(extractQualifierValue(link, "LOT")).toBe("NEW");
  });

  it("exposes lookup keys for the documented primary, qualifier, and data attribute AI catalogues", () => {
    expect(primaryKeyToAi).toMatchObject({
      GSRN_PROVIDER: "8017",
      GTIN: "01",
      SSCC: "00"
    });
    expect(qualifierKeyToAi).toMatchObject({
      BATCH_OR_LOT: "10",
      PAYMENT_REFERENCE: "8020",
      THIRD_PARTY_SERIAL_EXTENSION: "235"
    });
    expect(attributeKeyToAi).toMatchObject({
      CONTENT: "02",
      EXPIRY_DATE: "17",
      IMEI: "8040",
      INTERNAL_APPLICATION_IDENTIFIER_99: "99",
      NHRN_SRN: "717",
      POSITIVE_OFFER_FILE_COUPON_CODE_IDENTIFICATION_FOR_USE_IN_NORTH_AMERICA: "8112"
    });
    expect(allKeyToAi).toMatchObject({
      EXPIRY_DATE: "17",
      GTIN: "01",
      PAYMENT_REFERENCE: "8020"
    });
  });
});

describe("Result helpers", () => {
  it("maps and flatMaps successful values", () => {
    expect(map(ok(2), (value) => value + 1)).toEqual(ok(3));
    expect(flatMap(ok(2), (value) => ok(value + 2))).toEqual(ok(4));
  });

  it("passes Err values through mapping helpers and exposes type guards", () => {
    const result = decodeDigitalLink("urn:epc:id:sgtin:0614141.112345.400");

    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    expect(map(result, () => "ignored")).toBe(result);
    expect(flatMap(result, () => ok("ignored"))).toBe(result);
  });
});
