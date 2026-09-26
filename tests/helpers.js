// Shared test helpers: route fetch() calls to canned responses.
export function mockFetch(routes) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, opts });
    for (const [pattern, body] of routes) {
      if (pattern instanceof RegExp ? pattern.test(u) : u.includes(pattern)) {
        if (body instanceof Error) throw body;
        const status = body?.__status ?? 200;
        const text = typeof body === 'string' ? body : JSON.stringify(body);
        return new Response(text, { status, headers: { 'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json' } });
      }
    }
    return new Response('not found', { status: 404 });
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}
