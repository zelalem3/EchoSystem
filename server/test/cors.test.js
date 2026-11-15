const assert = require("node:assert/strict");
const test = require("node:test");

process.env.CORS_ALLOWED_ORIGINS = "https://frontend.example";
const { createApp } = require("../src/app");
delete process.env.CORS_ALLOWED_ORIGINS;

test("allows configured origins for HTTP requests and preflights", async (t) => {
  const { httpServer, io } = createApp({
    auth: {},
    db: {},
    redisClient: null,
  });

  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => io.close(resolve)));

  const address = httpServer.address();
  const url = `http://127.0.0.1:${address.port}/health`;
  const headers = { Origin: "https://frontend.example" };

  const preflight = await fetch(url, {
    method: "OPTIONS",
    headers: {
      ...headers,
      "Access-Control-Request-Method": "GET",
    },
  });

  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    "https://frontend.example"
  );
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");

  const health = await fetch(url, { headers });
  assert.equal(health.status, 200);
  assert.equal(
    health.headers.get("access-control-allow-origin"),
    "https://frontend.example"
  );
});
