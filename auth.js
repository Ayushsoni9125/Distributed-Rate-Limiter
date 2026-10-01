function authenticate(req, res, next) {
    const userId = req.headers["x-user-id"];

    if (!userId) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    req.user = {
        id: userId
    };

    next();
}

module.exports = authenticate;