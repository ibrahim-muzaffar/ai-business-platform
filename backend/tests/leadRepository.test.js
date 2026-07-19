const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createLeadRepository,
} = require("../repositories/leadRepository");

function makeLead(overrides = {}) {
  return {
    id: "lead-1",
    name: "Aisha Khan",
    phone: "07700 900123",
    service: "Skin fade",
    preferredDate: "22 July 2026",
    preferredTime: "2:30 pm",
    businessType: "barber",
    createdAt: new Date().toISOString(),
    status: "new",
    ...overrides,
  };
}

test("getAllLeads creates a missing directory and initialises the file", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lead-missing-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));

  const filePath = path.join(directory, "nested", "data", "leads.json");
  const repository = createLeadRepository({ filePath });

  await assert.rejects(fs.access(filePath), { code: "ENOENT" });
  assert.deepEqual(await repository.getAllLeads(), []);
  assert.deepEqual(JSON.parse(await fs.readFile(filePath, "utf8")), []);
});

test("concurrent saves preserve both leads", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lead-repository-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));

  const filePath = path.join(directory, "leads.json");
  const repository = createLeadRepository({ filePath });

  await Promise.all([
    repository.saveLead(makeLead()),
    repository.saveLead(
      makeLead({
        id: "lead-2",
        name: "Daniel Jones",
        phone: "07700 900456",
      }),
    ),
  ]);

  const leads = await repository.getAllLeads();
  assert.equal(leads.length, 2);
  assert.deepEqual(
    leads.map((lead) => lead.id).sort(),
    ["lead-1", "lead-2"],
  );
});

test("the same recent enquiry is not written twice", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lead-duplicate-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));

  const repository = createLeadRepository({
    filePath: path.join(directory, "leads.json"),
    duplicateWindowMs: 5 * 60 * 1000,
  });
  const first = await repository.saveLead(makeLead());
  const duplicate = await repository.saveLead(
    makeLead({ id: "lead-duplicate" }),
  );

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.lead.id, "lead-1");
  assert.equal((await repository.getAllLeads()).length, 1);
});
