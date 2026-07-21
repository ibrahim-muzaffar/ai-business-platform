# AI Business OS — Architecture

**Version:** 1.0  
**Status:** Locked target architecture with current-state distinctions

## 1. Purpose

This document defines the current and planned architecture of the AI Business OS.

The system is one multi-tenant platform containing reusable AI modules. It must not become a collection of copied chatbots for different industries.

## 2. System context

```text
Customers and staff
        |
        v
Channels
Website | Email | WhatsApp | Instagram | Phone
        |
        v
API and channel adapters
        |
        v
AI orchestration
Intent | Context | Knowledge | Module selection | Tool selection
        |
        v
Application modules and domain services
Reception | Leads | CRM | Booking | Sales | Support | Documents
        |
        v
Repositories
        |
        v
Infrastructure
PostgreSQL | OpenAI | Calendar | Email | Booking providers | Social platforms
```

## 3. Current architecture

The current prototype is expected to contain:

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- One landing/demo page
- Business demo cards embedded in the main page
- Chatbot interface
- Conversation session state
- Nullable session-ID handling

The public website is not production-complete. The About area, contact section and contact flow, and footer are currently absent. Final navigation, legal pages, final SEO, analytics, and production optimisation remain unfinished.

### Backend

- Express
- OpenAI Responses API integration
- Business repository
- Lead repository
- Conversation-session repository
- Grounded barber knowledge
- Structured lead extraction
- Lead validation
- Duplicate prevention
- Configured-business guard
- Offline tests

### Current storage

- Business data: JSON
- Leads: JSON
- Conversation sessions: in memory

These implementations are temporary and must remain behind repository interfaces.

## Technology Stack

### Current frontend

- **Next.js 16.2.10:** Provides the App Router, application build, static rendering, and frontend development server.
- **React 19.2.4:** Renders the landing page and manages interactive chatbot and session state.
- **TypeScript 5.9.3:** Provides static type checking for the frontend application.
- **Tailwind CSS 4.3.2:** Provides utility-based styling through the Tailwind PostCSS integration.
- **ESLint 9.39.5 with eslint-config-next 16.2.10:** Checks frontend code against JavaScript, TypeScript, React, and Next.js linting rules.
- **Browser Fetch API:** Sends chatbot requests from the browser to the Express API without an additional HTTP-client library.

### Current backend

- **Node.js runtime (`>=18` declared):** Runs the backend, tests, built-in filesystem operations, and cryptographic utilities; no exact Node.js version is pinned by the repository.
- **Express 5.2.1:** Provides the HTTP server, middleware pipeline, and `/api/chat` route mounting.
- **OpenAI official JavaScript SDK 6.48.0:** Creates the server-side OpenAI client without exposing credentials to the frontend.
- **OpenAI Responses API:** Performs structured chat analysis and generates grounded receptionist replies through `client.responses.create(...)`.
- **dotenv 17.4.2:** Loads local backend environment variables from `.env` at startup.
- **CORS 2.8.6:** Allows the separately served frontend to call the backend during development.
- **Node.js built-in test runner:** Runs the offline backend test suite through `node --test` without a separate test framework.
- **Node.js `crypto.randomUUID()`:** Generates lead, session, and temporary-file identifiers without an additional UUID package.
- **JSON-file storage:** Stores verified barber data and temporary lead records through Node.js filesystem APIs.
- **Process-local `Map` session storage:** Holds temporary conversation sessions, accumulated lead fields, and limited recent message history in backend memory.

### Planned permanent infrastructure

- **PostgreSQL:** The planned permanent relational database for tenant-scoped platform data.
- **Migration and schema-management tool:** Not yet selected and will be chosen during the PostgreSQL phase.
- **Authentication provider or implementation:** Not yet selected and will be chosen during the authentication phase.
- **Managed hosting providers:** Not yet selected for the frontend, API, or PostgreSQL infrastructure.
- **Secure secret management:** Environment-specific secrets will be stored and supplied through secure deployment mechanisms rather than source control.
- **Development, staging, and production environments:** Separate deployed environments are planned for controlled validation and release.
- **Structured logging and error monitoring:** Production logging and monitoring capabilities are planned, with providers not yet selected.
- **Provider adapters:** Calendar, email, messaging, and later voice integrations will remain behind provider-specific adapters.

### Temporary versus permanent technology

**Temporary prototype**

- JSON business data
- JSON lead storage
- Process-local in-memory sessions
- Localhost frontend/backend communication

**Permanent target**

- PostgreSQL repositories
- Persistent conversations and messages
- Authentication and tenant isolation
- Deployed API and frontend
- Secure environment-specific configuration
- External integrations behind adapters

### Technology-selection rule

Technologies are selected during the phase in which they are introduced, after comparing requirements, compatibility, cost, security, maintainability, and migration impact.

## 4. Planned permanent architecture

```text
Frontend applications
Public website | Owner dashboard | Internal admin
        |
        v
HTTP API and channel adapters
        |
        v
Authentication and tenant context
        |
        v
Application orchestration
        |
        +--------------------+
        |                    |
        v                    v
AI orchestration       Deterministic services
        |                    |
        v                    v
Modules and workflows  Validation and permissions
        |
        v
Repositories
        |
        v
PostgreSQL and external integrations
```

## 5. Architectural layers

### 5.1 Frontend layer

Responsibilities:

- Present public marketing content
- Present chatbot interactions
- Present authenticated owner dashboards
- Collect user input
- Show loading, empty, success, and error states
- Send structured requests to backend APIs
- Store only safe client-side session state

The frontend must not:

- Call booking providers directly
- Call PostgreSQL directly
- Store API secrets
- Decide whether a protected action is authorised
- Treat model text as proof that an external action succeeded

### 5.2 API and controller layer

Responsibilities:

- Parse and validate requests
- Resolve business and tenant context
- Resolve authenticated user context
- Invoke application services
- Return consistent structured responses
- Map expected errors to appropriate HTTP responses

Routes must remain thin.

### 5.3 AI orchestration layer

Responsibilities:

- Understand customer intent
- Load allowed conversation context
- Load verified business knowledge
- Select an enabled module
- Request structured extraction where needed
- Choose an approved tool or application action
- Produce a response based on confirmed results
- Escalate when confidence, permissions, or data are insufficient

The AI orchestration layer must not bypass module permissions or repository boundaries.

### 5.4 Domain services

Domain services contain deterministic business rules.

Examples:

- Lead validation
- Duplicate prevention
- Booking validation
- Customer matching
- Permission checks
- Escalation decisions
- Action confirmation
- Status transitions

### 5.5 Modules

Modules package reusable business capabilities.

Examples:

- Reception
- Lead Capture
- Conversation
- Customer
- CRM
- Booking
- Sales
- Customer Service
- Documents

Modules are independent from communication channels.

### 5.6 Repositories

Repositories provide stable interfaces between application code and infrastructure.

Examples:

- `businessRepository`
- `leadRepository`
- `customerRepository`
- `conversationRepository`
- `bookingRepository`
- `integrationRepository`
- `actionLogRepository`

Routes and modules should depend on repository contracts, not concrete storage technology.

#### Transaction boundaries

Repositories accept an injected database connection or transaction and do not start transactions themselves. Application and domain services own transaction boundaries when one logical action modifies multiple records; routes must not contain raw transaction or database logic.

Creating a message and updating its conversation activity timestamp is one atomic action that commits or rolls back as a unit. Runtime JSON and in-memory providers remain active until the controlled Phase 2 PostgreSQL cutover.

### 5.7 Infrastructure adapters

Infrastructure adapters implement external dependencies.

Examples:

- PostgreSQL repositories
- OpenAI client
- Google Calendar adapter
- Gmail adapter
- Booking-provider adapter
- WhatsApp adapter
- Instagram adapter
- Voice provider
- Browser automation provider

## 6. Channels versus modules

A channel describes where a request arrives.

Channels:

- Website
- Email
- WhatsApp
- Instagram
- Phone

A module describes what the platform can do.

Modules:

- Reception
- Booking
- CRM
- Sales
- Customer Service
- Documents

The same booking module should work for requests arriving from any supported channel.

## 7. Industry configuration

Industries are configuration, not separate applications.

A configured business may define:

- Business type
- Verified information
- Services
- Prices
- Policies
- Opening hours
- Workflows
- Required fields
- Enabled modules
- Escalation rules
- Integrations

Example:

```text
Barber
+ appointment workflow
+ reception module
+ lead module
+ booking module
```

```text
Restaurant
+ reservation workflow
+ order-enquiry workflow
+ reception module
+ lead module
+ reservation integration
```

Adding a new industry must not require copying the chatbot or creating another backend.

## 8. Tenant isolation

Every protected record must be scoped to an organisation and, where relevant, a business.

The system must enforce tenant isolation in:

- Authentication
- API authorisation
- Service logic
- Repository queries
- Database constraints or policies
- Audit logs

A user from one organisation must never access another organisation's:

- Leads
- Customers
- Conversations
- Settings
- Bookings
- Documents
- Integrations

Public chatbot routes must expose only approved public business information.

## 9. Current request flow

```text
Browser chatbot
        |
        v
POST /api/chat
        |
        v
Configured-business guard
        |
        +---- unsupported ----> safe not-configured response
        |
        v
Get or create the barber’s in-memory conversation session
        |
        v
Load verified barber business data
        |
        v
AI analysis and grounded response
        |
        v
Validate and save lead when complete
        |
        v
Return reply and session ID
```

Current limitations:

- Sessions are lost on restart.
- Business data is file-based.
- Leads are file-based.
- No authenticated owner context exists.
- Only the barber is configured.

## 10. Planned permanent request flow

```text
Channel adapter
        |
        v
Request validation
        |
        v
Business resolution
        |
        v
Authentication or public-access policy
        |
        v
Tenant-scoped conversation retrieval
        |
        v
Verified knowledge loading
        |
        v
Intent and module selection
        |
        v
Permission and workflow validation
        |
        v
Optional external tool action
        |
        v
Confirmed result
        |
        v
Persist messages, actions, and state
        |
        v
Return structured response
```

## 11. Booking action flow

```text
Customer request
        |
        v
AI extracts structured booking details
        |
        v
Booking service validates details
        |
        v
Provider checks availability or executes action
        |
        v
Provider returns confirmed result
        |
        v
Booking and action log are persisted
        |
        v
AI reports the confirmed outcome
```

The AI must never invent availability or claim success before provider confirmation.

## 12. Knowledge-loading flow

```text
Owner edits verified business data
        |
        v
Database stores current values
        |
        v
Business repository returns tenant-scoped knowledge
        |
        v
AI prompt receives only approved facts
        |
        v
Customer receives grounded response
```

The AI must distinguish:

- Verified business facts
- Customer-provided information
- General conversational language
- Unknown information

Unknown information must produce a safe response rather than an invented fact.

## 13. Human escalation

Escalation may occur when:

- The user asks for a human
- Confidence is insufficient
- A policy requires approval
- A tool fails
- A request is sensitive
- The AI lacks permission
- A complaint or legal issue requires staff review

Escalation state must be persisted and visible in the dashboard.

## 14. Audit and action confirmation

Actions requiring audit include:

- Booking creation
- Booking movement
- Cancellation
- Email sending
- Quote sending
- Refund or return processing
- Permission changes
- Data export
- Integration changes

The platform should record:

- Who or what initiated the action
- Organisation and business
- Conversation
- Action type
- Target
- Status
- Provider result
- Timestamp

## 15. Observability and error handling

The permanent system should support:

- Structured application logs
- Error tracking
- Request correlation
- Integration failure logs
- Action outcome logs
- Health checks
- Environment separation
- Alerting for repeated failures

Errors shown to customers must be safe and must not leak secrets or internal implementation details.

## 16. Security boundaries

- Secrets remain server-side.
- Public and protected data are separated.
- Tenant scope is mandatory.
- External credentials are stored through secure provider mechanisms.
- Sensitive modules require stronger roles and audit controls.
- Personally identifiable information is minimised and protected.
- Computer-use automation requires explicit approval boundaries.

## 17. Folder responsibilities

Expected current responsibilities:

```text
frontend/
  app/                 Public page and UI
  public/              Static assets

backend/
  routes/              HTTP request handling
  services/            Application and domain logic
  repositories/        Storage contracts and implementations
  data/                Temporary prototype data
  tests/               Offline automated tests
```

The exact repository structure must be verified before treating this as final.

Planned additions may include:

```text
backend/
  modules/
  integrations/
  middleware/
  db/
  migrations/
  validators/
  policies/
```

## 18. Explicitly prohibited patterns

- Separate chatbot applications per industry
- A second backend for each business type
- Direct PostgreSQL access from routes
- Direct provider calls from UI components
- Hardcoded tenant bypasses
- Trusting model text as proof of action success
- Secrets in source code
- Cross-tenant queries
- One enormous chat route containing all business logic
- Implementing unrelated future modules during an active phase
- Completing the public website before Phase 9 except for blocking defects

## 19. Migration strategy

The application must migrate infrastructure without rewriting application behaviour.

Example:

```text
JSON lead repository
        |
        v
PostgreSQL lead repository
```

Application services continue calling stable methods such as:

- `saveLead`
- `findLeadById`
- `listLeadsForBusiness`
- `updateLeadStatus`

The implementation changes; the application contract remains stable.
