const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_LEADS_FILE = path.join(__dirname, "../data/leads.json");
const DEFAULT_DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

function comparableLead(lead) {
  return {
    name: lead.name.toLowerCase(),
    phone: lead.phone.replace(/\D/g, ""),
    service: lead.service.toLowerCase(),
    preferredDate: lead.preferredDate.toLowerCase(),
    preferredTime: lead.preferredTime.toLowerCase(),
  };
}

function leadsMatch(first, second) {
  const firstComparable = comparableLead(first);
  const secondComparable = comparableLead(second);

  return Object.keys(firstComparable).every(
    (key) => firstComparable[key] === secondComparable[key],
  );
}

function createLeadRepository({
  filePath = DEFAULT_LEADS_FILE,
  duplicateWindowMs = DEFAULT_DUPLICATE_WINDOW_MS,
} = {}) {
  // Serialise mutations in this process so concurrent requests cannot overwrite
  // one another between reading and atomically replacing the JSON file.
  let writeQueue = Promise.resolve();

  async function ensureLeadFile() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
      // Exclusive creation prevents simultaneous initialisers from replacing a
      // file that another request has already created.
      await fs.writeFile(filePath, "[]\n", { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }

  async function getAllLeads() {
    await ensureLeadFile();

    const fileContents = await fs.readFile(filePath, "utf8");
    const leads = JSON.parse(fileContents);

    if (!Array.isArray(leads)) {
      throw new Error("Lead data must contain a JSON array.");
    }

    return leads;
  }

  async function saveLead(lead) {
    const saveOperation = writeQueue.then(async () => {
      const leads = await getAllLeads();
      const duplicateCutoff = Date.now() - duplicateWindowMs;
      const duplicate = leads.find((existingLead) => {
        const createdAt = Date.parse(existingLead.createdAt);
        return createdAt >= duplicateCutoff && leadsMatch(existingLead, lead);
      });

      if (duplicate) {
        return { created: false, lead: duplicate };
      }

      const updatedLeads = [...leads, lead];
      const temporaryFile = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

      try {
        await fs.writeFile(
          temporaryFile,
          `${JSON.stringify(updatedLeads, null, 2)}\n`,
          "utf8",
        );
        await fs.rename(temporaryFile, filePath);
      } catch (error) {
        await fs.rm(temporaryFile, { force: true });
        throw error;
      }

      return { created: true, lead };
    });

    // Keep the queue usable after a failed write while returning the failure to
    // the request that triggered it.
    writeQueue = saveOperation.then(
      () => undefined,
      () => undefined,
    );

    return saveOperation;
  }

  return { getAllLeads, saveLead };
}

const defaultRepository = createLeadRepository();

module.exports = {
  createLeadRepository,
  getAllLeads: defaultRepository.getAllLeads,
  saveLead: defaultRepository.saveLead,
};
