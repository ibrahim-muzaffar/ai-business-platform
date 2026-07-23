# AI Business OS — Conceptual Data Model

**Version:** 1.0  
**Status:** Conceptual model only; not a final SQL schema

## 1. Design principles

1. Every protected record is tenant-scoped.
2. Organisations own users and businesses.
3. Businesses own operational data.
4. Conversations and messages are channel-independent.
5. External provider IDs are stored separately from internal IDs.
6. Auditable actions are recorded.
7. JSON and in-memory prototype storage are temporary.
8. Final SQL migrations are designed during Phase 2.

## 2. Initial PostgreSQL scope

### 2.1 Organisation

**Purpose:** Represents the paying account or company.

**Proposed fields**

- `id`
- `name`
- `subscriptionStatus`
- `createdAt`
- `updatedAt`

**Relationships**

- Has many organisation memberships
- Has many users through memberships
- Has many businesses
- Has many action logs

**Tenant ownership:** Root tenant entity

**Important constraints**

- Name required
- Subscription status uses a controlled set of values

**Status:** Phase 2

---

### 2.2 User

**Purpose:** Represents a person who can access the platform.

**Proposed fields**

- `id`
- `name`
- `email`
- `authenticationIdentity`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to organisations through memberships
- May be assigned leads, conversations, or actions

**Tenant ownership:** Indirect through memberships

**Important constraints**

- Normalised unique email where appropriate
- Authentication identity linked to the chosen auth provider

**Status:** Phase 3

---

### 2.3 OrganisationMembership

**Purpose:** Links a user to an organisation and defines their role.

**Proposed fields**

- `organisationId`
- `userId`
- `role`
- `status`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one organisation
- Belongs to one user

**Tenant ownership:** Organisation

**Important constraints**

- Unique pair of organisation and user
- Controlled roles: owner, admin, staff, viewer
- Controlled membership status

**Status:** Phase 3

---

### 2.4 Business

**Purpose:** Represents an operating business, location, or brand using the platform.

**Proposed fields**

- `id`
- `organisationId`
- `businessType`
- `name`
- `description`
- `phone`
- `email`
- `website`
- `address`
- `timezone`
- `status`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one organisation
- Has many services
- Has many opening hours
- Has many policies
- Has many customers
- Has many leads
- Has many conversations
- Has many bookings
- Has many modules
- Has many integrations

**Tenant ownership:** Organisation

**Important constraints**

- Organisation ID required
- Timezone required before real booking
- Business type uses a controlled identifier

**Status:** Phase 2

---

### 2.5 Service

**Purpose:** Defines a service offered by a business.

**Proposed fields**

- `id`
- `businessId`
- `name`
- `description`
- `price`
- `duration`
- `active`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one business
- Referenced by leads and bookings

**Tenant ownership:** Business

**Important constraints**

- Price stored in a safe numeric representation
- Duration stored consistently
- Inactive services are not offered for new bookings

**Status:** Phase 2

---

### 2.6 OpeningHour

**Purpose:** Stores normal opening hours.

**Proposed fields**

- `id`
- `businessId`
- `dayOfWeek`
- `openingTime`
- `closingTime`
- `closed`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one business

**Tenant ownership:** Business

**Important constraints**

- One or more periods may be required per day later
- Timezone comes from the business
- Closed days cannot contain active opening periods

**Status:** Phase 2

---

### 2.7 Policy

**Purpose:** Stores verified business rules and customer-facing policies.

**Proposed fields**

- `id`
- `businessId`
- `category`
- `title`
- `content`
- `active`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one business

**Tenant ownership:** Business

**Important constraints**

- Category uses a controlled or documented value
- Only active policies are used for current responses

**Status:** Phase 2

---

### 2.8 Customer

**Purpose:** Represents a customer known to a business.

**Proposed fields**

- `id`
- `businessId`
- `name`
- `phone`
- `email`
- `preferences`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one business
- Has many leads
- Has many conversations
- Has many bookings

**Tenant ownership:** Business

**Important constraints**

- Duplicate matching must be conservative
- Email and phone should be normalised
- Personally identifiable information must be protected

**Status:** Phase 2

---

### 2.9 Lead

**Purpose:** Represents a potential customer opportunity.

**Proposed fields**

- `id`
- `businessId`
- `customerId`
- `conversationId`
- `sourceChannel`
- `enquiryType`
- `status`
- `requestedService`
- `requestedDate`
- `requestedTime`
- `requestedDateText`
- `requestedTimeText`
- `assignedUserId`
- `followUpAt`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one business
- May belong to one customer
- May originate from one conversation
- May be assigned to one user

**Tenant ownership:** Business

**Important constraints**

- Status uses controlled values
- Duplicate prevention should consider business, customer identity, enquiry type, and time window
- Dates and times require timezone-aware interpretation
- Raw requested date and time text preserves the customer's original preference; `requestedDate` and `requestedTime` hold parsed structured values and may remain null until timezone-aware interpretation is safe for booking use

**Status:** Phase 2 with CRM extensions in Phase 7

---

### 2.10 Conversation

**Purpose:** Represents a customer interaction across one channel.

**Proposed fields**

- `id`
- `businessId`
- `customerId`
- `channel`
- `externalThreadId`
- `status`
- `assignedUserId`
- `startedAt`
- `updatedAt`

**Relationships**

- Belongs to one business
- May belong to one customer
- Has many messages
- May produce leads or bookings
- May be assigned to a user

**Tenant ownership:** Business

**Important constraints**

- External thread IDs are unique within the relevant provider and business
- Channel uses a controlled identifier
- Status supports human takeover and closure

**Status:** Phase 2

---

### 2.11 Message

**Purpose:** Stores an individual message within a conversation.

**Proposed fields**

- `id`
- `conversationId`
- `senderType`
- `content`
- `externalMessageId`
- `createdAt`

**Relationships**

- Belongs to one conversation

**Tenant ownership:** Inherited through conversation

**Important constraints**

- Sender type uses a controlled value
- External message IDs help prevent duplicate ingestion
- Content retention rules will be defined before production

**Status:** Phase 2

---

### 2.12 Workflow

**Purpose:** Defines configurable data collection and action rules.

**Proposed fields**

- `id`
- `businessId` or `businessType`
- `name`
- `intent`
- `requiredFields`
- `rules`
- `enabled`
- `createdAt`
- `updatedAt`

**Relationships**

- May apply to one business or one business type
- Used by modules and orchestration

**Tenant ownership:** Business-specific workflows are tenant-owned; business-type templates are platform-owned

**Important constraints**

- Business-specific rules override templates only in controlled ways
- Required fields and rules must be validated

**Status:** Phase 2 foundation; formal use in Phase 6

---

### 2.13 BusinessModule

**Purpose:** Enables and configures modules for a business.

**Proposed fields**

- `businessId`
- `moduleKey`
- `enabled`
- `configuration`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one business
- Refers to one platform module key

**Tenant ownership:** Business

**Important constraints**

- Unique pair of business and module key
- Disabled modules cannot execute
- Configuration must be schema-validated

**Status:** Phase 2 foundation; formal use in Phase 6

---

### 2.14 Booking

**Purpose:** Represents a real appointment or reservation.

**Proposed fields**

- `id`
- `businessId`
- `customerId`
- `conversationId`
- `serviceId`
- `provider`
- `externalBookingId`
- `startTime`
- `endTime`
- `status`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one business
- Belongs to one customer
- May originate from one conversation
- May reference one service
- May map to one external provider record

**Tenant ownership:** Business

**Important constraints**

- Provider success is required before confirmed status
- External booking ID is unique within provider and business
- Times are stored timezone-aware
- Changes and cancellations are auditable

**Status:** Phase 8

---

### 2.15 Integration

**Purpose:** Represents a configured external provider connection.

**Proposed fields**

- `id`
- `businessId`
- `provider`
- `integrationType`
- `status`
- `configurationReference`
- `createdAt`
- `updatedAt`

**Relationships**

- Belongs to one business
- Used by booking, email, social, and other adapters

**Tenant ownership:** Business

**Important constraints**

- Secrets must not be stored directly in general application fields
- Configuration references secure secret storage
- Status reflects health and authorisation state

**Status:** Introduced as needed from Phase 8 onward

---

### 2.16 ActionLog

**Purpose:** Audits important user, AI, and integration actions.

**Proposed fields**

- `id`
- `organisationId`
- `businessId`
- `userId`
- `conversationId`
- `actionType`
- `targetType`
- `targetId`
- `status`
- `metadata`
- `createdAt`

**Relationships**

- Belongs to an organisation
- May belong to a business
- May reference a user, conversation, or target record

**Tenant ownership:** Organisation and business

**Important constraints**

- Append-only where practical
- Metadata must avoid unnecessary secrets
- Action status uses controlled values

**Status:** Foundation during booking and production-readiness phases

## 3. Tenant scoping

Every repository query for protected data must include tenant context.

Preferred model:

```text
Organisation
    |
    +-- Users through memberships
    |
    +-- Businesses
            |
            +-- Customers
            +-- Leads
            +-- Conversations
            +-- Bookings
            +-- Settings
            +-- Integrations
```

Public chat may read only approved public business data.

## 4. Duplicate prevention

Duplicate prevention should be implemented at more than one layer:

- Input normalisation
- Domain validation
- Repository checks
- Database unique constraints where appropriate
- External provider IDs
- Idempotency keys for actions

Not every duplicate can be prevented with one global unique constraint. Rules must reflect the entity and business context.

## 5. Timestamps and timezones

- Store timestamps in a consistent timezone-aware format.
- Store each business timezone explicitly.
- Interpret requested dates and times in the business timezone.
- Preserve external provider timestamps where necessary.
- Avoid relying on server-local time.

## 6. Soft deletion and retention

Soft deletion may be appropriate for:

- Businesses
- Services
- Policies
- Customers
- Integrations

Audit logs and confirmed bookings may require stronger retention.

Production retention rules must cover:

- Customer messages
- Personally identifiable information
- Documents
- Call recordings
- Action logs
- Data export
- Data deletion

## 7. Personally identifiable information

Potentially sensitive fields include:

- Name
- Phone
- Email
- Address
- Conversation content
- Booking details
- Uploaded documents

Requirements before production:

- Access control
- Tenant isolation
- Data minimisation
- Retention rules
- Secure transport
- Secure secret storage
- Auditability
- Export and deletion support

## 8. Later data-model additions

These are not part of the initial Phase 2 PostgreSQL scope.

### Documents

- Document
- DocumentVersion
- DocumentChunk
- DocumentPermission
- DocumentCitation

### Finance

- Invoice
- Expense
- PaymentReminder
- FinancialReport

### Recruiting

- Candidate
- JobOpening
- Application
- Interview

### Social and reviews

- SocialPost
- Campaign
- Review
- ReviewRequest

### Research and automation

- ResearchJob
- ResearchSource
- AutomationRun
- BrowserAction

### Voice

- VoiceCall
- CallTranscript
- CallSummary
