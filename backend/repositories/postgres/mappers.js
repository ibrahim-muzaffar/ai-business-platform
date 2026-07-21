function mapBusiness(row) {
  if (!row) return null;

  return {
    id: row.id,
    organisationId: row.organisation_id,
    businessType: row.business_type,
    name: row.name,
    description: row.description,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
    timezone: row.timezone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapService(row) {
  if (!row) return null;

  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    price: row.price,
    durationMinutes: row.duration_minutes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOpeningHours(row) {
  if (!row) return null;

  return {
    id: row.id,
    businessId: row.business_id,
    dayOfWeek: row.day_of_week,
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    closed: row.closed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPolicy(row) {
  if (!row) return null;

  return {
    id: row.id,
    businessId: row.business_id,
    category: row.category,
    title: row.title,
    content: row.content,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  mapBusiness,
  mapOpeningHours,
  mapPolicy,
  mapService,
};
