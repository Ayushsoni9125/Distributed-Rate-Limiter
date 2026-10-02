const express = require("express");
const {
    createApiKey,
    listApiKeys
} = require("../controllers/apiKeyController");
const authenticate = require("../auth");

const router = express.Router();

router.post("/", authenticate, createApiKey);
router.get("/", authenticate, listApiKeys);

module.exports = router;