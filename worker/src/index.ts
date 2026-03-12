export interface Env {
  TRIPS: KVNamespace;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => chars[b % chars.length])
    .join('');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const { pathname } = new URL(request.url);

    // POST / — store trip data, return short code
    if (request.method === 'POST' && pathname === '/') {
      const body = await request.text();
      if (!body || body.length > 64_000) {
        return json({ error: 'Invalid payload' }, 400);
      }

      // Ensure code is unique (max 5 tries, then 409)
      let code = '';
      for (let i = 0; i < 5; i++) {
        const candidate = generateCode();
        if ((await env.TRIPS.get(candidate)) === null) {
          code = candidate;
          break;
        }
      }
      if (!code) return json({ error: 'Try again' }, 409);

      // Store for 90 days
      await env.TRIPS.put(code, body, { expirationTtl: 60 * 60 * 24 * 90 });

      return json({ code });
    }

    // GET /:code — retrieve trip data
    if (request.method === 'GET' && /^\/[a-z0-9]{8}$/.test(pathname)) {
      const code = pathname.slice(1);
      const data = await env.TRIPS.get(code);
      if (!data) return json({ error: 'Not found' }, 404);
      return new Response(data, {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return json({ error: 'Not found' }, 404);
  },
};
