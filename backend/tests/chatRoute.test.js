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
      addMessage: async (_sessionId, message) => {
        session.messages.push(message);
        return session;
      },
    },
    analysis: {
      analyseChatMessage: async (input) => {
        calls.analysis += 1;
        assert.equal(input.businessType, "barber");
        assert.equal(input.businessData, verifiedBusiness);
        assert.deepEqual(input.recentMessages, []);
        assert.deepEqual(session.messages, [
          { role: "user", text: "What time do you open?" },
        ]);
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
  assert.deepEqual(session.messages, [
    { role: "user", text: "What time do you open?" },
    { role: "assistant", text: "Grounded barber reply." },
  ]);
});

test("configured business data is loaded before a session is accessed", async () => {
  const calls = { analysis: 0, createSession: 0, getSession: 0, saveLead: 0 };

  const router = chatRouter.createChatRouter({
    openAIClient: { responses: {} },
    businesses: {
      normaliseBusinessType: (value) => value.trim().toLowerCase(),
      isBusinessConfigured: () => true,
      getBusinessData: async () => null,
    },
    sessions: {
      getSession: () => {
        calls.getSession += 1;
      },
      createSession: () => {
        calls.createSession += 1;
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
  });

  const result = await postChat(router, {
    message: "What time do you open?",
    businessType: "barber",
  });

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    status: "error",
    message: "The AI assistant is temporarily unavailable. Please try again.",
  });
  assert.deepEqual(calls, {
    analysis: 0,
    createSession: 0,
    getSession: 0,
    saveLead: 0,
  });
});

test("database failures use the controlled response without exposing details", async () => {
  const calls = { analysis: 0, createSession: 0, getSession: 0 };
  const databaseError = new Error("sensitive database diagnostic detail");

  const router = chatRouter.createChatRouter({
    openAIClient: { responses: {} },
    businesses: {
      normaliseBusinessType: (value) => value.trim().toLowerCase(),
      isBusinessConfigured: () => true,
      getBusinessData: async () => {
        throw databaseError;
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
    analysis: {
      analyseChatMessage: async () => {
        calls.analysis += 1;
      },
    },
  });

  const result = await postChat(router, {
    message: "What time do you open?",
    businessType: "barber",
  });

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    status: "error",
    message: "The AI assistant is temporarily unavailable. Please try again.",
  });
  assert.equal(
    JSON.stringify(result.body).includes("sensitive database diagnostic detail"),
    false,
  );
  assert.deepEqual(calls, { analysis: 0, createSession: 0, getSession: 0 });
});

function createCompleteLeadRouter({ saveLead, markedLeadIds }) {
  const session = {
    id: "session-lead-1",
    businessType: "barber",
    leadFields: {},
    messages: [],
    completed: false,
  };
  const preparedLead = {
    id: "70000000-0000-0000-0000-000000000051",
    name: "Alex Smith",
    phone: "07123 456789",
    email: "alex@example.test",
    service: "Classic haircut",
    preferredDate: "22 July 2026",
    preferredTime: "2:30 pm",
    businessType: "barber",
    createdAt: "2026-07-22T12:00:00.000Z",
    status: "new",
  };

  return {
    preparedLead,
    router: chatRouter.createChatRouter({
      openAIClient: { responses: {} },
      businesses: {
        normaliseBusinessType: (value) => value.trim().toLowerCase(),
        isBusinessConfigured: () => true,
        getBusinessData: async () => ({
          businessType: "barber",
          name: "Test Barbers",
        }),
      },
      sessions: {
        getSession: () => session,
        createSession: () => session,
        addMessage: async (_sessionId, message) => {
          session.messages.push(message);
          return session;
        },
        mergeLeadFields: async (_sessionId, fields) => {
          return {
            ...session,
            leadFields: { ...session.leadFields, ...fields },
          };
        },
        markCompleted: async (_sessionId, leadId) => {
          markedLeadIds.push(leadId);
          return true;
        },
      },
      analysis: {
        analyseChatMessage: async () => ({
          intent: "lead",
          reply: "",
          leadFields: { name: "Alex Smith" },
        }),
      },
      leadValidation: {
        prepareLead: (leadFields) => {
          assert.deepEqual(leadFields, { name: "Alex Smith" });
          return {
            invalidFields: [],
            missingFields: [],
            lead: preparedLead,
          };
        },
      },
      leads: { saveLead },
    }),
  };
}

test("complete leads use the stored ID and preserve the success reply", async () => {
  const markedLeadIds = [];
  let receivedLead;
  const storedLead = {
    id: "70000000-0000-0000-0000-000000000061",
  };
  const { preparedLead, router } = createCompleteLeadRouter({
    markedLeadIds,
    saveLead: async (lead) => {
      receivedLead = lead;
      return { created: true, lead: storedLead };
    },
  });

  const result = await postChat(router, {
    message: "Please record my haircut enquiry",
    businessType: "barber",
    sessionId: "session-lead-1",
  });

  assert.deepEqual(receivedLead, {
    ...preparedLead,
    conversationId: "session-lead-1",
  });
  assert.deepEqual(markedLeadIds, [storedLead.id]);
  assert.deepEqual(result, {
    status: 200,
    body: {
      status: "success",
      reply:
        "Thanks, Alex Smith. Your enquiry has been recorded and the business will contact you to confirm availability. This is not a confirmed appointment.",
      sessionId: "session-lead-1",
    },
  });
});

test("duplicate leads use the stored ID and preserve the duplicate reply", async () => {
  const markedLeadIds = [];
  const duplicateLead = {
    id: "70000000-0000-0000-0000-000000000062",
  };
  const { router } = createCompleteLeadRouter({
    markedLeadIds,
    saveLead: async () => ({ created: false, lead: duplicateLead }),
  });

  const result = await postChat(router, {
    message: "Please record my haircut enquiry",
    businessType: "barber",
    sessionId: "session-lead-1",
  });

  assert.deepEqual(markedLeadIds, [duplicateLead.id]);
  assert.deepEqual(result, {
    status: 200,
    body: {
      status: "success",
      reply:
        "We already recorded this enquiry recently. The business will contact you to confirm availability; no appointment has been confirmed.",
      sessionId: "session-lead-1",
    },
  });
});

test("lead persistence failures use the controlled response", async () => {
  const markedLeadIds = [];
  const { router } = createCompleteLeadRouter({
    markedLeadIds,
    saveLead: async () => {
      throw new Error("sensitive PostgreSQL lead error");
    },
  });

  const result = await postChat(router, {
    message: "Please record my haircut enquiry",
    businessType: "barber",
    sessionId: "session-lead-1",
  });

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    status: "error",
    message: "The AI assistant is temporarily unavailable. Please try again.",
  });
  assert.equal(JSON.stringify(result.body).includes("sensitive PostgreSQL"), false);
  assert.deepEqual(markedLeadIds, []);
});

test("session persistence failures use the controlled response", async () => {
  const router = chatRouter.createChatRouter({
    openAIClient: { responses: {} },
    businesses: {
      normaliseBusinessType: (value) => value.trim().toLowerCase(),
      isBusinessConfigured: () => true,
      getBusinessData: async () => ({ businessType: "barber" }),
    },
    sessions: {
      getSession: async () => null,
      createSession: async () => ({
        id: "session-persistence-error",
        messages: [],
        leadFields: {},
      }),
      addMessage: async () => {
        throw new Error("sensitive session database detail");
      },
    },
  });

  const result = await postChat(router, {
    message: "Hello",
    businessType: "barber",
  });

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    status: "error",
    message: "The AI assistant is temporarily unavailable. Please try again.",
  });
  assert.equal(
    JSON.stringify(result.body).includes("sensitive session database detail"),
    false,
  );
});
