# AI Business Backend

This folder contains the Express API for the AI Business platform. It is kept
separate from the Next.js frontend so API routes and future integrations can be
developed independently.

## Files

- `server.js` configures Express, JSON parsing, CORS, route mounting, and port
  5000.
- `routes/chat.js` validates chat requests and uses OpenAI's Responses API to
  generate a stateless demo receptionist reply.
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
