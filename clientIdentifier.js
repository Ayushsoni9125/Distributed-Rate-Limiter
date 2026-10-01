function getClientIdentifier(req) {
    if (req.user?.id) {
        return `user:${req.user.id}`;
    }

    return `ip:${req.ip}`;
}

module.exports = getClientIdentifier;