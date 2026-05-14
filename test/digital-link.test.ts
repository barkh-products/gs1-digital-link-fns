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
        ],
        fragment: "section/1"
      })
    );

    expect(uri).toBe("https://id.example/01/09520123456788?17=250101#section%2F1");
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

  it("decodes fragment identifiers", () => {
    const decoded = expectOk(decodeDigitalLink("https://id.example/01/09520123456788#details"));

    expect(decoded.fragment).toBe("details");
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
