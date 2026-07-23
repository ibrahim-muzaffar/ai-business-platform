function safeErrorDetails(error) {
  return {
    name: error?.name,
    code: error?.code,
    message: error?.message,
  };
}

function closeHttpServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function listen(app, port, host) {
  return new Promise((resolve, reject) => {
    let server;

    function listening() {
      server.removeListener("error", failed);
      resolve(server);
    }

    function failed(error) {
      reject(error);
    }

    try {
      server =
        host === undefined
          ? app.listen(port, listening)
          : app.listen(port, host, listening);
      server.once("error", failed);
    } catch (error) {
      reject(error);
    }
  });
}

async function startServer({
  app,
  port,
  getDatabaseConnection,
  closeDatabaseConnection,
  host,
  signalSource = process,
  logger = console,
}) {
  let database;
  let server;

  try {
    database = getDatabaseConnection();
    await database.raw("SELECT 1");
    server = await listen(app, port, host);
  } catch (error) {
    if (database) {
      try {
        await closeDatabaseConnection();
      } catch (cleanupError) {
        logger.error(
          "Database cleanup after startup failure failed",
          safeErrorDetails(cleanupError),
        );
      }
    }
    throw error;
  }

  let shutdownPromise = null;
  const signalHandlers = new Map();

  function removeSignalHandlers() {
    for (const [signal, handler] of signalHandlers) {
      signalSource.removeListener(signal, handler);
    }
    signalHandlers.clear();
  }

  function shutdown(reason = "requested") {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
      removeSignalHandlers();
      logger.log(`Backend shutdown started: ${reason}`);

      let shutdownError = null;
      try {
        await closeHttpServer(server);
      } catch (error) {
        shutdownError = error;
      }

      try {
        await closeDatabaseConnection();
      } catch (error) {
        shutdownError ??= error;
      }

      if (shutdownError) throw shutdownError;
      logger.log("Backend shutdown complete");
    })();

    return shutdownPromise;
  }

  function registerSignal(signal) {
    const handler = async () => {
      try {
        await shutdown(signal);
        if ("exitCode" in signalSource) signalSource.exitCode = 0;
      } catch (error) {
        logger.error("Backend shutdown failed", safeErrorDetails(error));
        if ("exitCode" in signalSource) signalSource.exitCode = 1;
      }
    };
    signalHandlers.set(signal, handler);
    signalSource.on(signal, handler);
  }

  registerSignal("SIGINT");
  registerSignal("SIGTERM");

  return { server, shutdown };
}

module.exports = { startServer };
