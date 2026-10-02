const prisma = require("../prismaClient");
const generateApiKey = require("../utils/generateApiKey");
const bcrypt = require("bcryptjs");

async function createApiKey(req, res) {
    try {
        const key = generateApiKey();
        const hashedKey = await bcrypt.hash(key, 10);
        const keyPrefix = key.substring(0, 8); // Non-secret lookup index

        // Optional expiry from request body (ISO 8601 string or null)
        let expiresAt = null;
        if (req.body.expiresAt) {
            expiresAt = new Date(req.body.expiresAt);
            if (isNaN(expiresAt.getTime())) {
                return res.status(400).json({ message: "Invalid expiresAt date" });
            }
            if (expiresAt <= new Date()) {
                return res.status(400).json({ message: "expiresAt must be in the future" });
            }
        }

        const apiKey = await prisma.apiKey.create({
            data: {
                key: hashedKey,
                keyPrefix,
                userId: req.user.id,
                expiresAt
            }
        });

        // Return the plaintext key ONCE — it is not stored and cannot be retrieved again.
        res.status(201).json({
            message: "API key created successfully",
            apiKey: {
                id: apiKey.id,
                key,              // plaintext — shown only at creation
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

async function revokeApiKey(req, res) {
    try {
        const apiKeyId = Number(req.params.id);

        if (Number.isNaN(apiKeyId)) {
            return res.status(400).json({
                message: "Invalid API key ID"
            });
        }

        const apiKey = await prisma.apiKey.findFirst({
            where: {
                id: apiKeyId,
                userId: req.user.id
            }
        });

        if (!apiKey) {
            return res.status(404).json({
                message: "API key not found"
            });
        }

        await prisma.apiKey.update({
            where: {
                id: apiKeyId
            },
            data: {
                active: false
            }
        });

        res.json({
            message: "API key revoked successfully"
        });
    } catch (error) {
        console.error("API key revocation error:", error);

        res.status(500).json({
            message: "Failed to revoke API key"
        });
    }
}

module.exports = {
    createApiKey,
    listApiKeys,
    revokeApiKey
};