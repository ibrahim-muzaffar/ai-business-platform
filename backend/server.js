const express = require("express");
const cors = require("cors");

const chatRouter = require("./routes/chat");

const app = express();
const PORT = 5000;

// Application-wide middleware. JSON parsing prepares the API for future
// request bodies, while CORS allows the separate Next.js frontend to connect.
app.use(cors());
app.use(express.json());

// Feature routes live in separate modules so the API can grow cleanly.
app.use("/api/chat", chatRouter);

// Start the HTTP server only when this file is run directly. Exporting the app
// keeps it easy to test and extend without opening another network listener.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
