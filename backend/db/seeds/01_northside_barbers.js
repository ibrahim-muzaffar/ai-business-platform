const SEED_IDS = {
  organisation: "10000000-0000-0000-0000-000000000001",
  business: "10000000-0000-0000-0000-000000000011",
  services: [
    "10000000-0000-0000-0000-000000000021",
    "10000000-0000-0000-0000-000000000022",
    "10000000-0000-0000-0000-000000000023",
    "10000000-0000-0000-0000-000000000024",
    "10000000-0000-0000-0000-000000000025",
  ],
  openingHours: [
    "10000000-0000-0000-0000-000000000031",
    "10000000-0000-0000-0000-000000000032",
    "10000000-0000-0000-0000-000000000033",
    "10000000-0000-0000-0000-000000000034",
    "10000000-0000-0000-0000-000000000035",
    "10000000-0000-0000-0000-000000000036",
    "10000000-0000-0000-0000-000000000037",
  ],
  policies: [
    "10000000-0000-0000-0000-000000000041",
    "10000000-0000-0000-0000-000000000042",
    "10000000-0000-0000-0000-000000000043",
    "10000000-0000-0000-0000-000000000044",
  ],
};

const BUSINESS = {
  id: SEED_IDS.business,
  organisation_id: SEED_IDS.organisation,
  business_type: "barber",
  name: "Northside Barbers",
  description:
    "A friendly neighbourhood barber shop offering traditional cuts, modern styling and beard grooming for adults and children.",
  phone: "0161 496 0123",
  email: "hello@northsidebarbers.example",
  website: "https://northsidebarbers.example",
  address: {
    line1: "24 Market Street",
    city: "Manchester",
    postcode: "M1 1AB",
    country: "United Kingdom",
  },
  timezone: "Europe/London",
};

const SERVICES = [
  { name: "Classic haircut", price: "22.00" },
  { name: "Skin fade", price: "26.00" },
  { name: "Haircut and beard trim", price: "34.00" },
  { name: "Beard trim and shape-up", price: "14.00" },
  { name: "Children's haircut (under 12)", price: "17.00" },
].map((service, index) => ({
  id: SEED_IDS.services[index],
  business_id: SEED_IDS.business,
  ...service,
  description: null,
  duration_minutes: null,
  active: true,
}));

const OPENING_HOURS = [
  ["monday", "09:00:00", "18:00:00", false],
  ["tuesday", "09:00:00", "18:00:00", false],
  ["wednesday", "09:00:00", "18:00:00", false],
  ["thursday", "09:00:00", "20:00:00", false],
  ["friday", "09:00:00", "20:00:00", false],
  ["saturday", "08:30:00", "17:00:00", false],
  ["sunday", null, null, true],
].map(([dayOfWeek, openingTime, closingTime, closed], index) => ({
  id: SEED_IDS.openingHours[index],
  business_id: SEED_IDS.business,
  day_of_week: dayOfWeek,
  opening_time: openingTime,
  closing_time: closingTime,
  closed,
}));

const POLICIES = [
  {
    category: "walk_ins",
    title: "Walk-ins",
    content:
      "Walk-ins are welcome, but appointments are recommended on Fridays and Saturdays.",
  },
  {
    category: "cancellations",
    title: "Cancellations",
    content:
      "Please give at least 24 hours' notice when cancelling or rearranging an appointment.",
  },
  {
    category: "student_discount",
    title: "Student discount",
    content:
      "Students receive 10% off Monday to Thursday with valid student identification.",
  },
  {
    category: "payment_methods",
    title: "Payment methods",
    content:
      "Accepted payment methods: Cash, Visa, Mastercard, Contactless payments.",
  },
].map((policy, index) => ({
  id: SEED_IDS.policies[index],
  business_id: SEED_IDS.business,
  ...policy,
  active: true,
}));

async function upsertRows(trx, tableName, rows) {
  for (const row of rows) {
    await trx(tableName)
      .insert(row)
      .onConflict("id")
      .merge({ ...row, updated_at: trx.fn.now() });
  }
}

exports.seed = async function seed(knex) {
  await knex.transaction(async (trx) => {
    await trx("organisations")
      .insert({ id: SEED_IDS.organisation, name: "Northside Barbers" })
      .onConflict("id")
      .merge({ name: "Northside Barbers", updated_at: trx.fn.now() });

    await trx("businesses")
      .insert(BUSINESS)
      .onConflict("id")
      .merge({ ...BUSINESS, updated_at: trx.fn.now() });

    await upsertRows(trx, "services", SERVICES);
    await upsertRows(trx, "opening_hours", OPENING_HOURS);
    await upsertRows(trx, "policies", POLICIES);
  });
};

exports.SEED_IDS = SEED_IDS;
