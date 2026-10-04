const request = require("supertest");
const app = require("../server");

const { connectRedis, redisClient } = require("../redis");
const prisma = require("../prismaClient");

describe("Fixed Window Rate Limiter", () => {
    let token;

    beforeAll(async () => {
        await connectRedis();

        const email = `test-${Date.now()}@example.com`;

        await request(app)
            .post("/api/auth/register")
            .send({
                name: "Rate Limit Test",
                email,
                password: "Test@123"
            })
            .expect(201);

        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({
                email,
                password: "Test@123"
            })
            .expect(200);

        token = loginResponse.body.token;
    });

    afterAll(async () => {
        await redisClient.quit();
        await prisma.$disconnect();
    });

    test("allows 5 requests and blocks the 6th request", async () => {
        const responses = [];

        for (let i = 0; i < 6; i++) {
            const response = await request(app)
                .get("/api/test")
                .set("Authorization", `Bearer ${token}`);

            responses.push(response);
        }

        expect(
            responses.slice(0, 5).every(r => r.statusCode === 200)
        ).toBe(true);

        expect(responses[5].statusCode).toBe(429);
    });
});