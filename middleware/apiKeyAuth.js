const bcrypt = require("bcryptjs");
const prisma = require("../prismaClient");

async function apiKeyAuth(req, res, next) {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
        return res.status(401).json({
            error: "missing_api_key",
            message: "API key required. Provide it in the X-API-Key header."
        });
    }

    // The prefix is the first 8 chars of the plaintext key.
    // It is non-secret and lets us filter candidates in Postgres before bcrypt.compare,
    // turning an O(N) scan over all active keys into an O(1) lookup.
    const keyPrefix = apiKey.substring(0, 8);

    try {
        // Fetch only the small set of keys that share this prefix (usually 1).
        const candidates = await prisma.apiKey.findMany({
            where: {
                keyPrefix,
                active: true
            },
            include: {
                user: {
                    select: { id: true, plan: true }
                }
            }
        });

        // bcrypt.compare each candidate (normally just one).
        let matchedKey = null;
        for (const candidate of candidates) {
            const isMatch = await bcrypt.compare(apiKey, candidate.key);
            if (isMatch) {
                matchedKey = candidate;
                break;
            }
        }

        if (!matchedKey) {
            return res.status(401).json({
                error: "invalid_api_key",
                message: "Invalid API key."
            });
        }

        // Check expiration before checking revocation so the error message is accurate.
        if (matchedKey.expiresAt && matchedKey.expiresAt < new Date()) {
            return res.status(401).json({
                error: "expired_api_key",
                message: "API key has expired."
            });
        }

        // active=false check is already in the query, but guard explicitly
        // in case a deactivated key somehow passed the prefix lookup.
        if (!matchedKey.active) {
            return res.status(401).json({
                error: "revoked_api_key",
                message: "API key has been revoked."
            });
        }

        // Attach the API key and owning user to the request so downstream
        // middleware (rateLimitPolicy → planPolicy → clientIdentifier) can work correctly.
        req.apiKey = matchedKey;
        req.user   = matchedKey.user; // makes planPolicy read the correct plan

        next();
    } catch (error) {
        console.error("API key authentication error:", error);

        return res.status(500).json({
            error: "auth_error",
            message: "API key authentication failed. Please try again."
        });
    }
}

module.exports = apiKeyAuth;