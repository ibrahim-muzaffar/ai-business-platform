const express = require("express");

const router = express.Router();

// Accept chat messages from the frontend. Provider-specific AI logic can be
// added behind this route later without changing the public API contract.
router.post("/", (request, response) => {
  const { message, businessType } = request.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return response.status(400).json({
      status: "error",
      message: "A non-empty message is required.",
    });
  }

  const selectedBusiness =
    typeof businessType === "string" && businessType.trim()
      ? businessType.trim()
      : "unknown";

  response.json({
    status: "success",
    reply: `The backend received your message for the ${selectedBusiness} demo.`,
  });
});

module.exports = router;
