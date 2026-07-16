# AI Business Backend

This folder contains the Express API for the AI Business platform. It is kept
separate from the Next.js frontend so API routes and future integrations can be
developed independently.

## Files

- `server.js` configures Express, JSON parsing, CORS, route mounting, and port
  5000.
- `routes/chat.js` contains the chat API route. Keeping feature routes in their
  own modules makes it straightforward to add validation, controllers, and an
  AI service layer later.
- `package.json` defines the backend dependencies and run scripts.

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

The API runs at `http://localhost:5000`. Test the current endpoint with:

```bash
curl http://localhost:5000/api/chat
```

It returns:

```json
{
  "status": "success",
  "message": "Backend connected successfully"
}
```

OpenAI and database integrations are intentionally not included at this stage.
