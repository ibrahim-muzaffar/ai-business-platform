# AI Business OS — Modules

**Version:** 1.0

## 1. Modules versus channels

A **module** describes what the platform can do.

Examples:

- Answer business questions
- Capture a lead
- Manage a booking
- Follow up a customer
- Analyse a document

A **channel** describes where a request arrives.

Channels:

- Website
- Email
- WhatsApp
- Instagram
- Phone

The same module should work across multiple channels.

Example:

```text
Website message
        |
        v
Booking module
```

```text
WhatsApp message
        |
        v
Booking module
```

The booking logic is shared. Only the channel adapter changes.

## 2. Lifecycle labels

- **Current prototype:** Some working behaviour exists now.
- **Near-term:** Planned before the first barber MVP or immediately after it.
- **Later:** Planned after the core platform is stable.
- **Postponed:** Deliberately outside the initial product.

## 3. Conceptual module contract

Every module should eventually define:

```text
moduleKey
supportedIntents
requiredFields
availableActions
permissions
configuration
escalationRules
auditRequirements
```

A disabled module must not execute.

## 4. Module catalogue

### 4.1 Reception

**Status:** Current prototype, formalised in Phase 6

**Current prototype subset**

- Answers grounded barber questions
- Uses verified barber knowledge
- Uses recent session history
- Classifies requests as general or lead-related

**Planned full-module capabilities**

- Formal module selection
- Enabled-module configuration
- Booking routing
- Human escalation service
- Audit logging

**Purpose**

- Answer verified business questions
- Explain services, prices, hours, policies, and contact details
- Route requests to other modules
- Escalate when required

**Inputs**

- Customer message
- Business context
- Verified knowledge
- Conversation history
- Enabled modules

**Outputs**

- Grounded answer
- Selected next module
- Escalation request

**Dependencies**

- Business repository
- Conversation module
- Knowledge loading
- AI orchestration

**Actions**

- Answer from verified facts
- Ask clarifying questions
- Route to Lead Capture or Booking
- Escalate to a human

**Permissions**

- Public access to approved public business data only

**Audit**

- Normal answers need message logging
- Escalations require state logging

---

### 4.2 Lead Capture

**Status:** Current prototype, expanded in Phase 7

**Current prototype subset**

- Extracts, validates, and accumulates customer-provided lead details
- Creates a new lead or reuses a matching recent duplicate

**Planned full-module capabilities**

- Customer-module integration
- Database-backed workflow configuration
- Protected staff management
- Lead-change audit history
- Updating an existing stored lead

**Purpose**

- Detect lead intent
- Collect required customer details
- Validate and save leads
- Prevent duplicates

**Inputs**

- Conversation history
- Customer-provided details
- Workflow requirements
- Business context

**Outputs**

- Structured lead data
- Missing-field prompts
- Saved lead
- Duplicate or invalid result

**Dependencies**

- Lead repository
- Customer module
- Conversation module
- Workflow configuration

**Actions**

- Extract fields
- Validate fields
- The current prototype creates a new lead or reuses a matching recent duplicate. Updating an existing stored lead is planned.
- Mark completion

**Permissions**

- Public creation for configured businesses
- Protected management for authorised staff

**Audit**

- Lead creation and status changes must be recorded

---

### 4.3 Conversation

**Status:** Current prototype, persisted in Phase 2

**Current prototype storage and continuity**

- Session ID
- Business type
- Accumulated lead fields
- Recent user and assistant messages
- Completion state
- Saved lead ID
- Created and updated timestamps
- 30-minute inactivity expiry
- Frontend session-ID continuity

**Planned full-module capabilities**

- PostgreSQL persistence
- Channel metadata
- Customer linkage
- Staff assignment
- Conversation closure
- Human takeover
- Audit history

**Purpose**

- Maintain conversation context
- Store messages
- Track channel and state
- Support human takeover

**Inputs**

- Incoming message
- Business ID
- Customer identity
- Channel metadata

**Outputs**

- Conversation context
- Stored messages
- Conversation status

**Dependencies**

- Conversation repository
- Message repository
- Customer module

**Actions**

- Create conversation
- Append message
- Retrieve context
- Assign staff
- Close or escalate

**Permissions**

- Public creation through approved channels
- Protected reading for authorised staff

**Audit**

- Message and assignment history

---

### 4.4 Customer

**Status:** Near-term, Phase 2 foundation

**Purpose**

- Maintain a business-scoped customer record
- Link conversations, leads, and bookings
- Store safe preferences and contact details

**Inputs**

- Name
- Phone
- Email
- Channel identity
- Existing records

**Outputs**

- Matched or created customer
- Customer timeline

**Dependencies**

- Customer repository
- Normalisation and duplicate matching

**Actions**

- Create customer
- Update contact details
- Link interactions
- Merge only with controlled review

**Permissions**

- Protected owner and staff access
- Limited public write through validated workflows

**Audit**

- Sensitive record changes and merges

---

### 4.5 Human Escalation

**Status:** Near-term, formalised in Phase 6

**Purpose**

- Hand a conversation to staff
- Record why escalation occurred
- Prevent further automatic actions when required

**Inputs**

- Escalation reason
- Conversation
- Business rules
- Staff availability

**Outputs**

- Escalation state
- Assignment
- Customer-facing acknowledgement

**Dependencies**

- Conversation module
- CRM
- Notification integration

**Actions**

- Request takeover
- Assign staff
- Pause automation
- Resume automation when authorised

**Permissions**

- Public request
- Protected assignment and resolution

**Audit**

- Escalation reason, assignment, and resolution

---

### 4.6 CRM

**Status:** Near-term, Phase 7

**Purpose**

- Turn captured leads into manageable business work
- Track status, ownership, notes, and follow-up

**Inputs**

- Leads
- Customers
- Conversations
- Staff actions

**Outputs**

- Lead pipeline
- Follow-up queue
- Customer timeline
- Conversion status

**Dependencies**

- Lead, customer, and conversation repositories
- Authentication
- Tenant isolation

**Actions**

- Update status
- Assign staff
- Add notes
- Set follow-up
- Record conversion or loss

**Permissions**

- Owner, admin, and authorised staff

**Audit**

- All status, assignment, and note changes where appropriate

---

### 4.7 Booking

**Status:** Near-term, Phase 8

**Purpose**

- Check availability
- Create, move, and cancel real bookings
- Record provider-confirmed outcomes

**Inputs**

- Customer
- Service
- Date and time
- Business timezone
- Booking rules

**Outputs**

- Availability result
- Confirmed booking
- Confirmed change or cancellation
- Failure or escalation

**Dependencies**

- Booking repository
- Service repository
- Provider adapter
- Action logging

**Actions**

- Check availability
- Create booking
- Move booking
- Cancel booking
- Prepare reminders

**Permissions**

- Public request with validation
- Protected overrides for staff

**Audit**

- Every external booking action and result

---

### 4.8 Customer Service

**Status:** Later, Phase 14

**Purpose**

- Handle customer support questions and simple service workflows

**Inputs**

- Customer identity
- Order or booking data
- Policies
- Complaint details

**Outputs**

- Answer
- Return or support request
- Escalation

**Dependencies**

- CRM
- Order or booking integrations
- Knowledge
- Human escalation

**Actions**

- Track status
- Explain policy
- Collect complaint
- Initiate approved simple actions
- Escalate

**Permissions**

- Varies by action and data sensitivity

**Audit**

- Returns, refunds, complaints, and escalations

---

### 4.9 Sales

**Status:** Later, Phase 14

**Purpose**

- Qualify leads
- Follow up opportunities
- Draft quotes
- Schedule sales calls

**Inputs**

- Lead
- Customer history
- Pricing rules
- Conversation history

**Outputs**

- Qualification
- Follow-up draft
- Quote draft
- Recommended next action

**Dependencies**

- CRM
- Email or messaging channels
- Calendar
- Pricing rules

**Actions**

- Ask discovery questions
- Score urgency
- Draft and send approved quotes
- Schedule calls
- Follow up within opt-out rules

**Permissions**

- Owner-configured automation levels
- Approval for discounts and contractual promises

**Audit**

- Quotes, sends, discounts, and follow-up actions

---

### 4.10 Email

**Status:** Later, Phase 13

**Purpose**

- Add email as a communication channel and email-management capability

**Inputs**

- Email messages
- Attachments
- Customer identity
- Business policies

**Outputs**

- Classified message
- Draft reply
- Sent reply
- Extracted data
- Conversation record

**Dependencies**

- Email provider adapter
- Conversation module
- Customer module
- CRM

**Actions**

- Read eligible email
- Prioritise
- Draft
- Send under approval rules
- Archive permitted spam
- Extract attachments

**Permissions**

- Configurable draft-only or limited auto-send
- Sensitive categories require approval

**Audit**

- Read, draft, send, archive, and extraction actions

---

### 4.11 Social Media

**Status:** Later, Phase 14

**Purpose**

- Create and manage approved social content

**Inputs**

- Brand settings
- Services
- Offers
- Events
- Content history
- Engagement data

**Outputs**

- Captions
- Content calendar
- Scheduled post
- Comment reply
- Engagement insights

**Dependencies**

- Social provider adapters
- Business settings
- Analytics

**Actions**

- Draft content
- Schedule approved posts
- Reply to safe comments
- Analyse engagement

**Permissions**

- Approval rules for publishing
- Restricted account access

**Audit**

- Publishing, edits, and replies

---

### 4.12 Analytics

**Status:** Later, Phase 14

**Purpose**

- Measure platform and business outcomes

**Inputs**

- Leads
- Bookings
- Conversations
- Actions
- Channel data

**Outputs**

- Metrics
- Trends
- Alerts
- Recommendations

**Dependencies**

- Reliable persistent data
- Event definitions
- Tenant isolation

**Actions**

- Calculate metrics
- Detect patterns
- Surface missed follow-ups

**Permissions**

- Owner and authorised staff

**Audit**

- Metric definitions and data sources should be traceable

---

### 4.13 Review Management

**Status:** Later, Phase 14

**Purpose**

- Request and manage customer reviews responsibly

**Inputs**

- Completed customer event
- Customer consent and contact details
- Existing review data

**Outputs**

- Review request
- Draft response
- Escalation

**Dependencies**

- CRM
- Booking or order completion
- Review platform integration

**Actions**

- Request review
- Draft response
- Escalate sensitive review
- Track trend

**Permissions**

- Publishing approval rules

**Audit**

- Requests and published responses

---

### 4.14 Documents

**Status:** Later, Phase 15

**Purpose**

- Upload, search, summarise, compare, and cite documents

**Inputs**

- Documents
- User query
- Permissions

**Outputs**

- Summary
- Extracted clause
- Comparison
- Citation-backed answer

**Dependencies**

- Document storage
- Search and retrieval
- Permission model

**Actions**

- Ingest
- Chunk
- Search
- Compare
- Cite

**Permissions**

- Document-level and organisation-level access control

**Audit**

- Uploads, access, and sensitive queries

---

### 4.15 HR

**Status:** Later, Phase 15

**Purpose**

- Answer employee policy and process questions

**Inputs**

- Employee identity
- HR policies
- Entitlements
- Permissions

**Outputs**

- Policy answer
- Process guidance
- Escalation

**Dependencies**

- Documents
- User roles
- HR-system integration

**Actions**

- Explain policy
- Retrieve allowed balance or benefit information
- Route request

**Permissions**

- Strong employee-level access control

**Audit**

- Sensitive record access

---

### 4.16 Finance

**Status:** Later, Phase 15

**Purpose**

- Support invoice, expense, and reporting workflows

**Inputs**

- Invoices
- Expenses
- Financial records
- Permissions

**Outputs**

- Extracted data
- Categorisation
- Report
- Follow-up draft

**Dependencies**

- Documents
- Finance provider integration
- Strong permissions

**Actions**

- Extract invoice fields
- Categorise expense
- Generate report
- Draft unpaid-invoice follow-up

**Permissions**

- Restricted finance roles
- Approval for external sends or financial actions

**Audit**

- All financial access and actions

---

### 4.17 Recruiting

**Status:** Later, Phase 15

**Purpose**

- Support structured recruitment workflows

**Inputs**

- Job opening
- Candidate application
- CV
- Interview availability

**Outputs**

- Extracted candidate information
- Structured comparison
- Interview schedule
- Applicant response

**Dependencies**

- Documents
- Calendar
- Email
- Fairness controls

**Actions**

- Extract
- Compare using approved criteria
- Schedule
- Respond

**Permissions**

- Restricted recruiting roles

**Audit**

- Candidate access, comparisons, and decisions

**Guardrail**

The system must not make unreviewed discriminatory or fully autonomous hiring decisions.

---

### 4.18 Research

**Status:** Later, Phase 16

**Purpose**

- Produce source-backed business research

**Inputs**

- Research question
- Approved sources
- Scope and freshness requirements

**Outputs**

- Findings
- Sources
- Comparison
- Report

**Dependencies**

- Web search
- Source tracking
- Data-quality checks

**Actions**

- Search
- Extract
- Compare
- Summarise
- Monitor

**Permissions**

- Approved source and scope rules

**Audit**

- Queries, sources, and generated reports

---

### 4.19 Website Worker

**Status:** Later, Phase 16

**Purpose**

- Collect structured information from approved websites

**Inputs**

- Approved domains
- Extraction task
- Output schema

**Outputs**

- Structured dataset
- Spreadsheet
- Report
- Change alert

**Dependencies**

- Research module
- Browser automation where necessary
- Rate limiting

**Actions**

- Visit
- Extract
- Compare
- Export
- Monitor

**Permissions**

- Domain allowlist and task boundaries

**Audit**

- Sites visited, data collected, and files produced

---

### 4.20 Voice

**Status:** Later, Phase 13

**Purpose**

- Add phone and realtime voice as a channel

**Inputs**

- Call audio
- Caller identity where available
- Business context
- Conversation context

**Outputs**

- Voice response
- Lead
- Booking
- Transfer
- Call summary

**Dependencies**

- Phone provider
- Realtime voice or speech services
- Conversation and booking modules

**Actions**

- Answer
- Ask
- Capture
- Book
- Transfer
- Summarise

**Permissions**

- Business-configured call and action permissions

**Audit**

- Call metadata, summaries, transfers, and external actions

---

### 4.21 Computer Use

**Status:** Later, Phase 16

**Purpose**

- Operate approved interfaces when APIs are unavailable

**Inputs**

- Approved task
- Domain or application allowlist
- Credentials reference
- Approval rules

**Outputs**

- Completed action
- Screenshot
- Downloaded or uploaded file
- Failure report

**Dependencies**

- Browser or desktop automation
- Secret management
- Audit logging
- Approval service

**Actions**

- Click
- Type
- Navigate
- Upload
- Download
- Transfer data

**Permissions**

- Strict allowlists
- Approval before irreversible actions

**Audit**

- Screenshots, steps, outcomes, and failures

---

### 4.22 Executive Assistant

**Status:** Postponed, Phase 17

**Purpose**

- Prepare executives using calendar, email, documents, and task context

**Dependencies**

- Mature permissions
- Email
- Calendar
- Documents
- Research
- Audit logging

---

### 4.23 Personal Assistant

**Status:** Postponed, Phase 17

**Purpose**

- Support reminders, bookings, travel research, bills, and personal tasks

**Dependencies**

- Broader personal permissions and integrations

---

### 4.24 Trading Research

**Status:** Postponed, Phase 17

**Purpose**

- Summarise news, earnings, portfolio information, alerts, and risk

**Guardrail**

Autonomous financial trading is not part of the initial product.
