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

function mapCustomer(row) {
  if (!row) return null;

  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    preferences: row.preferences,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLead(row) {
  if (!row) return null;

  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    serviceId: row.service_id,
    conversationId: row.conversation_id,
    sourceChannel: row.source_channel,
    enquiryType: row.enquiry_type,
    status: row.status,
    requestedService: row.requested_service,
    requestedDate: row.requested_date,
    requestedTime: row.requested_time,
    requestedDateText: row.requested_date_text,
    requestedTimeText: row.requested_time_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConversation(row) {
  if (!row) return null;

  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    channel: row.channel,
    status: row.status,
    startedAt: row.started_at,
    lastMessageAt: row.last_message_at,
    closedAt: row.closed_at,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row) {
  if (!row) return null;

  return {
    id: row.id,
    businessId: row.business_id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    content: row.content,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    normalisedEmail: row.normalised_email,
    displayName: row.display_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrganisation(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    subscriptionStatus: row.subscription_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuthenticationRecord(row) {
  if (!row) return null;

  return {
    ...mapUser(row),
    passwordHash: row.password_hash,
  };
}

function mapOrganisationMembership(row) {
  if (!row) return null;

  return {
    id: row.id,
    organisationId: row.organisation_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  mapAuthenticationRecord,
  mapBusiness,
  mapConversation,
  mapCustomer,
  mapLead,
  mapMessage,
  mapOpeningHours,
  mapOrganisation,
  mapOrganisationMembership,
  mapPolicy,
  mapService,
  mapUser,
};
