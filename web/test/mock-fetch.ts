/** Minimal Response stand-in: jsdom provides neither fetch nor Response. */
export const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

export type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

/** Replaces global fetch with a handler; returns the mock to assert on calls. */
export function mockFetch(handler: FetchHandler): jest.Mock<Promise<Response>, [string, RequestInit?]> {
  const mock = jest.fn<Promise<Response>, [string, RequestInit?]>(handler);
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}
