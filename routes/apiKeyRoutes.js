const express = require("express");
const { createApiKey } = require("../controllers/apiKeyController");
const authenticate = require("../auth");

const router = express.Router();

router.post("/", authenticate, createApiKey);

module.exports = router;