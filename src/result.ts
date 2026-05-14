export type Ok<A> = {
  readonly tag: "Ok";
  readonly value: A;
};

export type Err<E> = {
  readonly tag: "Err";
  readonly error: E;
};

export type Result<E, A> = Ok<A> | Err<E>;

export const ok = <A>(value: A): Result<never, A> => ({ tag: "Ok", value });

export const err = <E>(error: E): Result<E, never> => ({ tag: "Err", error });

export const isOk = <E, A>(result: Result<E, A>): result is Ok<A> => result.tag === "Ok";

export const isErr = <E, A>(result: Result<E, A>): result is Err<E> => result.tag === "Err";

export const map = <E, A, B>(result: Result<E, A>, f: (value: A) => B): Result<E, B> =>
  isOk(result) ? ok(f(result.value)) : result;

export const flatMap = <E, A, F, B>(
  result: Result<E, A>,
  f: (value: A) => Result<F, B>
): Result<E | F, B> => (isOk(result) ? f(result.value) : result);
