const { redisClient } = require("./redis");
const getClientIdentifier = require("./clientIdentifier");
const rateLimitScript = require("./rateLimitScript");


function rateLimiter(limit, windowInSeconds) {
  return async (req, res, next) => {

    const clientId = getClientIdentifier(req);
    const endpoint = req.baseUrl + req.path;
    const key = `rate-limit:${clientId}:${endpoint}`;

    const [currentCount, ttl] = await redisClient.eval(rateLimitScript, {
      keys: [key],
      arguments: [windowInSeconds.toString()]
    });

    // Calculate the number of requests remaining in the window
    const remaining = Math.max(0, limit - currentCount);

    // Set the rate limit headers
    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", ttl);

    if (currentCount > limit) {
      res.setHeader("Retry-After", ttl);

      return res.status(429).json({
        message: "Too many requests",
      });
    }

    next();
  };
}

module.exports = rateLimiter;
