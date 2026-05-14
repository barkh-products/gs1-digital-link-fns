import { describe, expect, it } from "vitest";
import { calculateGs1CheckDigit, decodeDigitalLink, encodeDigitalLink, type AiPair } from "../src/index.js";

const expectOk = <A>(result: { readonly tag: "Ok"; readonly value: A } | { readonly tag: "Err"; readonly error: unknown }): A => {
  expect(result.tag).toBe("Ok");

  if (result.tag === "Err") {
    throw new Error(JSON.stringify(result.error));
  }

  return result.value;
};

const strictEncode = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const codes = (values: readonly string[], value: string): readonly (readonly [string, string])[] =>
  values.map((ai) => [ai, value] as const);

const primaryValues: Record<string, string> = {
  "01": "09520123456788",
  "00": "123456789012345675",
  "253": "1234567890128ABC",
  "255": "1234567890128",
  "401": "GINC-123/ABC",
  "402": "12345678901234560",
  "414": "9520123456788",
  "415": "9520123456788",
  "417": "9520123456788",
  "8003": "01234567890128ABC",
  "8004": "GIAI-123/ABC",
  "8006": "095201234567881234",
  "8010": "ABC-#/123",
  "8013": "GMN-123/ABC",
  "8017": "123456789012345675",
  "8018": "123456789012345675"
};

const invalidPrimaryValues: Record<string, string> = {
  "00": "12345678901234567",
  "01": "9520123456788",
  "253": "123456789012",
  "255": "123456789012",
  "401": "A".repeat(31),
  "402": "1234567890123456",
  "414": "952012345678",
  "415": "952012345678",
  "417": "952012345678",
  "8003": "11234567890123",
  "8004": "A".repeat(31),
  "8006": "09520123456788123",
  "8010": "abc",
  "8013": "A".repeat(26),
  "8017": "12345678901234567",
  "8018": "12345678901234567"
};

const qualifierValues: Record<string, string> = {
  "10": "LOT/ABC",
  "21": "SERIAL/123",
  "22": "2A",
  "235": "TPX/123",
  "254": "32a/b",
  "7040": "1ABC",
  "8011": "123456789012",
  "8019": "1234567890",
  "8020": "PAY/REF"
};

const invalidQualifierValues: Record<string, string> = {
  "10": "A".repeat(21),
  "21": "A".repeat(21),
  "22": "A".repeat(21),
  "235": "A".repeat(29),
  "254": "A".repeat(21),
  "7040": "ABCD",
  "8011": "1234567890123",
  "8019": "12345678901",
  "8020": "A".repeat(26)
};

const requiredQualifiers: Record<string, readonly AiPair[]> = {
  "415": [{ ai: "8020", value: qualifierValues["8020"]! }]
};

const encodePath = (primaryAi: string, qualifiers: readonly string[] = []): string =>
  expectOk(
    encodeDigitalLink({
      stem: "https://id.gs1.org",
      primary: { ai: primaryAi, value: primaryValues[primaryAi]! },
      qualifiers: qualifiers.map((ai) => ({ ai, value: qualifierValues[ai]! }))
    })
  );

const encodeWithAttribute = (attribute: AiPair): string =>
  expectOk(
    encodeDigitalLink({
      stem: "https://id.gs1.org",
      primary: { ai: "01", value: primaryValues["01"]! },
      attributes: [attribute]
    })
  );

describe("GS1 URI Syntax 1.6.0 section 4.2 character sets and percent encoding", () => {
  it("round-trips XCHAR symbols and percent-encodes reserved literal characters", () => {
    const value = `"!%&+/,*()';:<=>?-._AZaz09`;
    const uri = expectOk(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: "401", value }
      })
    );
    const decoded = expectOk(decodeDigitalLink(uri));

    expect(decoded.primary).toEqual({ ai: "401", value });
    expect(uri).toContain("%22%21%25%26%2B%2F%2C%2A%28%29%27%3B%3A%3C%3D%3E%3F");
  });

  it("accepts YCHAR in CPID values and rejects lowercase outside that set", () => {
    expect(encodePath("8010")).toBe("https://id.gs1.org/8010/ABC-%23%2F123");

    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: "8010", value: invalidPrimaryValues["8010"]! }
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidValue", ai: "8010" } });
  });

  it("accepts ZCHAR in digital signature data attributes and rejects non-ZCHAR symbols", () => {
    expect(encodeWithAttribute({ ai: "8030", value: "Az_-=09" })).toBe(
      "https://id.gs1.org/01/09520123456788?8030=Az_-%3D09"
    );
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: "01", value: primaryValues["01"]! },
        attributes: [{ ai: "8030", value: "ABC!" }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidValue", ai: "8030" } });
  });
});

describe("GS1 URI Syntax 1.6.0 sections 4.3 and 4.5 primary identifier keys", () => {
  it.each(Object.keys(primaryValues))("accepts primary AI %s with its specified value format", (ai) => {
    const qualifiers = requiredQualifiers[ai] ?? [];
    const uri = expectOk(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai, value: primaryValues[ai]! },
        qualifiers
      })
    );

    expect(decodeDigitalLink(uri)).toMatchObject({ tag: "Ok", value: { primary: { ai, value: primaryValues[ai]! } } });
  });

  it.each(Object.keys(invalidPrimaryValues))("rejects primary AI %s values outside its specified format", (ai) => {
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai, value: invalidPrimaryValues[ai]! },
        qualifiers: requiredQualifiers[ai] ?? []
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidValue", ai } });
  });

  it.each([
    ["00", "123456789012345674"],
    ["01", "09520123456789"],
    ["253", "1234567890129ABC"],
    ["255", "1234567890129"],
    ["402", "12345678901234561"],
    ["414", "9520123456789"],
    ["415", "9520123456789"],
    ["417", "9520123456789"],
    ["8003", "01234567890129ABC"],
    ["8006", "095201234567891234"],
    ["8017", "123456789012345674"],
    ["8018", "123456789012345674"]
  ])("rejects primary AI %s with an invalid GS1 check digit", (ai, value) => {
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai, value },
        qualifiers: requiredQualifiers[ai] ?? []
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidCheckDigit", ai } });
  });

  it("rejects query primary AI 8003 with an invalid GRAI check digit", () => {
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: "01", value: primaryValues["01"]! },
        attributes: [{ ai: "8003", value: "01234567890129ABC" }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidCheckDigit", ai: "8003" } });
  });
});

describe("GS1 URI Syntax 1.6.0 sections 4.4, 4.6, 4.8, and 4.9 key qualifiers", () => {
  it.each([
    ["01", "22"],
    ["01", "10"],
    ["01", "21"],
    ["01", "235"],
    ["414", "254"],
    ["417", "7040"],
    ["8010", "8011"],
    ["8017", "8019"],
    ["415", "8020"]
  ])("accepts qualifier AI %s on primary AI %s with its specified value format", (primaryAi, qualifierAi) => {
    expect(encodePath(primaryAi, [qualifierAi])).toContain(`/${qualifierAi}/`);
  });

  it.each([
    ["01", "22"],
    ["01", "10"],
    ["01", "21"],
    ["01", "235"],
    ["414", "254"],
    ["417", "7040"],
    ["8010", "8011"],
    ["8017", "8019"],
    ["415", "8020"]
  ])("rejects qualifier AI %s values outside its specified format", (primaryAi, qualifierAi) => {
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: primaryAi, value: primaryValues[primaryAi]! },
        qualifiers: [{ ai: qualifierAi, value: invalidQualifierValues[qualifierAi]! }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidValue", ai: qualifierAi } });
  });

  it.each([
    ["01", []],
    ["01", ["22"]],
    ["01", ["10"]],
    ["01", ["21"]],
    ["01", ["22", "10"]],
    ["01", ["22", "21"]],
    ["01", ["10", "21"]],
    ["01", ["22", "10", "21"]],
    ["01", ["235"]],
    ["8006", []],
    ["8006", ["22"]],
    ["8006", ["10"]],
    ["8006", ["21"]],
    ["8006", ["22", "10"]],
    ["8006", ["22", "21"]],
    ["8006", ["10", "21"]],
    ["8006", ["22", "10", "21"]],
    ["8013", []],
    ["8010", []],
    ["8010", ["8011"]],
    ["414", []],
    ["414", ["254"]],
    ["414", ["7040"]],
    ["415", ["8020"]],
    ["417", []],
    ["417", ["7040"]],
    ["8017", []],
    ["8017", ["8019"]],
    ["8018", []],
    ["8018", ["8019"]],
    ["255", []],
    ["00", []],
    ["253", []],
    ["401", []],
    ["402", []],
    ["8003", []],
    ["8004", []],
    ["8004", ["7040"]]
  ] as const)("accepts exact gs1path variant primary=%s qualifiers=%j", (primaryAi, qualifiers) => {
    expect(encodePath(primaryAi, qualifiers)).toMatch(/^https:\/\/id\.gs1\.org\//);
  });

  it.each([
    ["415", []],
    ["00", ["10"]],
    ["01", ["21", "10"]],
    ["01", ["10", "235"]],
    ["8006", ["235"]],
    ["414", ["254", "7040"]],
    ["417", ["254"]],
    ["8013", ["10"]]
  ] as const)("rejects non-gs1path variant primary=%s qualifiers=%j", (primaryAi, qualifiers) => {
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: primaryAi, value: primaryValues[primaryAi]! },
        qualifiers: qualifiers.map((ai) => ({ ai, value: qualifierValues[ai]! }))
      })
    ).toMatchObject({ tag: "Err" });
  });
});

const attributeCases: readonly (readonly [string, string])[] = [
  ...codes(["3100", "3101", "3102", "3103", "3104", "3105", "3200", "3201", "3202", "3203", "3204", "3205", "3560", "3561", "3562", "3563", "3564", "3565", "3570", "3571", "3572", "3573", "3574", "3575"], "000123"),
  ...codes(["3110", "3111", "3112", "3113", "3114", "3115", "3210", "3211", "3212", "3213", "3214", "3215", "3220", "3221", "3222", "3223", "3224", "3225", "3230", "3231", "3232", "3233", "3234", "3235"], "000123"),
  ...codes(["3120", "3121", "3122", "3123", "3124", "3125", "3240", "3241", "3242", "3243", "3244", "3245", "3250", "3251", "3252", "3253", "3254", "3255", "3260", "3261", "3262", "3263", "3264", "3265"], "000123"),
  ...codes(["3130", "3131", "3132", "3133", "3134", "3135", "3270", "3271", "3272", "3273", "3274", "3275", "3280", "3281", "3282", "3283", "3284", "3285", "3290", "3291", "3292", "3293", "3294", "3295"], "000123"),
  ...codes(["3140", "3141", "3142", "3143", "3144", "3145", "3500", "3501", "3502", "3503", "3504", "3505", "3510", "3511", "3512", "3513", "3514", "3515", "3520", "3521", "3522", "3523", "3524", "3525"], "000123"),
  ...codes(["3150", "3151", "3152", "3153", "3154", "3155", "3160", "3161", "3162", "3163", "3164", "3165", "3600", "3601", "3602", "3603", "3604", "3605", "3610", "3611", "3612", "3613", "3614", "3615", "3640", "3641", "3642", "3643", "3644", "3645", "3650", "3651", "3652", "3653", "3654", "3655", "3660", "3661", "3662", "3663", "3664", "3665"], "000123"),
  ...codes(["3370", "3371", "3372", "3373", "3374", "3375"], "000123"),
  ...codes(["3300", "3301", "3302", "3303", "3304", "3305", "3400", "3401", "3402", "3403", "3404", "3405"], "000123"),
  ...codes(["3310", "3311", "3312", "3313", "3314", "3315", "3410", "3411", "3412", "3413", "3414", "3415", "3420", "3421", "3422", "3423", "3424", "3425", "3430", "3431", "3432", "3433", "3434", "3435"], "000123"),
  ...codes(["3320", "3321", "3322", "3323", "3324", "3325", "3440", "3441", "3442", "3443", "3444", "3445", "3450", "3451", "3452", "3453", "3454", "3455", "3460", "3461", "3462", "3463", "3464", "3465"], "000123"),
  ...codes(["3330", "3331", "3332", "3333", "3334", "3335", "3470", "3471", "3472", "3473", "3474", "3475", "3480", "3481", "3482", "3483", "3484", "3485", "3490", "3491", "3492", "3493", "3494", "3495"], "000123"),
  ...codes(["3340", "3341", "3342", "3343", "3344", "3345", "3530", "3531", "3532", "3533", "3534", "3535", "3540", "3541", "3542", "3543", "3544", "3545", "3550", "3551", "3552", "3553", "3554", "3555"], "000123"),
  ...codes(["3350", "3351", "3352", "3353", "3354", "3355", "3360", "3361", "3362", "3363", "3364", "3365", "3620", "3621", "3622", "3623", "3624", "3625", "3630", "3631", "3632", "3633", "3634", "3635", "3670", "3671", "3672", "3673", "3674", "3675", "3680", "3681", "3682", "3683", "3684", "3685", "3690", "3691", "3692", "3693", "3694", "3695"], "000123"),
  ...codes(["7030", "7031", "7032", "7033", "7034", "7035", "7036", "7037", "7038", "7039"], "123ABC"),
  ...codes(["3900", "3901", "3902", "3903", "3904", "3905", "3906", "3907", "3908", "3909"], "123"),
  ...codes(["3910", "3911", "3912", "3913", "3914", "3915", "3916", "3917", "3918", "3919"], "840123"),
  ...codes(["3920", "3921", "3922", "3923", "3924", "3925", "3926", "3927", "3928", "3929"], "123"),
  ...codes(["3930", "3931", "3932", "3933", "3934", "3935", "3936", "3937", "3938", "3939"], "840123"),
  ...codes(["3940", "3941", "3942", "3943"], "1234"),
  ...codes(["3950", "3951", "3952", "3953", "3954", "3955"], "000123"),
  ...codes(["710", "711", "712", "713", "714", "715", "716"], "NHRN/ABC"),
  ...codes(["7230", "7231", "7232", "7233", "7234", "7235", "7236", "7237", "7238", "7239"], "ABC"),
  ...Object.entries(primaryValues),
  ["02", "09520123456788"],
  ["10", "LOT/ABC"],
  ["11", "240101"],
  ["12", "240101"],
  ["13", "240101"],
  ["15", "240101"],
  ["16", "240101"],
  ["17", "240101"],
  ["20", "12"],
  ["30", "12345678"],
  ["37", "25"],
  ["90", "MUTUAL/ABC"],
  ["240", "ADDITIONAL/ABC"],
  ["241", "PART/ABC"],
  ["242", "123456"],
  ["243", "PCN/ABC"],
  ["250", "SECONDARY/ABC"],
  ["251", "SOURCE/ABC"],
  ["400", "ORDER/ABC"],
  ["403", "ROUTE/ABC"],
  ["410", "9520123456788"],
  ["411", "9520123456788"],
  ["412", "9520123456788"],
  ["413", "9520123456788"],
  ["416", "9520123456788"],
  ["420", "POST/ABC"],
  ["421", "840ABC"],
  ["422", "840"],
  ["423", "840123"],
  ["424", "840"],
  ["425", "840123"],
  ["426", "840"],
  ["427", "ABC"],
  ["7001", "1234567890123"],
  ["7002", "MEAT/ABC"],
  ["7003", "2401011234"],
  ["7004", "1234"],
  ["7005", "CATCH/ABC"],
  ["7006", "240101"],
  ["7007", "240101"],
  ["7007", "240101250101"],
  ["7008", "ABC"],
  ["7009", "GEAR/ABC"],
  ["7010", "AB"],
  ["7011", "240101"],
  ["7011", "2401011234"],
  ["7020", "REFURB/ABC"],
  ["7021", "FUNC/ABC"],
  ["7022", "REV/ABC"],
  ["7023", "ASSEMBLY/ABC"],
  ["7041", "ABCD"],
  ["7240", "PROTOCOL/ABC"],
  ["7241", "12"],
  ["7242", "VCN/ABC"],
  ["7250", "20240101"],
  ["7251", "202401011234"],
  ["7252", "1"],
  ["7253", "FAMILY/ABC"],
  ["7254", "GIVEN/ABC"],
  ["7255", "SUFFIX/ABC"],
  ["7256", "FULL/NAME"],
  ["7257", "PERSON/ADDRESS"],
  ["7258", "1/2"],
  ["7259", "BABY/ABC"],
  ["8001", "12345678901234"],
  ["8002", "CMT/ABC"],
  ["8005", "000123"],
  ["8007", "IBAN/ABC"],
  ["8008", "20240101"],
  ["8008", "2024010112"],
  ["8008", "202401011234"],
  ["8009", "OPTICAL/ABC"],
  ["8012", "VERSION/ABC"],
  ["8026", "095201234567881234"],
  ["8030", "Az_-=09"],
  ["8110", "COUPON/ABC"],
  ["8111", "1234"],
  ["8112", "PAPERLESS/ABC"],
  ["4300", "SHIP/COMPANY"],
  ["4301", "SHIP/NAME"],
  ["4302", "SHIP/ADD1"],
  ["4303", "SHIP/ADD2"],
  ["4304", "SHIP/SUB"],
  ["4305", "SHIP/LOCALITY"],
  ["4306", "SHIP/REGION"],
  ["4307", "SE"],
  ["4308", "PHONE/123"],
  ["4309", "12345678901234567890"],
  ["4310", "RETURN/COMPANY"],
  ["4311", "RETURN/NAME"],
  ["4312", "RETURN/ADD1"],
  ["4313", "RETURN/ADD2"],
  ["4314", "RETURN/SUB"],
  ["4315", "RETURN/LOCALITY"],
  ["4316", "RETURN/REGION"],
  ["4317", "SE"],
  ["4318", "POST/RETURN"],
  ["4319", "PHONE/RETURN"],
  ["4320", "SERVICE/DESC"],
  ["4321", "1"],
  ["4322", "0"],
  ["4323", "1"],
  ["4324", "2401011234"],
  ["4325", "2401011234"],
  ["4326", "240101"],
  ["4330", "000123-"],
  ["4331", "000123"],
  ["4332", "000123-"],
  ...codes(["91", "92", "93", "94", "95", "96", "97", "98", "99"], "INTERNAL/ABC")
];

describe("GS1 URI Syntax 1.6.0 section 4.10 data attributes", () => {
  it.each(attributeCases)("accepts query data attribute AI %s with its specified value format", (ai, value) => {
    const uri = encodeWithAttribute({ ai, value });

    expect(decodeDigitalLink(uri)).toMatchObject({ tag: "Ok", value: { attributes: [{ ai, value }] } });
  });

  it.each([
    ["8200", "https://example.com"],
    ["03", "09520123456788"],
    ["8014", "ABC"],
    ["236", "12098"]
  ])("rejects omitted or all-numeric extension query key %s", (ai, value) => {
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: "01", value: primaryValues["01"]! },
        attributes: [{ ai, value }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "UnsupportedAttribute", ai } });
  });

  it.each([
    ["02", "09520123456789"],
    ["410", "9520123456789"],
    ["411", "9520123456789"],
    ["412", "9520123456789"],
    ["413", "9520123456789"],
    ["414", "9520123456789"],
    ["415", "9520123456789"],
    ["416", "9520123456789"]
  ])("rejects data attribute AI %s with an invalid GS1 check digit", (ai, value) => {
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: "01", value: primaryValues["01"]! },
        attributes: [{ ai, value }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidCheckDigit", ai } });
  });
});

describe("GS1 General Specifications check digit algorithm", () => {
  it("calculates GS1 modulo-10 check digits", () => {
    expect(calculateGs1CheckDigit("0952012345678")).toEqual({ tag: "Ok", value: "8" });
    expect(calculateGs1CheckDigit("952012345678")).toEqual({ tag: "Ok", value: "8" });
    expect(calculateGs1CheckDigit("12345678901234567")).toEqual({ tag: "Ok", value: "5" });
  });

  it("rejects non-numeric check digit calculation input", () => {
    expect(calculateGs1CheckDigit("ABC")).toMatchObject({ tag: "Err", error: { code: "InvalidValue" } });
  });
});

describe("GS1 URI Syntax 1.6.0 sections 4.10.1 and 4.11 query and URI construction", () => {
  it.each([
    ["23P", "12098"],
    ["P23", "12098=abc"],
    ["bad#key", "ok#value"],
    ["a+b", "c+d"]
  ])("accepts extension parameter %s=%s", (ai, value) => {
    const uri = encodeWithAttribute({ ai, value });

    expect(decodeDigitalLink(uri)).toMatchObject({ tag: "Ok", value: { attributes: [{ ai, value }] } });
  });

  it.each(["linkType", "context"])("rejects reserved resolver extension key %s", (ai) => {
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: "01", value: primaryValues["01"]! },
        attributes: [{ ai, value: "abc" }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "ReservedExtensionKey", ai } });
  });

  it.each([
    ["bad=key", "ok"],
    ["bad", "not ok"]
  ])("rejects extension parameter outside query ABNF %s=%s", (ai, value) => {
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: "01", value: primaryValues["01"]! },
        attributes: [{ ai, value }]
      })
    ).toMatchObject({ tag: "Err", error: { code: "InvalidQuery", ai } });
  });

  it("accepts uppercase HTTP and HTTPS schemes, ports, and custom stem path segments", () => {
    expect(decodeDigitalLink("HTTPS://brand.example.com:8443/some-extra/pathinfo/01/09520123456788")).toMatchObject({
      tag: "Ok",
      value: { stem: "https://brand.example.com:8443/some-extra/pathinfo" }
    });
    expect(decodeDigitalLink("HTTP://brand.example.com/01/09520123456788")).toMatchObject({ tag: "Ok" });
  });

  it("treats plus as a literal RFC 3986 query character rather than form-encoded space", () => {
    expect(decodeDigitalLink("https://id.gs1.org/01/09520123456788?a+b=c+d")).toMatchObject({
      tag: "Ok",
      value: { attributes: [{ ai: "a+b", value: "c+d" }] }
    });
  });

  it("preserves independently verified URI construction fixture with ordered qualifiers and attributes", () => {
    expect(
      encodeDigitalLink({
        stem: "https://id.gs1.org",
        primary: { ai: "01", value: "09520123456788" },
        qualifiers: [
          { ai: "10", value: "ABC123" },
          { ai: "21", value: "SERIAL123" }
        ],
        attributes: [{ ai: "17", value: "250101" }]
      })
    ).toEqual({ tag: "Ok", value: "https://id.gs1.org/01/09520123456788/10/ABC123/21/SERIAL123?17=250101" });
  });
});
