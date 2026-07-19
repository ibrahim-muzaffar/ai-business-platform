const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

const chatRouter = require("../routes/chat");

async function postChat(router, body) {
  const app = express();
  app.use(express.json());
  app.use("/api/chat", router);

  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => {
      resolve(listeningServer);
    });
  });

  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("unsupported demos return safely without protected service calls", async () => {
  const calls = {
    analysis: 0,
    businessData: 0,
    createSession: 0,
    getSession: 0,
    saveLead: 0,
  };

  const router = chatRouter.createChatRouter({
    openAIClient: {},
    businesses: {
      normaliseBusinessType: (value) => value.trim().toLowerCase(),
      isBusinessConfigured: (value) => value === "barber",
      getBusinessData: async () => {
        calls.businessData += 1;
      },
    },
    analysis: {
      analyseChatMessage: async () => {
        calls.analysis += 1;
      },
    },
    leads: {
      saveLead: async () => {
        calls.saveLead += 1;
      },
    },
    sessions: {
      getSession: () => {
        calls.getSession += 1;
      },
      createSession: () => {
        calls.createSession += 1;
      },
    },
  });

  const result = await postChat(router, {
    message: "Can I book a table tonight?",
    businessType: "restaurant",
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    status: "success",
    reply: chatRouter.UNSUPPORTED_BUSINESS_REPLY,
    sessionId: null,
  });
  assert.deepEqual(calls, {
    analysis: 0,
    businessData: 0,
    createSession: 0,
    getSession: 0,
    saveLead: 0,
  });
});

test("configured barber requests still reach grounded analysis and sessions", async () => {
  const calls = { analysis: 0, createSession: 0 };
  const session = {
    id: "session-barber-1",
    businessType: "barber",
    leadFields: {},
    messages: [],
    completed: false,
  };
  const verifiedBusiness = { businessType: "barber", name: "Test Barbers" };

  const router = chatRouter.createChatRouter({
    openAIClient: { responses: {} },
    businesses: {
      normaliseBusinessType: (value) => value.trim().toLowerCase(),
      isBusinessConfigured: (value) => value === "barber",
      getBusinessData: async () => verifiedBusiness,
    },
    sessions: {
      getSession: () => null,
      createSession: () => {
        calls.createSession += 1;
        return session;
      },
      addMessage: (_sessionId, message) => session.messages.push(message),
    },
    analysis: {
      analyseChatMessage: async (input) => {
        calls.analysis += 1;
        assert.equal(input.businessType, "barber");
        assert.equal(input.businessData, verifiedBusiness);
        return {
          intent: "general",
          reply: "Grounded barber reply.",
          leadFields: {},
        };
      },
    },
  });

  const result = await postChat(router, {
    message: "What time do you open?",
    businessType: "barber",
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    status: "success",
    reply: "Grounded barber reply.",
    sessionId: "session-barber-1",
  });
  assert.deepEqual(calls, { analysis: 1, createSession: 1 });
});
