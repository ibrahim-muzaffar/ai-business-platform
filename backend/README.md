# AI Business Backend

This folder contains the Express API for the AI Business platform. It is kept
separate from the Next.js frontend so API routes and future integrations can be
developed independently.

## Files

- `server.js` configures Express, JSON parsing, CORS, route mounting, and port
  5000.
- `routes/chat.js` validates chat requests, coordinates conversation sessions,
  and uses OpenAI's Responses API to generate demo receptionist replies.
- `data/business.json` contains the current verified barber-shop information.
- `repositories/businessRepository.js` provides the storage boundary used by
  the chat route. Its JSON lookup can later be replaced with a database query
  without changing the route.
- `services/chatAnalysisService.js` requests a strict structured response from
  OpenAI containing intent, explicitly supplied lead fields, missing fields,
  and a grounded reply for normal business questions.
- `services/leadService.js` independently validates and normalises extracted
  details, then adds the lead ID, timestamp, business type, and `new` status.
- `repositories/leadRepository.js` serialises writes and atomically replaces
  the local lead file. This repository is the boundary to replace with a
  database later.
- `repositories/conversationSessionRepository.js` stores development sessions
  in memory, scopes them to a business type, limits message history, and
  expires inactive sessions.
- `data/leads.json` is the local runtime lead store and is ignored by Git
  because it can contain personal information.
- `package.json` defines the backend dependencies and run scripts.

## Environment variables

Create a local `.env` file containing `OPENAI_API_KEY` and `OPENAI_MODEL`.
The file is ignored by Git and must never be committed.

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

## Lead capture

A message is analysed using a strict JSON Schema rather than free-form model
text. The backend then validates the extracted fields itself. A lead requires a
name, phone number, requested service, preferred date, and preferred time. Email
is optional.

Extracted non-empty fields are merged with the session's collected lead data.
The combined data is independently validated after each message. Complete
enquiries are assigned a unique ID and timestamp, given `new` status, and saved
locally. Writes are queued within the process, written to a temporary file, and
renamed over the live file to avoid partial JSON. Requests with the same name,
phone, service, date, and time within five minutes reuse the existing lead
rather than creating a duplicate.

Once a session saves or matches an existing lead, it is marked completed and
cannot save that enquiry again. The assistant always describes it as an enquiry
whose availability still needs confirmation.

## Development conversation sessions

Sessions use an in-memory `Map`. Each contains an ID, business type, collected
lead fields, the latest 10 user/assistant messages, completion state, and
created/updated timestamps. IDs are scoped to their original business demo and
inactive sessions expire after approximately 30 minutes. Expired sessions are
cleaned lazily during normal repository access.

This storage is for local development only:

- Sessions disappear whenever the backend restarts.
- Sessions are not shared between multiple backend processes or instances.
- Memory storage is not suitable for production scaling or durable recovery.

A shared session store such as a database or Redis will be needed before
running multiple backend instances. No cookies or authentication are used yet.

## Tests

Run the offline validation and repository tests with:

```bash
npm test
```

The test suite does not call OpenAI.
