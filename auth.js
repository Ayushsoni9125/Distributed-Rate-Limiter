const jwt = require("jsonwebtoken");
const prisma = require("./prismaClient");
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await prisma.user.findUnique({
            where: {
                id: decoded.userId
            },
            select: {
                id: true,
                plan: true
            }
        });

        if (!user) {
            return res.status(401).json({
                message: "User not found"
            });
        }

        req.user = user;

        next();
    }    catch (error) {
    console.error("AUTH ERROR:", error);

    return res.status(401).json({
        message: "Authentication failed",
        error: error.message
    });
}
}



module.exports = authenticate;