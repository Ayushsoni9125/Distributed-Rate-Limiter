const request = require("supertest");
const app = require("../server");

describe("API Health Check", () => {
    test("GET / should return 200", async () => {
        const response = await request(app)
            .get("/");

        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe(
            "Distributed Rate Limiter API is running"
        );
    });
});