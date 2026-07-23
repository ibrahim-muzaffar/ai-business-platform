# AI Business Backend

This folder contains the Express API for the AI Business platform. It is kept
separate from the Next.js frontend so API routes and future integrations can be
developed independently.

## Files

- `server.js` configures Express, JSON parsing, CORS, route mounting, and port
  5000.
- `routes/chat.js` validates chat requests, coordinates conversation sessions,
  and uses OpenAI's Responses API to generate demo receptionist replies.
- `repositories/postgres/runtimeBusinessRepository.js` aggregates verified
  public business data from PostgreSQL and defines the configured business-ID
  mapping used by the live route.
- `services/chatAnalysisService.js` requests a strict structured response from
  OpenAI containing intent, explicitly supplied lead fields, missing fields,
  and a grounded reply for normal business questions.
- `services/leadService.js` independently validates and normalises extracted
  details, then adds the lead ID, timestamp, business type, and `new` status.
- `services/leadCaptureService.js` atomically matches or creates customers and
  saves tenant-scoped leads through PostgreSQL repositories.
- `services/conversationSessionService.js` persists website conversations,
  messages, and temporary session metadata in PostgreSQL.
- `repositories/postgres/` contains explicit tenant-scoped PostgreSQL
  repositories used by the application services.
- `db/config.js` defines environment-aware Knex settings for the development
  and test databases.
- `db/connection.js` creates reusable Knex connections and destroys them
  cleanly when database work finishes.
- `knexfile.js` exposes CommonJS development and test configuration to the
  Knex CLI, with separate migration and seed directories.
- `db/migrations/` contains the application schema migrations, and
  `db/seeds/01_northside_barbers.js` contains deterministic barber data.
- `scripts/checkDatabaseConnection.js` runs a safe connectivity check without
  printing database credentials.
- `package.json` defines the backend dependencies and run scripts.

## Environment variables

Use `.env.example` as the safe configuration template. A local `.env` may
contain `OPENAI_API_KEY`, `OPENAI_MODEL`, `DATABASE_URL`, and
`TEST_DATABASE_URL`. The local `.env` is ignored by Git and must never be
committed. Never reuse the Docker development credentials in staging or
production.

## Run locally

Install dependencies if needed, then start the server:

```bash
npm install
npm run dev
```

For a standard start without file watching:

```bash
npm start
```

The API runs at `http://localhost:5000`. Send a chat message with:

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","businessType":"barber"}'
```

It returns a generated reply in this shape:

```json
{
  "status": "success",
  "reply": "AI response here",
  "sessionId": "generated-session-id"
}
```

Send the returned `sessionId` with later messages in the same conversation.

## Local PostgreSQL development environment

### Prerequisites

- Docker Desktop with Docker Compose support
- Node.js 18 or newer
- Backend dependencies installed with `npm install`

The top-level `compose.yaml` runs one official PostgreSQL 18 container. It
creates `ai_business_dev` through the image configuration and creates
`ai_business_test` through a small initialization script. Both databases use
the same local-only PostgreSQL service and named Docker volume. No application
tables are created by this setup.

From the project root, start PostgreSQL in the background:

```bash
docker compose up -d postgres
```

View container and health status:

```bash
docker compose ps
```

Stop PostgreSQL without deleting its data:

```bash
docker compose stop postgres
```

Set `DATABASE_URL` and `TEST_DATABASE_URL` in the local backend `.env` using
the safe local values shown in `.env.example`. Do not overwrite or expose an
existing OpenAI key. From `backend`, verify each connection with:

```bash
npm run db:check
npm run db:test:check
```

Development migration and seed commands are:

```bash
npm run db:migrate
npm run db:rollback
npm run db:seed
```

Equivalent test-database commands are:

```bash
npm run db:test:migrate
npm run db:test:rollback
npm run db:test:seed
```

The migration commands manage the current application schema. The seed command
upserts deterministic Northside Barbers configuration without deleting
unrelated records.

To remove the container and reset the local PostgreSQL volume, run from the
project root:

```bash
docker compose down --volumes
```

**Warning:** Resetting the volume permanently deletes all data in both local
databases. The initialization scripts run again only when PostgreSQL starts
with an empty volume.

PostgreSQL is the active runtime store. Verified business data, customers,
leads, conversations, messages, and temporary conversation-session state all
survive backend restarts. The live application no longer uses JSON business or
lead storage and no longer uses process-local sessions.

## Configured-business safety rule

Only business types registered by ID in
`repositories/postgres/runtimeBusinessRepository.js` may use live AI, verified
business data, conversation sessions, or lead capture. The barber is currently
the only configured demo. Other frontend demos keep their preloaded examples,
but live messages receive the existing honest unavailable response with a null
session ID.

The chat route applies this guard before checking the OpenAI client, loading
business data, creating or retrieving a session, analysing a message, or saving
a lead. A future business can be enabled through the shared configured-ID
mapping; route logic does not need an industry-specific condition.

## Lead capture

A message is analysed using a strict JSON Schema rather than free-form model
text. The backend then validates the extracted fields itself. A lead requires a
name, phone number, requested service, preferred date, and preferred time. Email
is optional.

Extracted reliable fields are accumulated in conversation metadata and
independently validated after each message. Customer matching is scoped to one
business and uses a normalized name plus phone digits; email alone never merges
customers. Customer and lead writes commit in one transaction protected by a
customer-specific PostgreSQL advisory lock. Matching enquiries within five
minutes reuse the existing lead rather than creating a duplicate. Raw requested
date and time wording is preserved without guessing structured values, and chat
leads are linked to their originating conversation.

Once a session saves or matches an existing lead, it is marked completed and
cannot save that enquiry again. The assistant always describes it as an enquiry
whose availability still needs confirmation.

## Conversation sessions

Website sessions use PostgreSQL conversations and messages. Temporary lead
fields, completion state, and the saved lead ID are held in
`conversations.metadata`; user and assistant messages are stored as `customer`
and `ai` messages. Session access is business-scoped and only a bounded set of
recent messages is returned for AI context.

Thirty minutes of inactivity prevents a conversation from being resumed.
Expired conversations and messages are retained rather than deleted, closed,
or archived. Production archival and retention rules remain deferred.

## Current limitations

- Only the barber is configured for live AI and lead capture.
- Authenticated owner access and owner-facing tenant authorisation are not yet
  implemented.
- Enquiries do not create confirmed bookings, and no real booking provider is
  connected.
- Production conversation archival and retention rules remain deferred.
- Major public website completion remains frozen until Phase 9.

## Tests

Run the offline validation and repository tests with:

```bash
npm test
```

The test suite does not call OpenAI.

Run PostgreSQL repository and application-service integration tests separately:

```bash
npm run test:db:repositories
```
