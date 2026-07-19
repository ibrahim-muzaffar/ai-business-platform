const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createConversationSessionRepository,
} = require("../repositories/conversationSessionRepository");

function makeRepository(options = {}) {
  let currentTime = new Date("2026-07-19T12:00:00.000Z");
  let id = 0;
  const repository = createConversationSessionRepository({
    idFactory: () => `session-${++id}`,
    now: () => currentTime,
    ...options,
  });

  return {
    repository,
    setTime(value) {
      currentTime = new Date(value);
    },
  };
}

test("creates and retrieves a session for the same business", () => {
  const { repository } = makeRepository();
  const created = repository.createSession("barber");
  const retrieved = repository.getSession(created.id, "barber");

  assert.equal(created.id, "session-1");
  assert.equal(retrieved, created);
  assert.equal(retrieved.businessType, "barber");
  assert.deepEqual(retrieved.leadFields, {});
  assert.deepEqual(retrieved.messages, []);
});

test("merges fields across messages and preserves valid existing values", () => {
  const { repository } = makeRepository();
  const session = repository.createSession("barber");

  repository.mergeLeadFields(session.id, {
    name: "Aisha Khan",
    phone: "07700 900123",
  });
  repository.mergeLeadFields(session.id, {
    name: null,
    phone: "not sure",
    service: "Skin fade",
    preferredDate: "",
  });

  assert.deepEqual(session.leadFields, {
    name: "Aisha Khan",
    phone: "07700 900123",
    service: "Skin fade",
  });
});

test("completed sessions cannot be completed a second time", () => {
  const { repository } = makeRepository();
  const session = repository.createSession("barber");

  assert.equal(repository.markCompleted(session.id, "lead-1"), true);
  assert.equal(repository.markCompleted(session.id, "lead-2"), false);
  assert.equal(session.completed, true);
  assert.equal(session.leadId, "lead-1");
});

test("expires inactive sessions after thirty minutes", () => {
  const { repository, setTime } = makeRepository();
  const session = repository.createSession("barber");

  setTime("2026-07-19T12:31:00.000Z");
  assert.equal(repository.getSession(session.id, "barber"), null);
});

test("keeps different sessions and business types isolated", () => {
  const { repository } = makeRepository();
  const barber = repository.createSession("barber");
  const dentist = repository.createSession("dentist");

  repository.mergeLeadFields(barber.id, { name: "Aisha Khan" });
  repository.mergeLeadFields(dentist.id, { name: "Daniel Jones" });

  assert.equal(repository.getSession(barber.id, "dentist"), null);
  assert.deepEqual(barber.leadFields, { name: "Aisha Khan" });
  assert.deepEqual(dentist.leadFields, { name: "Daniel Jones" });
});

test("keeps only the configured number of recent messages", () => {
  const { repository } = makeRepository({ maxMessages: 3 });
  const session = repository.createSession("barber");

  for (let index = 1; index <= 5; index += 1) {
    repository.addMessage(session.id, {
      role: index % 2 ? "user" : "assistant",
      text: `message ${index}`,
    });
  }

  assert.deepEqual(
    session.messages.map((message) => message.text),
    ["message 3", "message 4", "message 5"],
  );
});
