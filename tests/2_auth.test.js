const request = require("supertest");
const { app, setupTestDb, teardownTestDb, createUser, createApiKey } = require("./testUtils");

describe("2. AUTHENTICATION & IDENTIFICATION", () => {
  beforeAll(setupTestDb);
  afterAll(teardownTestDb);

  test("Protected endpoints reject unauthenticated requests", async () => {
    await request(app).get("/api/test").expect(401);
    await request(app).get("/api/products").expect(401);
    await request(app).get("/api/burst").expect(401);
  });

  test("JWT Validation", async () => {
    const { token } = await createUser();
    await request(app).get("/api/test").expect(401); // missing
    await request(app).get("/api/test").set("Authorization", "Bearer invalid").expect(401); // invalid
    await request(app).get("/api/test").set("Authorization", `Bearer ${token}`).expect(200); // valid
  });

  test("JWT vs API KEY Identification", async () => {
    const { token } = await createUser();
    const apiKey = await createApiKey(token);

    const resJwt = await request(app).get("/api/data").set("Authorization", `Bearer ${token}`).expect(200);
    expect(resJwt.body.authenticatedVia).toBe("jwt");

    const resKey = await request(app).get("/api/data").set("x-api-key", apiKey).expect(200);
    expect(resKey.body.authenticatedVia).toBe("api_key");
  });
});
