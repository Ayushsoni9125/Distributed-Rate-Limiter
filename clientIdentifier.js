function getClientIdentifier(req) {
    if (req.user?.id) {
        return `user:${req.user.id}`;
    }

    if (req.apiKey?.id) {
        return `apiKey:${req.apiKey.id}`;
    }

    return `ip:${req.ip}`;
}

module.exports = getClientIdentifier;