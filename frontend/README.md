# Frontend

React + Vite + TypeScript UI for the college management ERP.

## Setup

```bash
npm install
npm run dev
```

## Environment

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `http://localhost:4000/api` |
| `VITE_API_PORT` | `4000` (used when `VITE_API_URL` unset) |

## API client

- HTTP: `src/lib/api.ts` (Axios + feature APIs)
- Errors: `getApiErrorMessage(error, fallback)` from `src/lib/apiError.ts`
- Auth: `src/lib/auth.ts`; 401 redirects to org login

See [docs/CONVENTIONS.md](../docs/CONVENTIONS.md) for backend contract details.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build to `dist/`
