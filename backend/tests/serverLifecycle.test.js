const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const Module = require("node:module");
const test = require("node:test");

const { startServer } = require("../runtime/serverLifecycle");

function createLogger(overrides = {}) {
  return {
    log() {},
    error() {},
    ...overrides,
  };
}

function createSignalSource() {
  const source = new EventEmitter();
  source.exitCode = undefined;
  return source;
}

function createHttpFixture({ closeError = null, listenError = null } = {}) {
  const server = new EventEmitter();
  let closeCalls = 0;
  let listenCalls = 0;

  server.close = (callback) => {
    closeCalls += 1;
    queueMicrotask(() => callback(closeError));
  };

  const app = {
    listen(...args) {
      listenCalls += 1;
      const callback = args.at(-1);
      if (listenError) {
        queueMicrotask(() => server.emit("error", listenError));
      } else {
        queueMicrotask(callback);
      }
      return server;
    },
  };

  return {
    app,
    server,
    get closeCalls() {
      return closeCalls;
    },
    get listenCalls() {
      return listenCalls;
    },
  };
}

test("database readiness precedes listening and shutdown is idempotent", async () => {
  const order = [];
  const http = createHttpFixture();
  const originalListen = http.app.listen;
  http.app.listen = (...args) => {
    order.push("listen");
    return originalListen(...args);
  };
  let databaseCloseCalls = 0;

  const lifecycle = await startServer({
    app: http.app,
    port: 5000,
    getDatabaseConnection: () => ({
      async raw(query) {
        assert.equal(query, "SELECT 1");
        order.push("database");
      },
    }),
    closeDatabaseConnection: async () => {
      databaseCloseCalls += 1;
    },
    signalSource: createSignalSource(),
    logger: createLogger(),
  });

  assert.deepEqual(order, ["database", "listen"]);
  assert.equal(lifecycle.server, http.server);
  assert.equal(typeof lifecycle.shutdown, "function");

  await Promise.all([
    lifecycle.shutdown("test"),
    lifecycle.shutdown("duplicate"),
    lifecycle.shutdown("duplicate again"),
  ]);
  assert.equal(http.closeCalls, 1);
  assert.equal(databaseCloseCalls, 1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  test(`${signal} uses graceful shutdown and removes signal handlers`, async () => {
    const signalSource = createSignalSource();
    const http = createHttpFixture();
    let databaseCloseCalls = 0;

    await startServer({
      app: http.app,
      port: 5000,
      getDatabaseConnection: () => ({ raw: async () => {} }),
      closeDatabaseConnection: async () => {
        databaseCloseCalls += 1;
      },
      signalSource,
      logger: createLogger(),
    });

    assert.equal(signalSource.listenerCount("SIGINT"), 1);
    assert.equal(signalSource.listenerCount("SIGTERM"), 1);
    signalSource.emit(signal);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(http.closeCalls, 1);
    assert.equal(databaseCloseCalls, 1);
    assert.equal(signalSource.listenerCount("SIGINT"), 0);
    assert.equal(signalSource.listenerCount("SIGTERM"), 0);
    assert.equal(signalSource.exitCode, 0);
  });
}

test("signal shutdown failure is safe and sets a failing exit code", async () => {
  const shutdownError = Object.assign(new Error("safe close failure"), {
    code: "CLOSE_FAILED",
  });
  const signalSource = createSignalSource();
  const http = createHttpFixture({ closeError: shutdownError });
  let databaseCloseCalls = 0;
  let resolveLogged;
  const logged = new Promise((resolve) => {
    resolveLogged = resolve;
  });
  const errors = [];

  await startServer({
    app: http.app,
    port: 5000,
    getDatabaseConnection: () => ({ raw: async () => {} }),
    closeDatabaseConnection: async () => {
      databaseCloseCalls += 1;
    },
    signalSource,
    logger: createLogger({
      error(message, details) {
        errors.push({ message, details });
        resolveLogged();
      },
    }),
  });

  signalSource.emit("SIGINT");
  await logged;

  assert.equal(databaseCloseCalls, 1);
  assert.equal(signalSource.exitCode, 1);
  assert.deepEqual(errors, [
    {
      message: "Backend shutdown failed",
      details: {
        name: "Error",
        code: "CLOSE_FAILED",
        message: "safe close failure",
      },
    },
  ]);
});

test("database readiness failure prevents listening and preserves the error", async () => {
  const originalError = new Error("database unavailable");
  const http = createHttpFixture();
  let databaseCloseCalls = 0;

  await assert.rejects(
    startServer({
      app: http.app,
      port: 5000,
      getDatabaseConnection: () => ({
        raw: async () => {
          throw originalError;
        },
      }),
      closeDatabaseConnection: async () => {
        databaseCloseCalls += 1;
      },
      signalSource: createSignalSource(),
      logger: createLogger(),
    }),
    (error) => error === originalError,
  );

  assert.equal(http.listenCalls, 0);
  assert.equal(databaseCloseCalls, 1);
});

test("HTTP listen failure closes the database and preserves the error", async () => {
  const originalError = new Error("address unavailable");
  const http = createHttpFixture({ listenError: originalError });
  let databaseCloseCalls = 0;

  await assert.rejects(
    startServer({
      app: http.app,
      port: 5000,
      getDatabaseConnection: () => ({ raw: async () => {} }),
      closeDatabaseConnection: async () => {
        databaseCloseCalls += 1;
      },
      signalSource: createSignalSource(),
      logger: createLogger(),
    }),
    (error) => error === originalError,
  );

  assert.equal(http.listenCalls, 1);
  assert.equal(databaseCloseCalls, 1);
});

test("importing server.js does not load database lifecycle or listen", () => {
  const serverPath = require.resolve("../server");
  delete require.cache[serverPath];
  const originalLoad = Module._load;
  const directStartupImports = [];

  Module._load = function load(request, parent, isMain) {
    if (
      parent?.filename === serverPath &&
      ["./db/connection", "./runtime/serverLifecycle"].includes(request)
    ) {
      directStartupImports.push(request);
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const app = require("../server");
    assert.equal(typeof app.listen, "function");
  } finally {
    Module._load = originalLoad;
    delete require.cache[serverPath];
  }

  assert.deepEqual(directStartupImports, []);
});
