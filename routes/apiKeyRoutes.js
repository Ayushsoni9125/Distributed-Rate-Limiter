const express = require("express");
const {
    createApiKey,
    listApiKeys,
    revokeApiKey
} = require("../controllers/apiKeyController");
const authenticate = require("../auth");

const router = express.Router();

router.post("/", authenticate, createApiKey);
router.get("/", authenticate, listApiKeys);
router.delete("/:id", authenticate, revokeApiKey);

module.exports = router;