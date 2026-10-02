const prisma = require("../prismaClient");
const generateApiKey = require("../utils/generateApiKey");

async function createApiKey(req, res) {
    try {
        const key = generateApiKey();

        const apiKey = await prisma.apiKey.create({
            data: {
                key,
                userId: req.user.id
            }
        });

        res.status(201).json({
            message: "API key created successfully",
            apiKey: {
                id: apiKey.id,
                key: apiKey.key,
                createdAt: apiKey.createdAt,
                expiresAt: apiKey.expiresAt,
                active: apiKey.active
            }
        });
    } catch (error) {
        console.error("API key creation error:", error);

        res.status(500).json({
            message: "Failed to create API key"
        });
    }
}

module.exports = {
    createApiKey
};