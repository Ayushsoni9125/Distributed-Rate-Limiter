function getRouteIdentifier(req) {
    return req.route?.path || req.path;
}

module.exports = getRouteIdentifier;