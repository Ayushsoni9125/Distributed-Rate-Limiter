function getClientIdentifier(req) {
    return req.ip;
}

module.exports = getClientIdentifier;