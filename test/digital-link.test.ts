import { describe, expect, it } from "vitest";
import {
  decodeDigitalLink,
  encodeDigitalLink,
  flatMap,
  isDigitalLinkUri,
  isErr,
  isOk,
  map,
  normalizeGtin,
  ok,
  type DigitalLink
} from "../src/index.js";

const expectOk = <A>(result: { readonly tag: "Ok"; readonly value: A } | { readonly tag: "Err"; readonly error: unknown }): A => {
  expect(result.tag).toBe("Ok");

  if (result.tag === "Err") {
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

    expect(result).toMatchObject({ tag: "Err", error: { code: "InvalidPathOrder" } });
  });

  it("rejects unsupported primary keys and invalid primary values", () => {
    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "99", value: "ABC" }
      })
    ).toMatchObject({ tag: "Err", error: { code: "UnsupportedPrimaryKey", ai: "99" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "ABC" }
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidValue", ai: "01" } });
  });

  it("rejects unsupported qualifier AIs and invalid qualifier values", () => {
    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        qualifiers: [{ ai: "99", value: "ABC" }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "UnsupportedQualifier", ai: "99" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        qualifiers: [{ ai: "254", value: "GLN-EXT" }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "UnsupportedQualifier", ai: "254" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        qualifiers: [{ ai: "10", value: "" }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidValue", ai: "10" } });
  });

  it("enforces GS1 path variants from URI Syntax section 4.9", () => {
    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "415", value: "9520123456788" }
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidPathOrder", ai: "415" } });

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
    ).toMatchObject({ tag: "Err", error: { code: "InvalidPathOrder", ai: "235" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "414", value: "9520123456788" },
        qualifiers: [
          { ai: "254", value: "32a" },
          { ai: "7040", value: "123A" }
        ]
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidPathOrder", ai: "7040" } });
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
    ).toMatchObject({ tag: "Err", error: { code: "InvalidValue", ai: "17" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        attributes: [{ ai: "236", value: "12098" }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "UnsupportedAttribute", ai: "236" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        attributes: [{ ai: "linkType", value: "gs1:traceability" }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "ReservedExtensionKey", ai: "linkType" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example",
        primary: { ai: "01", value: "09520123456788" },
        attributes: [{ ai: "bad#key", value: "ok" }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidQuery", ai: "bad#key" } });
  });

  it("rejects invalid stems, unsupported schemes, and stems with query or fragment", () => {
    expect(
      encodeDigitalLink({
        stem: "not a uri",
        primary: { ai: "01", value: "09520123456788" }
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidStem" } });

    expect(
      encodeDigitalLink({
        stem: "ftp://id.example",
        primary: { ai: "01", value: "09520123456788" }
      })
    ).toMatchObject({ tag: "Err", error: { code: "UnsupportedScheme" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example?existing=1",
        primary: { ai: "01", value: "09520123456788" }
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidStem" } });

    expect(
      encodeDigitalLink({
        stem: "https://id.example#part",
        primary: { ai: "01", value: "09520123456788" }
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidStem" } });
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
    expect(decodeDigitalLink(uri)).toMatchObject({ tag: "Ok" });
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
      tag: "Err",
      error: { code: "InvalidUri" }
    });
  });

  it("rejects GTIN values that are not 14 digits in the Digital Link path", () => {
    const result = decodeDigitalLink("https://id.example/01/9520123456788");

    expect(result).toMatchObject({ tag: "Err", error: { code: "InvalidValue", ai: "01" } });
  });

  it("rejects legacy convenience alpha path names", () => {
    const result = decodeDigitalLink("https://id.example/gtin/09520123456788");

    expect(result).toMatchObject({ tag: "Err", error: { code: "LegacyConvenienceAlpha" } });
  });

  it("rejects malformed URIs, unsupported schemes, and paths without a primary AI", () => {
    expect(decodeDigitalLink("not a uri")).toMatchObject({ tag: "Err", error: { code: "InvalidUri" } });
    expect(decodeDigitalLink("ftp://id.example/01/09520123456788")).toMatchObject({
      tag: "Err",
      error: { code: "UnsupportedScheme" }
    });
    expect(decodeDigitalLink("https://id.example/products")).toMatchObject({
      tag: "Err",
      error: { code: "MissingPrimaryKey" }
    });
  });

  it("rejects invalid path pair structure and invalid percent encoding", () => {
    expect(decodeDigitalLink("https://id.example/01")).toMatchObject({
      tag: "Err",
      error: { code: "InvalidUri" }
    });
    expect(decodeDigitalLink("https://id.example/01/%E0%A4%A")).toMatchObject({
      tag: "Err",
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
      tag: "Err",
      error: { code: "InvalidQuery" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?%E0%A4%A=1")).toMatchObject({
      tag: "Err",
      error: { code: "InvalidQuery" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?17=%E0%A4%A")).toMatchObject({
      tag: "Err",
      error: { code: "InvalidQuery" }
    });
  });

  it("validates data attributes and extension parameters while decoding", () => {
    expect(decodeDigitalLink("https://id.example/01/09520123456788?3100=000123&23P=12098=abc")).toMatchObject({
      tag: "Ok",
      value: {
        attributes: [
          { ai: "3100", value: "000123" },
          { ai: "23P", value: "12098=abc" }
        ]
      }
    });

    expect(decodeDigitalLink("https://id.example/01/09520123456788?17=ABCDEF")).toMatchObject({
      tag: "Err",
      error: { code: "InvalidValue", ai: "17" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?236=12098")).toMatchObject({
      tag: "Err",
      error: { code: "UnsupportedAttribute", ai: "236" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?context=abc")).toMatchObject({
      tag: "Err",
      error: { code: "ReservedExtensionKey", ai: "context" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?bad%23key=ok")).toMatchObject({
      tag: "Err",
      error: { code: "InvalidQuery", ai: "bad#key" }
    });
    expect(decodeDigitalLink("https://id.example/01/09520123456788?bad=ok%23")).toMatchObject({
      tag: "Err",
      error: { code: "InvalidQuery", ai: "bad" }
    });
  });

  it("rejects unsupported and out-of-order qualifiers from decoded paths", () => {
    expect(decodeDigitalLink("https://id.example/01/09520123456788/99/ABC")).toMatchObject({
      tag: "Err",
      error: { code: "UnsupportedQualifier", ai: "99" }
    });

    expect(decodeDigitalLink("https://id.example/01/09520123456788/254/GLN-EXT")).toMatchObject({
      tag: "Err",
      error: { code: "UnsupportedQualifier", ai: "254" }
    });

    expect(decodeDigitalLink("https://id.example/00/123456789012345678/10/LOT")).toMatchObject({
      tag: "Err",
      error: { code: "UnsupportedQualifier", ai: "10" }
    });

    expect(decodeDigitalLink("https://id.example/01/09520123456788/21/SERIAL/10/LOT")).toMatchObject({
      tag: "Err",
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

describe("GTIN normalization", () => {
  it("left-pads GTIN-13 to the required 14-digit Digital Link form", () => {
    expect(expectOk(normalizeGtin("9520123456788"))).toBe("09520123456788");
  });

  it("accepts GTIN-8, GTIN-12, and GTIN-14 and rejects other values", () => {
    expect(expectOk(normalizeGtin("12345670"))).toBe("00000012345670");
    expect(expectOk(normalizeGtin("123456789012"))).toBe("00123456789012");
    expect(expectOk(normalizeGtin("09520123456788"))).toBe("09520123456788");
    expect(normalizeGtin("123")).toMatchObject({ tag: "Err", error: { code: "InvalidValue", ai: "01" } });
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
