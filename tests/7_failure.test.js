const request = require("supertest");
const { app, setupTestDb, teardownTestDb, createUser } = require("./testUtils");
const { redisClient } = require("../redis");
const config = require("../config");

describe("7. FAILURE MODES", () => {
  beforeAll(setupTestDb);
  afterAll(teardownTestDb);
  afterEach(() => {
    jest.restoreAllMocks();
    config.failureMode = "open";
  });

  test("Failure Mode — Fail Open", async () => {
    const { token } = await createUser();
    
    // Simulate Redis failure
    jest.spyOn(redisClient, "eval").mockRejectedValue(new Error("Simulated Redis Failure"));

    // Expected to fail open and allow the request
    await request(app).get("/api/test").set("Authorization", `Bearer ${token}`).expect(200);
  });

  test("Failure Mode — Fail Closed", async () => {
    const { token } = await createUser();
    
    config.failureMode = "closed"; // Temporarily change config in memory

    // Simulate Redis failure
    jest.spyOn(redisClient, "eval").mockRejectedValue(new Error("Simulated Redis Failure"));

    // Expected to fail closed and return 503
    await request(app).get("/api/test").set("Authorization", `Bearer ${token}`).expect(503);
  });
});
