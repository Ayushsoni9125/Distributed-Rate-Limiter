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


async function listApiKeys(req, res) {
    try {
        const apiKeys = await prisma.apiKey.findMany({
            where: {
                userId: req.user.id
            },
            select: {
                id: true,
                createdAt: true,
                expiresAt: true,
                active: true
            }
        });

        res.json({
            apiKeys
        });
    } catch (error) {
        console.error("API key listing error:", error);

        res.status(500).json({
            message: "Failed to fetch API keys"
        });
    }
}

module.exports = {
    createApiKey,
    listApiKeys
};