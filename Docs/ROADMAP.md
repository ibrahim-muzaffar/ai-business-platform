# AI Business OS — Roadmap

**Version:** 1.0  
**Locked planning date:** July 2026  
**Planning baseline:** Approximately 15 focused development hours per week  
**Execution rule:** Complete phases sequentially. Do not overlap phases merely to preserve dates.

## 1. Product vision

The product is one **multi-tenant AI Business Operating System**.

It is not a set of unrelated chatbots. AI Receptionist, AI Sales Agent, AI Email Assistant, AI Appointment Manager, AI Customer Service Agent, and later AI workers are reusable modules inside one shared platform.

```text
Customers and staff
        |
        v
Communication channels
Website | Email | WhatsApp | Instagram | Phone
        |
        v
AI orchestration
Intent | Context | Knowledge | Module selection | Tool selection
        |
        v
Reusable business modules
Reception | Leads | CRM | Booking | Sales | Support | Documents
        |
        v
Shared platform
Organisations | Businesses | Users | Customers | Conversations | Permissions
        |
        v
Repositories and domain services
        |
        v
Storage and integrations
PostgreSQL | Calendars | Email | Booking systems | Payments | Social platforms
```

The barber is the first complete vertical slice. Other industries are added later through business data, workflows, enabled modules, required fields, permissions, and integrations.

## 2. Locked product rules

1. Build one shared platform and one shared AI engine.
2. Treat industries as configuration, not separate applications.
3. Keep modules separate from communication channels.
4. Keep routes thin and place business logic in services and modules.
5. Use repositories to isolate storage and provider implementations.
6. Require confirmed tool success before reporting external actions as complete.
7. Enforce tenant isolation in the backend and database.
8. Prefer official APIs over browser or desktop automation.
9. Complete one phase before starting the next.
10. Put new ideas in the backlog instead of interrupting the active phase.

## 3. Current project status

### 3.1 Implemented

The current prototype is expected to include the following. Repository verification must confirm the exact details.

#### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- One public landing/demo page
- Navigation
- Hero section
- Services presentation
- Why-choose-us content
- Business demo cards inside the main page
- Chatbot interface
- Barber live-AI demo
- Unsupported-business safety messaging
- Frontend conversation session state
- Nullable session-ID handling
- Frontend lint, TypeScript, and production-build checks

#### Backend

- Express
- OpenAI Responses API integration
- Environment-variable protection
- Verified barber business data
- Business repository
- Grounded barber responses
- Structured lead extraction
- Independent backend validation
- Lead repository
- Duplicate prevention
- Multi-message conversation sessions
- Business and session isolation
- Configured-business registry
- Unsupported-business guard
- Offline automated tests

#### Configured-business rule

**Barber**

- Live AI enabled
- Verified business knowledge enabled
- Lead capture enabled
- Conversation sessions enabled

**Unsupported demo businesses**

- Do not call OpenAI
- Do not load barber data
- Do not create sessions
- Do not save leads
- Return an honest not-configured response

### 3.2 Partial or unfinished frontend work

These items must not be described as complete:

- The About area is currently absent.
- The Contact area and enquiry system are currently absent. Existing Contact links target `#contact`, but no matching section currently exists.
- The footer is currently absent.
- Business demos are part of the main landing page, not separate finished demo pages.
- Final navigation and page structure are not locked.
- Login and dashboard links are not implemented.
- Legal pages are not implemented.
- Final SEO, accessibility, analytics, and production optimisation are not complete.

These are deliberately completed in **Phase 9**.

### 3.3 Temporary infrastructure

- Business data stored in JSON
- Leads stored in JSON
- Conversation sessions stored in server memory
- No PostgreSQL database
- No authentication
- No permanent tenant model
- No owner dashboard
- No editable business settings
- No real booking provider
- Only the barber has verified backend configuration

## 4. Current phase

**Phase 1 — Architecture documentation**

Phase 0 must be considered complete only when its code is manually tested, automated checks pass, and the milestone is committed and pushed.

## 5. Locked phase order

### Phase 0 — Close the prototype

**Status:** Complete or nearly complete; verify in Git  
**Duration:** One focused session

Includes:

- OpenAI integration
- Barber business knowledge
- Lead capture
- Multi-message sessions
- Duplicate prevention
- Configured-business guard
- Nullable frontend session handling
- Automated tests

**Completion gate**

- Barber answers from verified information.
- Barber remembers details over multiple messages.
- One lead is created without duplicates.
- Unsupported businesses display the safe response.
- Unsupported businesses create no sessions or leads.
- Backend tests pass.
- Frontend lint and build pass.
- Work is committed and pushed.

---

### Phase 1 — Architecture documentation

**Duration:** 2–3 focused days  
**Initial target:** Approximately 22 July 2026

Deliverables:

- `Docs/ROADMAP.md`
- `Docs/ARCHITECTURE.md`
- `Docs/DATA_MODEL.md`
- `Docs/MODULES.md`
- `Docs/DECISIONS.md`

**Website rule:** Frozen except for defects that block development or testing.

**Completion gate**

- All five documents contain meaningful content.
- Current and planned architecture are clearly separated.
- Phase order is consistent across documents.
- No application code is changed.
- Documentation is reviewed, committed, and pushed.

---

### Phase 2 — PostgreSQL data foundation

**Duration:** Approximately 2 weeks  
**Initial target:** 23 July–5 August 2026

Build:

1. Database connection and migration system
2. Organisations and businesses
3. Services, opening hours, and policies
4. Customers and leads
5. Conversations and messages
6. Workflow and module configuration
7. PostgreSQL repository implementations
8. Barber seed data
9. Removal of runtime dependence on JSON and in-memory storage

**Completion gate**

- Business information survives restart.
- Leads survive restart.
- Conversations and messages survive restart.
- Existing barber behaviour remains working.
- Repository and database integration tests pass.
- Routes contain no raw database logic.

**Website rule:** Frozen except for defects.

---

### Phase 3 — Authentication and tenant isolation

**Duration:** 1–2 weeks  
**Initial target:** 6–16 August 2026

Build:

- Owner registration
- Login and logout
- Password reset
- Protected routes
- Organisation membership
- User roles
- Business ownership
- Backend authorisation
- Database tenant isolation

Initial roles:

- Owner
- Admin
- Staff
- Viewer

**Completion gate**

- Unauthenticated dashboard access is rejected.
- Owner A cannot access Business B.
- Protected APIs enforce organisation scope.
- Public chat exposes only approved public information.
- Cross-tenant security tests pass.

---

### Phase 4 — Read-only owner dashboard

**Duration:** 1–2 weeks  
**Initial target:** 17–28 August 2026

Initial sections:

- Overview
- Leads
- Conversations
- Customers
- Business
- Settings

Initial capabilities:

- View new leads
- View recent enquiries
- View conversation history
- View customer details
- View lead source
- View requested service, date, and time
- View lead status
- View basic totals

**Completion gate**

- A website enquiry appears in the correct owner dashboard.
- Messages appear in order.
- Dashboard data is tenant-isolated.
- Loading, empty, and error states work.
- Dashboard does not read JSON files directly.

---

### Phase 5 — Business settings and knowledge editor

**Duration:** Approximately 1 week  
**Initial target:** 29 August–6 September 2026

Owners can edit:

- Business details
- Contact details
- Opening hours
- Services
- Prices
- Policies
- FAQs
- AI tone
- Escalation instructions
- Booking rules

**Completion gate**

- Updating a price changes the next AI answer.
- Updating opening hours changes the next AI answer.
- No source-code or JSON edits are required.
- Unknown facts produce safe responses.

---

### Phase 6 — Formal module framework

**Duration:** Approximately 1 week  
**Initial target:** 7–14 September 2026

Initial modules:

- Reception
- Lead Capture
- Conversation
- Customer
- Human Escalation

Each module defines:

- Module key
- Purpose
- Supported intents
- Required data
- Available actions
- Permissions
- Configuration
- Escalation rules
- Audit requirements

**Completion gate**

- Modules have explicit boundaries.
- Modules can be enabled or disabled per business.
- Disabled modules cannot execute.
- Chat routes remain thin.
- Core business logic is not concentrated in one route.

---

### Phase 7 — CRM and lead management

**Duration:** 1–2 weeks  
**Initial target:** 15–25 September 2026

Build:

- Lead statuses
- Owner notes
- Staff assignment
- Follow-up dates
- Search and filters
- Customer timeline
- Lead history
- Source tracking
- Conversion tracking
- Human takeover

Initial lead statuses:

- New
- Contacted
- Qualified
- Converted
- Lost

**Completion gate**

- Owner can review, assign, annotate, and update a lead.
- Follow-up dates can be set.
- Status changes are recorded.
- Conversations and customers are linked correctly.

---

### Phase 8 — Booking and appointment management

**Duration:** Approximately 2 weeks  
**Initial target:** 26 September–10 October 2026

Capabilities:

- Collect booking requirements
- Validate requests
- Check real availability
- Create bookings
- Move bookings
- Cancel bookings
- Record outcomes
- Prepare reminders
- Escalate failures

Start with one provider only:

- Internal booking calendar, or
- Google Calendar, or
- One external booking provider

**Completion gate**

- AI cannot invent availability.
- AI cannot confirm before provider success.
- Moves and cancellations are auditable.
- Timezone handling is correct.
- Failed actions produce safe responses and escalation options.

---

### Phase 9 — Production readiness, website completion, and barber launch

**Duration:** 1–2 weeks  
**Initial target:** 11–25 October 2026

This is the fixed public website completion phase.

Until Phase 9:

- Do not fully redesign the public site.
- Do not finish placeholder sections.
- Do not add unnecessary animation.
- Do not add pricing.
- Do not build temporary contact-form behaviour.
- Only repair defects blocking development or testing.

Website completion includes:

- Final hero copy
- Final navigation
- Final services content
- Why-choose-us section
- About section
- Fully working contact form
- Footer
- Login and dashboard links
- Privacy policy
- Terms
- Cookie handling where required
- Accessibility
- Responsive mobile behaviour
- SEO metadata
- Loading and error states
- Performance optimisation
- Analytics
- Production domain

The public contact form must:

- Store the enquiry
- Notify the AI business owner
- Record source
- Capture service interest
- Include spam protection

Deploy separate development, staging, and production environments.

**Completion gate**

A real barber can:

- Configure the business
- Receive customer enquiries
- View conversations
- View and manage leads
- Provide verified answers
- Create confirmed bookings
- Use the platform without opening VS Code

**Initial barber MVP target:** Approximately 25 October 2026

---

### Phase 10 — Barber pilot and controlled fixes

**Duration:** Approximately 2 weeks  
**Initial target:** 26 October–8 November 2026

Prioritise only:

- Real bugs
- Security issues
- Confusing owner workflows
- Failed customer journeys
- Important missing controls

**Completion gate**

- Real enquiries complete successfully.
- Owner can use the dashboard.
- No serious tenant-isolation issue exists.
- Booking and escalation are reliable.
- Pilot feedback is documented.

---

### Phase 11 — Multi-industry configuration

**Duration:** 1–2 weeks for the second industry  
**Initial target:** 9–22 November 2026

Add restaurant as the second configured industry.

The restaurant must reuse:

- Shared orchestration
- Conversations
- Customers
- Leads
- Modules
- Authentication
- Dashboard
- Repositories

It must not create a copied chatbot or second backend.

Later configurations:

- Gym
- Dentist
- Estate agent
- Garage
- Charity
- Hotel

**Completion gate**

A new industry can be added mainly through:

- Business configuration
- Workflow definitions
- Required fields
- Module enablement
- Provider integrations

---

### Phase 12 — Commercial SaaS foundation

**Duration:** Approximately 2 weeks  
**Initial target:** Late November–early December 2026

Build:

- Business onboarding
- Subscription plans
- Trial accounts
- Module entitlements
- Usage tracking
- Staff invitations
- Billing portal
- Account suspension
- Data export and deletion
- Basic internal admin tools

Possible packages:

- AI Reception
- Reception + Booking
- Growth: CRM + Sales
- Omnichannel
- Custom or Enterprise

---

### Phase 13 — Communication channels

Build one at a time:

1. Email
2. WhatsApp
3. Instagram
4. Voice and phone

Every channel must reuse the same:

- Business knowledge
- Customers
- Conversations
- CRM
- Booking system
- Modules

No separate AI brain per channel.

---

### Phase 14 — Growth modules

- Customer Service
- Analytics
- Review Management
- AI Sales Agent
- Social Media Manager

All recommendations and metrics must use stored data, not model guesses.

---

### Phase 15 — Knowledge and internal-work modules

- Document Assistant
- HR Assistant
- Finance Assistant
- Recruiting Assistant

These require strong permissions, audit logs, and human oversight.

---

### Phase 16 — Agentic automation

- Research Assistant
- Website Worker
- Controlled browser automation
- Controlled desktop computer use

Required safeguards include:

- Domain allowlists
- Approved task boundaries
- Action previews
- Approval before irreversible actions
- Screenshots
- Audit logs
- Restricted credentials
- Timeouts
- Failure recovery

---

### Phase 17 — Broader assistant products

Later products may include:

- Executive Assistant
- Personal Assistant
- Trading Research Assistant

Autonomous financial trading is outside the initial product plan.

## 6. Timeline summary

These are planning targets, not guarantees.

| Milestone | Initial target |
|---|---:|
| Architecture documentation | 22 July 2026 |
| PostgreSQL foundation | 5 August 2026 |
| Authentication and tenant isolation | 16 August 2026 |
| Read-only owner dashboard | 28 August 2026 |
| Editable business settings | 6 September 2026 |
| Formal module framework | 14 September 2026 |
| CRM and lead management | 25 September 2026 |
| Booking module | 10 October 2026 |
| Website completion and barber MVP launch | 25 October 2026 |
| Barber pilot completion | 8 November 2026 |
| Restaurant configuration | 22 November 2026 |
| Commercial foundation | Early December 2026 |

If a phase takes longer, later dates move forward. Phases do not overlap merely to preserve dates.

## 7. Phase completion checklist

A phase is complete only when:

- Scope is implemented.
- Automated tests pass.
- Manual acceptance tests pass.
- Git diff is reviewed.
- Documentation is updated.
- Work is committed and pushed.
- The completion gate is met.

## 8. Backlog

New ideas are recorded here or in linked planning issues. They do not interrupt the active phase.

Backlog items may include:

- Additional industries
- Additional booking providers
- Advanced analytics
- Review automation
- Voice
- Computer use
- Executive and personal assistants
- Trading research

## 9. Change control

The phase order changes only when:

- A serious security issue is discovered.
- An unavoidable technical dependency is found.
- Real pilot evidence disproves an assumption.
- A third-party integration creates a documented constraint.

Every change must be recorded in `DECISIONS.md` with:

- What changed
- Why it changed
- Supporting evidence
- Timeline impact
- What remains unchanged
