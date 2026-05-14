export type Ok<A> = {
  readonly ok: true;
  readonly value: A;
};

export type Err<E> = {
  readonly ok: false;
  readonly error: E;
};

export type Result<E, A> = Ok<A> | Err<E>;

export const ok = <A>(value: A): Result<never, A> => ({ ok: true, value });

export const err = <E>(error: E): Result<E, never> => ({ ok: false, error });

export const isOk = <E, A>(result: Result<E, A>): result is Ok<A> => result.ok;

export const isErr = <E, A>(result: Result<E, A>): result is Err<E> => !result.ok;

export const map = <E, A, B>(result: Result<E, A>, f: (value: A) => B): Result<E, B> =>
  isOk(result) ? ok(f(result.value)) : result;

export const flatMap = <E, A, F, B>(
  result: Result<E, A>,
  f: (value: A) => Result<F, B>
): Result<E | F, B> => (isOk(result) ? f(result.value) : result);
