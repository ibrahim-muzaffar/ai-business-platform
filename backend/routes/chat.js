const express = require("express");

const router = express.Router();

// Health-style chat endpoint. Future AI request handling can be added to this
// router without coupling provider-specific logic to the main server file.
router.get("/", (_request, response) => {
  response.json({
    status: "success",
    message: "Backend connected successfully",
  });
});

module.exports = router;
