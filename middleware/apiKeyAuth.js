const bcrypt = require("bcryptjs");
const prisma = require("../prismaClient");

async function apiKeyAuth(req, res, next) {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
        return res.status(401).json({
            message: "API key required"
        });
    }

    try {
        const apiKeys = await prisma.apiKey.findMany({
            where: {
                active: true
            }
        });

        let matchedKey = null;

        for (const storedKey of apiKeys) {
            const isMatch = await bcrypt.compare(apiKey, storedKey.key);

            if (isMatch) {
                matchedKey = storedKey;
                break;
            }
        }

        if (!matchedKey) {
            return res.status(401).json({
                message: "Invalid API key"
            });
        }

        req.apiKey = matchedKey;

        next();
    } catch (error) {
        console.error("API key authentication error:", error);

        return res.status(500).json({
            message: "API key authentication failed"
        });
    }
}

module.exports = apiKeyAuth;