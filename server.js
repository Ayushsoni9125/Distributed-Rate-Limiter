const express = require("express");

const app = express();

const port = process.env.PORT || 5056;

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Distributed Rate Limiter API is running"
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});