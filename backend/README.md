# AI Business Backend

This folder contains the Express API for the AI Business platform. It is kept
separate from the Next.js frontend so API routes and future integrations can be
developed independently.

## Files

- `server.js` configures Express, JSON parsing, CORS, route mounting, and port
  5000.
- `routes/chat.js` validates chat requests and uses OpenAI's Responses API to
  generate a stateless demo receptionist reply.
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
  "reply": "AI response here"
}
```

Chat history and database storage are intentionally not included at this stage.

## Lead capture

A message is analysed using a strict JSON Schema rather than free-form model
text. The backend then validates the extracted fields itself. A lead requires a
name, phone number, requested service, preferred date, and preferred time. Email
is optional.

Complete single-message enquiries are assigned a unique ID and timestamp, given
`new` status, and saved locally. Writes are queued within the process, written
to a temporary file, and renamed over the live file to avoid partial JSON.
Requests with the same name, phone, service, date, and time within five minutes
reuse the existing lead rather than creating a duplicate.

There is no conversation session yet. If a message is incomplete, the API asks
for the missing fields, but a later message is not combined with the earlier
one. Until session support is added, customers must provide all required lead
details together in a single message.

## Tests

Run the offline validation and repository tests with:

```bash
npm test
```

The test suite does not call OpenAI.
