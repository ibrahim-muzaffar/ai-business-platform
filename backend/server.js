require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");

const authRouter = require("./routes/auth");
const chatRouter = require("./routes/chat");

const app = express();
const PORT = 5000;

// Application-wide middleware. JSON parsing prepares the API for future
// request bodies, while CORS allows the separate Next.js frontend to connect.
app.use(cors());

// Feature routes live in separate modules so the API can grow cleanly.
// Authentication applies a smaller, route-specific JSON request limit.
app.use("/api/auth", authRouter);
app.use(express.json());
app.use("/api/chat", chatRouter);

// Start the HTTP server only when this file is run directly. Exporting the app
// keeps it easy to test and extend without opening another network listener.
if (require.main === module) {
  const {
    closeDatabaseConnection,
    getDatabaseConnection,
  } = require("./db/connection");
  const {
    getAuthenticationRuntime,
  } = require("./runtime/authentication");
  const { startServer } = require("./runtime/serverLifecycle");

  Promise.resolve()
    .then(() => getAuthenticationRuntime())
    .then(() =>
      startServer({
        app,
        port: PORT,
        getDatabaseConnection: () =>
          getDatabaseConnection("development"),
        closeDatabaseConnection: () =>
          closeDatabaseConnection("development"),
      }),
    )
    .then(() => {
      console.log(`Backend listening on http://localhost:${PORT}`);
    })
    .catch((error) => {
      console.error("Backend startup failed", {
        name: error?.name,
        code: error?.code,
        message: error?.message,
      });
      process.exitCode = 1;
    });
}

module.exports = app;
