const { mapOpeningHours } = require("./mappers");

const CALENDAR_ORDER = `CASE day_of_week
  WHEN 'monday' THEN 1
  WHEN 'tuesday' THEN 2
  WHEN 'wednesday' THEN 3
  WHEN 'thursday' THEN 4
  WHEN 'friday' THEN 5
  WHEN 'saturday' THEN 6
  WHEN 'sunday' THEN 7
END`;

function createOpeningHoursRepository(db) {
  async function listByBusinessId(businessId) {
    const rows = await db("opening_hours")
      .where({ business_id: businessId })
      .orderByRaw(CALENDAR_ORDER);
    return rows.map(mapOpeningHours);
  }

  return { listByBusinessId };
}

module.exports = { createOpeningHoursRepository };
