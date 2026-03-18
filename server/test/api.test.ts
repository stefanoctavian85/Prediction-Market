import { describe, it, expect, beforeAll } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { app } from "../index";
import db from "../src/db";

const BASE = "http://localhost";

// Shared state across tests (populated by earlier tests, consumed by later ones)
let authToken: string;
let userId: number;
let marketId: number;
let outcomeId: number;

// Run migrations to create tables on the in-memory DB
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

describe("Auth", () => {
  const username = "testuser";
  const email = "test@example.com";
  const password = "testpass123";

  it("POST /api/auth/register — creates a new user", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.username).toBe(username);
    expect(data.email).toBe(email);
    expect(data.token).toBeDefined();

    authToken = data.token;
    userId = data.id;
  });

  it("POST /api/auth/register — rejects duplicate user", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      }),
    );

    expect(res.status).toBe(409);
  });

  it("POST /api/auth/register — validates input", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ab", email: "bad", password: "12" }),
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it("POST /api/auth/login — logs in with valid credentials", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(userId);
    expect(data.token).toBeDefined();
  });

  it("POST /api/auth/login — rejects invalid credentials", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com", password: "wrong" }),
      }),
    );

    expect(res.status).toBe(401);
  });
});

describe("Markets", () => {
  it("POST /api/markets — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test market",
          outcomes: ["Yes", "No"],
        }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/markets — creates a market", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Will it rain tomorrow?",
          description: "Weather prediction",
          outcomes: ["Yes", "No"],
        }),
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.title).toBe("Will it rain tomorrow?");
    expect(data.outcomes).toHaveLength(2);

    marketId = data.id;
    outcomeId = data.outcomes[0].id;
  });

  it("POST /api/markets — validates input", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ title: "Hi", outcomes: ["Only one"] }),
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it("GET /api/markets — lists markets", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets`));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.markets.length).toBeGreaterThan(0);
    expect(data.markets[0].id).toBeDefined();
    expect(data.markets[0].title).toBeDefined();
    expect(data.markets[0].outcomes).toBeDefined();
  });

  it("GET /api/markets — filters by status", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets?status=active`));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.markets.every((m: any) => m.status === "active")).toBe(true);
  });

  it("GET /api/markets/:id — returns market detail", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/${marketId}`));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(marketId);
    expect(data.title).toBe("Will it rain tomorrow?");
    expect(data.description).toBe("Weather prediction");
    expect(data.outcomes).toHaveLength(2);
  });

  it("GET /api/markets/:id — 404 for nonexistent market", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/99999`));

    expect(res.status).toBe(404);
  });

  it("GET /api/markets/outcomes/:marketId — returns outcomes", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/outcomes/${marketId}`));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.outcomes).toHaveLength(2);
    expect(data.outcomes[0].id).toBeDefined();
    expect(data.outcomes[0].title).toBeDefined();
  });

  it("GET /api/markets/outcomes/:marketId — 404 for nonexistent market", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/outcomes/99999`));

    expect(res.status).toBe(404);
  });
});

describe("Bets", () => {
  it("POST /api/markets/:id/bets — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId, amount: 100 }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/markets/:id/bets — places a bet", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId, amount: 50 }),
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.userId).toBe(userId);
    expect(data.marketId).toBe(marketId);
    expect(data.outcomeId).toBe(outcomeId);
    expect(data.amount).toBe(50);
  });

  it("POST /api/markets/:id/bets — validates amount", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId, amount: -10 }),
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.length).toBeGreaterThan(0);
  });
});

describe("Profile", () => {
  it("GET /api/profile/user/:id — returns user information", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/profile/user/${userId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(userId);
    expect(data.username).toBeDefined();
    expect(data.email).toBeDefined();
    expect(data.balance).toBeDefined();
    expect(data.passwordHash).toBeUndefined();
  });

  it("GET /api/profile/user/:id — 404 for nonexistent user", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/profile/user/99999`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    );

    expect(res.status).toBe(404);
  });

  it("GET /api/profile/:id/bets — returns user bets", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/profile/${userId}/bets?status=active`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bets).toBeDefined();
    expect(data.totalBets).toBeDefined();
  });

  it("GET /api/profile/user/generateApiKey/:id — generates API key", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/profile/user/generateApiKey/${userId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.apiKey).toBeDefined();
    expect(data.apiKey.length).toBe(64);
  });

  it("GET /api/profile/user/generateApiKey/:id — forbids other users", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/profile/user/generateApiKey/99999`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    );

    expect(res.status).toBe(403);
  });
});

describe("Admin", () => {
  it("PATCH /api/markets/resolve/:marketId/:outcomeId — requires admin", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/resolve/${marketId}/${outcomeId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    );

    expect(res.status).toBe(401);
  });

  it("PATCH /api/markets/archive/:marketId — requires admin", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/archive/${marketId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    );

    expect(res.status).toBe(401);
  });
});

describe("Leaderboard", () => {
  it("GET /api/leaderboard — returns leaderboard", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/leaderboard`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("Error handling", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const res = await app.handle(new Request(`${BASE}/nonexistent`));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Not found");
  });
});