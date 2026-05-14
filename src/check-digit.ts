import { err, ok, type Result } from "./result.js";
import type { DigitalLinkError } from "./types.js";

const calculateGs1CheckDigitValue = (valueWithoutCheckDigit: string): string => {
  let sum = 0;
  let reverseIndex = 0;

  for (let index = valueWithoutCheckDigit.length - 1; index >= 0; index -= 1) {
    sum += Number(valueWithoutCheckDigit[index]) * (reverseIndex % 2 === 0 ? 3 : 1);
    reverseIndex += 1;
  }

  return String((10 - (sum % 10)) % 10);
};

export const calculateGs1CheckDigit = (valueWithoutCheckDigit: string): Result<DigitalLinkError, string> => {
  if (!/^\d+$/.test(valueWithoutCheckDigit)) {
    return err({
      code: "InvalidValue",
      message: "GS1 check digit calculation input must contain only digits."
    });
  }

  return ok(calculateGs1CheckDigitValue(valueWithoutCheckDigit));
};

export const validateGs1CheckDigit = (
  ai: string,
  value: string,
  checkDigitIndex: number
): Result<DigitalLinkError, string> => {
  const body = value.slice(0, checkDigitIndex);
  const actual = value[checkDigitIndex]!;
  const expected = calculateGs1CheckDigitValue(body);

  return actual === expected
    ? ok(value)
    : err({
        ai,
        code: "InvalidCheckDigit",
        message: `AI ${ai} has check digit ${actual} but expected ${expected}.`
      });
};
