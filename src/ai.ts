import type { AiPair, DigitalLinkError } from "./types.js";
import { err, ok, type Result } from "./result.js";
import { validateGs1CheckDigit } from "./check-digit.js";

type AiMetadata = {
  readonly ai: string;
  readonly label: string;
  readonly pattern: RegExp;
};

const xCharSource = String.raw`[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]`;
const yCharSource = String.raw`[#\-./0-9A-Z]`;
const zCharSource = String.raw`[-0-9=A-Z_a-z]`;

const digits = (count: number): RegExp => new RegExp(String.raw`^\d{${count}}$`);
const digitsBetween = (min: number, max: number): RegExp => new RegExp(String.raw`^\d{${min},${max}}$`);
const xChars = (min: number, max: number): RegExp => new RegExp(`^${xCharSource}{${min},${max}}$`);
const yChars = (min: number, max: number): RegExp => new RegExp(`^${yCharSource}{${min},${max}}$`);
const zChars = (min: number, max: number): RegExp => new RegExp(`^${zCharSource}{${min},${max}}$`);
const fixedThenX = (digitsCount: number, minX: number, maxX: number): RegExp =>
  new RegExp(String.raw`^\d{${digitsCount}}${xCharSource}{${minX},${maxX}}$`);
const fixedThenDigits = (digitsCount: number, minDigits: number, maxDigits: number): RegExp =>
  new RegExp(String.raw`^\d{${digitsCount}}\d{${minDigits},${maxDigits}}$`);
const codes = (values: readonly string[], label: string, pattern: RegExp): readonly AiMetadata[] =>
  values.map((ai) => ({ ai, label, pattern }));

const xChar = xChars(1, 30);
const yChar = yChars(1, 30);

export const primaryMetadata = {
  "00": { ai: "00", label: "SSCC", pattern: /^\d{18}$/ },
  "01": { ai: "01", label: "GTIN", pattern: /^\d{14}$/ },
  "255": { ai: "255", label: "GCN", pattern: /^\d{13}(\d{1,12})?$/ },
  "253": { ai: "253", label: "GDTI", pattern: /^\d{13}[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]{0,17}$/ },
  "401": { ai: "401", label: "GINC", pattern: xChar },
  "402": { ai: "402", label: "GSIN", pattern: /^\d{17}$/ },
  "414": { ai: "414", label: "Physical location GLN", pattern: /^\d{13}$/ },
  "415": { ai: "415", label: "Pay-to GLN", pattern: /^\d{13}$/ },
  "417": { ai: "417", label: "Party GLN", pattern: /^\d{13}$/ },
  "8003": { ai: "8003", label: "GRAI", pattern: /^0\d{13}[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]{0,16}$/ },
  "8004": { ai: "8004", label: "GIAI", pattern: xChar },
  "8006": { ai: "8006", label: "ITIP", pattern: /^\d{18}$/ },
  "8010": { ai: "8010", label: "CPID", pattern: yChar },
  "8013": { ai: "8013", label: "GMN", pattern: /^[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]{1,25}$/ },
  "8017": { ai: "8017", label: "GSRN provider", pattern: /^\d{18}$/ },
  "8018": { ai: "8018", label: "GSRN recipient", pattern: /^\d{18}$/ }
} as const satisfies Record<string, AiMetadata>;

export const qualifierMetadata = {
  "10": { ai: "10", label: "Batch or lot", pattern: /^[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]{1,20}$/ },
  "21": { ai: "21", label: "Serial", pattern: /^[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]{1,20}$/ },
  "22": { ai: "22", label: "Consumer product variant", pattern: /^[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]{1,20}$/ },
  "235": {
    ai: "235",
    label: "Third-party controlled serialised extension to GTIN",
    pattern: /^[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]{1,28}$/
  },
  "254": { ai: "254", label: "GLN extension", pattern: /^[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]{1,20}$/ },
  "7040": { ai: "7040", label: "UIC extension", pattern: /^\d[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]{3}$/ },
  "8011": { ai: "8011", label: "CPID serial", pattern: /^\d{1,12}$/ },
  "8019": { ai: "8019", label: "Service relation instance", pattern: /^\d{1,10}$/ },
  "8020": { ai: "8020", label: "Payment reference", pattern: /^[!-"%&'()*+,\-./0-9:;<=>?A-Z_a-z]{1,25}$/ }
} as const satisfies Record<string, AiMetadata>;

const pathRulesByPrimary: Readonly<Record<string, readonly (readonly string[])[]>> = {
  "00": [[]],
  "01": [[], ["22"], ["10"], ["21"], ["22", "10"], ["22", "21"], ["10", "21"], ["22", "10", "21"], ["235"]],
  "253": [[]],
  "255": [[]],
  "401": [[]],
  "402": [[]],
  "414": [[], ["254"], ["7040"]],
  "415": [["8020"]],
  "417": [[], ["7040"]],
  "8003": [[]],
  "8004": [[], ["7040"]],
  "8006": [[], ["22"], ["10"], ["21"], ["22", "10"], ["22", "21"], ["10", "21"], ["22", "10", "21"]],
  "8010": [[], ["8011"]],
  "8013": [[]],
  "8017": [[], ["8019"]],
  "8018": [[], ["8019"]]
};

const aiEntries = <T extends Record<string, AiMetadata>>(metadata: T): readonly AiMetadata[] => Object.values(metadata);

const attributeEntries = [
  ...codes(["3100", "3101", "3102", "3103", "3104", "3105", "3200", "3201", "3202", "3203", "3204", "3205", "3560", "3561", "3562", "3563", "3564", "3565", "3570", "3571", "3572", "3573", "3574", "3575"], "variable measure trade item net weight", digits(6)),
  ...codes(["3110", "3111", "3112", "3113", "3114", "3115", "3210", "3211", "3212", "3213", "3214", "3215", "3220", "3221", "3222", "3223", "3224", "3225", "3230", "3231", "3232", "3233", "3234", "3235"], "variable measure trade item length", digits(6)),
  ...codes(["3120", "3121", "3122", "3123", "3124", "3125", "3240", "3241", "3242", "3243", "3244", "3245", "3250", "3251", "3252", "3253", "3254", "3255", "3260", "3261", "3262", "3263", "3264", "3265"], "variable measure trade item width", digits(6)),
  ...codes(["3130", "3131", "3132", "3133", "3134", "3135", "3270", "3271", "3272", "3273", "3274", "3275", "3280", "3281", "3282", "3283", "3284", "3285", "3290", "3291", "3292", "3293", "3294", "3295"], "variable measure trade item depth", digits(6)),
  ...codes(["3140", "3141", "3142", "3143", "3144", "3145", "3500", "3501", "3502", "3503", "3504", "3505", "3510", "3511", "3512", "3513", "3514", "3515", "3520", "3521", "3522", "3523", "3524", "3525"], "variable measure trade item area", digits(6)),
  ...codes(["3150", "3151", "3152", "3153", "3154", "3155", "3160", "3161", "3162", "3163", "3164", "3165", "3600", "3601", "3602", "3603", "3604", "3605", "3610", "3611", "3612", "3613", "3614", "3615", "3640", "3641", "3642", "3643", "3644", "3645", "3650", "3651", "3652", "3653", "3654", "3655", "3660", "3661", "3662", "3663", "3664", "3665"], "variable measure trade item net volume", digits(6)),
  ...codes(["3370", "3371", "3372", "3373", "3374", "3375"], "mass per unit area", digits(6)),
  ...codes(["3300", "3301", "3302", "3303", "3304", "3305", "3400", "3401", "3402", "3403", "3404", "3405"], "gross weight", digits(6)),
  ...codes(["3310", "3311", "3312", "3313", "3314", "3315", "3410", "3411", "3412", "3413", "3414", "3415", "3420", "3421", "3422", "3423", "3424", "3425", "3430", "3431", "3432", "3433", "3434", "3435"], "logistic length", digits(6)),
  ...codes(["3320", "3321", "3322", "3323", "3324", "3325", "3440", "3441", "3442", "3443", "3444", "3445", "3450", "3451", "3452", "3453", "3454", "3455", "3460", "3461", "3462", "3463", "3464", "3465"], "logistic width", digits(6)),
  ...codes(["3330", "3331", "3332", "3333", "3334", "3335", "3470", "3471", "3472", "3473", "3474", "3475", "3480", "3481", "3482", "3483", "3484", "3485", "3490", "3491", "3492", "3493", "3494", "3495"], "logistic depth", digits(6)),
  ...codes(["3340", "3341", "3342", "3343", "3344", "3345", "3530", "3531", "3532", "3533", "3534", "3535", "3540", "3541", "3542", "3543", "3544", "3545", "3550", "3551", "3552", "3553", "3554", "3555"], "logistic area", digits(6)),
  ...codes(["3350", "3351", "3352", "3353", "3354", "3355", "3360", "3361", "3362", "3363", "3364", "3365", "3620", "3621", "3622", "3623", "3624", "3625", "3630", "3631", "3632", "3633", "3634", "3635", "3670", "3671", "3672", "3673", "3674", "3675", "3680", "3681", "3682", "3683", "3684", "3685", "3690", "3691", "3692", "3693", "3694", "3695"], "logistic volume", digits(6)),
  ...codes(["7030", "7031", "7032", "7033", "7034", "7035", "7036", "7037", "7038", "7039"], "processor", fixedThenX(3, 1, 27)),
  ...codes(["3900", "3901", "3902", "3903", "3904", "3905", "3906", "3907", "3908", "3909"], "amount", digitsBetween(1, 15)),
  ...codes(["3910", "3911", "3912", "3913", "3914", "3915", "3916", "3917", "3918", "3919"], "amount with ISO currency", fixedThenDigits(3, 1, 15)),
  ...codes(["3920", "3921", "3922", "3923", "3924", "3925", "3926", "3927", "3928", "3929"], "price", digitsBetween(1, 15)),
  ...codes(["3930", "3931", "3932", "3933", "3934", "3935", "3936", "3937", "3938", "3939"], "price with ISO currency", fixedThenDigits(3, 1, 15)),
  ...codes(["3940", "3941", "3942", "3943"], "percent off", digits(4)),
  ...codes(["3950", "3951", "3952", "3953", "3954", "3955"], "amount payable per unit", digits(6)),
  ...codes(["710", "711", "712", "713", "714", "715", "716"], "national healthcare reimbursement number", xChars(1, 20)),
  ...codes(["7230", "7231", "7232", "7233", "7234", "7235", "7236", "7237", "7238", "7239"], "certification reference", xChars(3, 30)),
  ...aiEntries(primaryMetadata),
  { ai: "02", label: "CONTENT", pattern: digits(14) },
  { ai: "10", label: "Batch or lot", pattern: qualifierMetadata["10"].pattern },
  { ai: "11", label: "Production date", pattern: digits(6) },
  { ai: "12", label: "Due date", pattern: digits(6) },
  { ai: "13", label: "Packaging date", pattern: digits(6) },
  { ai: "15", label: "Best before date", pattern: digits(6) },
  { ai: "16", label: "Sell by date", pattern: digits(6) },
  { ai: "17", label: "Expiry date", pattern: digits(6) },
  { ai: "20", label: "Variant", pattern: digits(2) },
  { ai: "30", label: "Variable count", pattern: digitsBetween(1, 8) },
  { ai: "37", label: "Count", pattern: digitsBetween(1, 8) },
  { ai: "90", label: "Mutually agreed information", pattern: xChars(1, 30) },
  { ai: "240", label: "Additional product identification", pattern: xChars(1, 30) },
  { ai: "241", label: "Customer part number", pattern: xChars(1, 30) },
  { ai: "242", label: "Made-to-order variation number", pattern: digitsBetween(1, 6) },
  { ai: "243", label: "Packaging component number", pattern: xChars(1, 20) },
  { ai: "250", label: "Secondary serial number", pattern: xChars(1, 30) },
  { ai: "251", label: "Reference to source entity", pattern: xChars(1, 30) },
  { ai: "400", label: "Order number", pattern: xChars(1, 30) },
  { ai: "403", label: "Routing code", pattern: xChars(1, 30) },
  { ai: "410", label: "Ship-to GLN", pattern: digits(13) },
  { ai: "411", label: "Bill-to GLN", pattern: digits(13) },
  { ai: "412", label: "Purchase-from GLN", pattern: digits(13) },
  { ai: "413", label: "Ship-for GLN", pattern: digits(13) },
  { ai: "416", label: "Production or service location GLN", pattern: digits(13) },
  { ai: "420", label: "Ship-to postal code", pattern: xChars(1, 20) },
  { ai: "421", label: "Ship-to postal code with country", pattern: fixedThenX(3, 1, 9) },
  { ai: "422", label: "Country of origin", pattern: digits(3) },
  { ai: "423", label: "Country of initial processing", pattern: fixedThenDigits(3, 1, 12) },
  { ai: "424", label: "Country of processing", pattern: digits(3) },
  { ai: "425", label: "Country of disassembly", pattern: fixedThenDigits(3, 1, 12) },
  { ai: "426", label: "Country of full process", pattern: digits(3) },
  { ai: "427", label: "Origin subdivision", pattern: xChars(1, 3) },
  { ai: "7001", label: "NSN", pattern: digits(13) },
  { ai: "7002", label: "Meat cut", pattern: xChars(1, 30) },
  { ai: "7003", label: "Expiry date and time", pattern: digits(10) },
  { ai: "7004", label: "Active potency", pattern: digitsBetween(1, 4) },
  { ai: "7005", label: "Catch area", pattern: xChars(1, 12) },
  { ai: "7006", label: "First freeze date", pattern: digits(6) },
  { ai: "7007", label: "Harvest date", pattern: /^(\d{6}|\d{12})$/ },
  { ai: "7008", label: "Aquatic species", pattern: xChars(1, 3) },
  { ai: "7009", label: "Fishing gear type", pattern: xChars(1, 10) },
  { ai: "7010", label: "Production method", pattern: xChars(1, 2) },
  { ai: "7011", label: "Test by date", pattern: /^(\d{6}|\d{10})$/ },
  { ai: "7020", label: "Refurbishment lot", pattern: xChars(1, 20) },
  { ai: "7021", label: "Functional status", pattern: xChars(1, 20) },
  { ai: "7022", label: "Revision status", pattern: xChars(1, 20) },
  { ai: "7023", label: "GIAI assembly", pattern: xChars(1, 30) },
  { ai: "7041", label: "Unit type", pattern: xChars(1, 4) },
  { ai: "7240", label: "Protocol ID", pattern: xChars(1, 20) },
  { ai: "7241", label: "AIDC media type", pattern: digits(2) },
  { ai: "7242", label: "VCN", pattern: xChars(1, 25) },
  { ai: "7250", label: "Date of birth", pattern: digits(8) },
  { ai: "7251", label: "Date/time of birth", pattern: digits(12) },
  { ai: "7252", label: "Biological sex", pattern: digits(1) },
  { ai: "7253", label: "Family name", pattern: xChars(1, 40) },
  { ai: "7254", label: "Given name", pattern: xChars(1, 40) },
  { ai: "7255", label: "Suffix", pattern: xChars(1, 10) },
  { ai: "7256", label: "Full name", pattern: xChars(1, 90) },
  { ai: "7257", label: "Person address", pattern: xChars(1, 70) },
  { ai: "7258", label: "Birth sequence", pattern: /^\d\/\d$/ },
  { ai: "7259", label: "Baby", pattern: xChars(1, 40) },
  { ai: "8001", label: "Dimensions", pattern: digits(14) },
  { ai: "8002", label: "Cellular mobile telephone number", pattern: xChars(1, 20) },
  { ai: "8005", label: "Price per unit", pattern: digits(6) },
  { ai: "8007", label: "IBAN", pattern: xChars(1, 34) },
  { ai: "8008", label: "Production date and time", pattern: /^(\d{8}|\d{10}|\d{12})$/ },
  { ai: "8009", label: "Optical sensor", pattern: xChars(1, 50) },
  { ai: "8012", label: "Version", pattern: xChars(1, 20) },
  { ai: "8026", label: "ITIP content", pattern: digits(18) },
  { ai: "8030", label: "Digital signature", pattern: zChars(1, 90) },
  { ai: "8110", label: "Coupon code ID NA", pattern: xChars(1, 70) },
  { ai: "8111", label: "Loyalty points", pattern: digits(4) },
  { ai: "8112", label: "Paperless coupon code ID NA", pattern: xChars(1, 70) },
  { ai: "4300", label: "Ship-to company", pattern: xChars(1, 35) },
  { ai: "4301", label: "Ship-to name", pattern: xChars(1, 35) },
  { ai: "4302", label: "Ship-to address line 1", pattern: xChars(1, 70) },
  { ai: "4303", label: "Ship-to address line 2", pattern: xChars(1, 70) },
  { ai: "4304", label: "Ship-to suburb", pattern: xChars(1, 70) },
  { ai: "4305", label: "Ship-to locality", pattern: xChars(1, 70) },
  { ai: "4306", label: "Ship-to region", pattern: xChars(1, 70) },
  { ai: "4307", label: "Ship-to country", pattern: xChars(2, 2) },
  { ai: "4308", label: "Ship-to phone", pattern: xChars(1, 30) },
  { ai: "4309", label: "Ship-to geo", pattern: digits(20) },
  { ai: "4310", label: "Return-to company", pattern: xChars(1, 35) },
  { ai: "4311", label: "Return-to name", pattern: xChars(1, 35) },
  { ai: "4312", label: "Return-to address line 1", pattern: xChars(1, 70) },
  { ai: "4313", label: "Return-to address line 2", pattern: xChars(1, 70) },
  { ai: "4314", label: "Return-to suburb", pattern: xChars(1, 70) },
  { ai: "4315", label: "Return-to locality", pattern: xChars(1, 70) },
  { ai: "4316", label: "Return-to region", pattern: xChars(1, 70) },
  { ai: "4317", label: "Return-to country", pattern: xChars(2, 2) },
  { ai: "4318", label: "Return-to postal code", pattern: xChars(1, 20) },
  { ai: "4319", label: "Return-to phone", pattern: xChars(1, 30) },
  { ai: "4320", label: "Service description", pattern: xChars(1, 35) },
  { ai: "4321", label: "Dangerous goods", pattern: /^[01]$/ },
  { ai: "4322", label: "Authority to leave", pattern: /^[01]$/ },
  { ai: "4323", label: "Signature required", pattern: /^[01]$/ },
  { ai: "4324", label: "Not before delivery date/time", pattern: digits(10) },
  { ai: "4325", label: "Not after delivery date/time", pattern: digits(10) },
  { ai: "4326", label: "Release date", pattern: digits(6) },
  { ai: "4330", label: "Maximum temperature Fahrenheit", pattern: /^\d{6}-?$/ },
  { ai: "4331", label: "Maximum temperature Celsius", pattern: /^\d{6}-?$/ },
  { ai: "4332", label: "Minimum temperature", pattern: /^\d{6}-?$/ },
  ...codes(["91", "92", "93", "94", "95", "96", "97", "98", "99"], "Internal company information", xChars(1, 90))
] as const satisfies readonly AiMetadata[];

export const attributeMetadata = Object.fromEntries(attributeEntries.map((entry) => [entry.ai, entry])) as Record<
  string,
  AiMetadata
>;

const primaryCheckDigitIndex = {
  "00": 17,
  "01": 13,
  "253": 12,
  "255": 12,
  "402": 16,
  "414": 12,
  "415": 12,
  "417": 12,
  "8006": 13,
  "8017": 17,
  "8018": 17
} as const satisfies Readonly<Record<string, number>>;

const attributeCheckDigitIndex = {
  "02": 13,
  "410": 12,
  "411": 12,
  "412": 12,
  "413": 12,
  "414": 12,
  "415": 12,
  "416": 12
} as const satisfies Readonly<Record<string, number>>;

const legacyConvenienceAlphas = new Set([
  "gtin",
  "itip",
  "gmn",
  "cpid",
  "gln",
  "partyGln",
  "gsrnp",
  "gsrn",
  "gcn",
  "sscc",
  "gdti",
  "ginc",
  "gsin",
  "grai",
  "giai"
]);

export const isPrimaryAi = (ai: string): ai is keyof typeof primaryMetadata => ai in primaryMetadata;

export const isQualifierAi = (ai: string): ai is keyof typeof qualifierMetadata => ai in qualifierMetadata;

export const isLegacyConvenienceAlpha = (segment: string): boolean => legacyConvenienceAlphas.has(segment);

export const validatePrimary = (pair: AiPair): Result<DigitalLinkError, AiPair> => {
  const metadata = primaryMetadata[pair.ai as keyof typeof primaryMetadata];

  if (metadata === undefined) {
    return err({
      ai: pair.ai,
      code: "UnsupportedPrimaryKey",
      message: `AI ${pair.ai} is not a supported GS1 Digital Link primary key.`
    });
  }

  if (!metadata.pattern.test(pair.value)) {
    return err({
        ai: pair.ai,
        code: "InvalidValue",
        message: `Value ${pair.value} does not match the ${metadata.label} format.`
      });
  }

  if (pair.ai === "8003") {
    const checkDigitResult = validateGs1CheckDigit(pair.ai, pair.value.slice(1, 14), 12);

    return checkDigitResult.tag === "Ok" ? ok(pair) : checkDigitResult;
  }

  const checkDigitIndex = primaryCheckDigitIndex[pair.ai as keyof typeof primaryCheckDigitIndex];

  if (checkDigitIndex !== undefined) {
    const checkDigitResult = validateGs1CheckDigit(pair.ai, pair.value, checkDigitIndex);

    return checkDigitResult.tag === "Ok" ? ok(pair) : checkDigitResult;
  }

  return ok(pair);
};

export const validateQualifiers = (
  primaryAi: string,
  qualifiers: readonly AiPair[]
): Result<DigitalLinkError, readonly AiPair[]> => {
  const rules = pathRulesByPrimary[primaryAi]!;
  const allowedForPrimary = new Set(rules.flat());

  for (const qualifier of qualifiers) {
    const metadata = qualifierMetadata[qualifier.ai as keyof typeof qualifierMetadata];

    if (metadata === undefined) {
      return err({
        ai: qualifier.ai,
        code: "UnsupportedQualifier",
        message: `AI ${qualifier.ai} is not a supported GS1 Digital Link key qualifier.`
      });
    }

    if (!allowedForPrimary.has(qualifier.ai)) {
      return err({
        ai: qualifier.ai,
        code: "UnsupportedQualifier",
        message: `AI ${qualifier.ai} is not a valid qualifier for primary AI ${primaryAi}.`
      });
    }

    if (!metadata.pattern.test(qualifier.value)) {
      return err({
        ai: qualifier.ai,
        code: "InvalidValue",
        message: `Value ${qualifier.value} does not match the ${metadata.label} format.`
      });
    }
  }

  const sequence = qualifiers.map((qualifier) => qualifier.ai);
  const isAllowed = rules.some(
    (rule) => rule.length === sequence.length && rule.every((qualifierAi, index) => qualifierAi === sequence[index])
  );
  const invalidIndex = sequence.findIndex((_, index) =>
    rules.every((rule) => sequence.slice(0, index + 1).some((qualifierAi, prefixIndex) => qualifierAi !== rule[prefixIndex]))
  );
  const invalidAi = invalidIndex === -1 ? (sequence[0] ?? primaryAi) : sequence[invalidIndex]!;

  return isAllowed
    ? ok(qualifiers)
    : err({
        ai: invalidAi,
        code: "InvalidPathOrder",
        message: `Qualifier sequence ${sequence.join(",")} is not valid for primary AI ${primaryAi}.`
      });
};

const extensionKey = /^\d*[-.!$&'()*+,;A-Za-z_:@/?~#%[\]][-.!$&'()*+,;0-9A-Za-z_:@/?~#%[\]]*$/;
const extensionValue = /^[-.!$&'()*+,;0-9A-Za-z_:=@/?~#%[\]]*$/;
const reservedExtensionKeys = new Set(["linkType", "context"]);

export const validateAttributes = (attributes: readonly AiPair[]): Result<DigitalLinkError, readonly AiPair[]> => {
  for (const attribute of attributes) {
    const metadata = attributeMetadata[attribute.ai];

    if (metadata !== undefined) {
      if (!metadata.pattern.test(attribute.value)) {
        return err({
          ai: attribute.ai,
          code: "InvalidValue",
          message: `Value ${attribute.value} does not match the ${metadata.label} format.`
        });
      }

      const primaryCheckDigit = primaryCheckDigitIndex[attribute.ai as keyof typeof primaryCheckDigitIndex];
      const attributeCheckDigit = attributeCheckDigitIndex[attribute.ai as keyof typeof attributeCheckDigitIndex];

      if (attribute.ai === "8003") {
        const checkDigitResult = validateGs1CheckDigit(attribute.ai, attribute.value.slice(1, 14), 12);

        if (checkDigitResult.tag === "Err") {
          return checkDigitResult;
        }
      } else if (primaryCheckDigit !== undefined || attributeCheckDigit !== undefined) {
        const checkDigitResult = validateGs1CheckDigit(attribute.ai, attribute.value, primaryCheckDigit ?? attributeCheckDigit!);

        if (checkDigitResult.tag === "Err") {
          return checkDigitResult;
        }
      }

      continue;
    }

    if (/^\d+$/.test(attribute.ai)) {
      return err({
        ai: attribute.ai,
        code: "UnsupportedAttribute",
        message: `Numeric query key ${attribute.ai} is not a GS1 Digital Link data attribute.`
      });
    }

    if (reservedExtensionKeys.has(attribute.ai)) {
      return err({
        ai: attribute.ai,
        code: "ReservedExtensionKey",
        message: `Extension key ${attribute.ai} is reserved by GS1 resolver standards.`
      });
    }

    if (!extensionKey.test(attribute.ai) || !extensionValue.test(attribute.value)) {
      return err({
        ai: attribute.ai,
        code: "InvalidQuery",
        message: `Extension parameter ${attribute.ai} is not valid GS1 Digital Link query syntax.`
      });
    }
  }

  return ok(attributes);
};

export const normalizeGtin = (value: string): Result<DigitalLinkError, string> => {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value)) {
    return err({
      ai: "01",
      code: "InvalidValue",
      message: "GTIN must be 8, 12, 13, or 14 digits before normalization."
    });
  }

  return ok(value.padStart(14, "0"));
};
