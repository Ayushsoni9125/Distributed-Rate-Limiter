function getClientIdentifier(req) {
    if (req.apiKey?.id) {
        return `apiKey:${req.apiKey.id}`;
    }

    if (req.user?.id) {
        return `user:${req.user.id}`;
    }

    return `ip:${req.ip}`;
}

module.exports = getClientIdentifier;