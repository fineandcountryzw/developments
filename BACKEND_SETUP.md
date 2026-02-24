# Fine & Country Zimbabwe ERP - Backend Setup

## Overview

The application now has a complete Node.js/Express backend that:
- ✅ Serves the Vite frontend (React app)
- ✅ Provides API endpoints for CRUD operations
- ✅ Connects to Neon PostgreSQL database via Prisma ORM
- ✅ Handles authentication and validation
- ✅ Manages all business logic server-side

## Architecture

```
┌─────────────────────────────────────────────┐
│         React Frontend (Vite)               │
│  - localhost:3000 (dev) or / (production)   │
└──────────────┬──────────────────────────────┘
               │
        fetch() to /api/*
               │
┌──────────────▼──────────────────────────────┐
│      Express.js Backend                     │
│  - localhost:3001 (dev) or :3000 (prod)     │
│                                              │
│  ├─ GET/POST/PUT/DELETE /api/admin/*        │
│  └─ Static file serving for frontend        │
└──────────────┬──────────────────────────────┘
               │
        Prisma ORM
               │
┌──────────────▼──────────────────────────────┐
│      Neon PostgreSQL Database               │
│  - Serverless PostgreSQL on AWS             │
└──────────────────────────────────────────────┘
```

## Development Setup

### Terminal 1: Start Express Backend
```bash
npm run dev:backend
```
- Runs on `localhost:3001`
- Hot-reloads on file changes
- Logs all API requests

### Terminal 2: Start Vite Frontend
```bash
npm run dev
```
- Runs on `localhost:3000`
- Proxies API calls to backend (see vite.config.ts)
- Hot module reloading

### OR: Run Both Together
```bash
npm run dev:full
```
- Uses concurrently to run both servers
- Opens in your terminal with labeled output

## Production Deployment

### Build
```bash
npm run build
```
- Builds Vite frontend to `dist/`
- Creates optimized bundle

### Run
```bash
npm start
```
- Serves both frontend and backend from Express on port 3000
- Can be deployed to Vercel, Heroku, or any Node.js host

## API Endpoints

### Developments (Full CRUD)

#### Create Development
```
POST /api/admin/developments
Content-Type: application/json

{
  "name": "Borrowdale Heights",
  "branch": "Harare",
  "location_name": "Borrowdale",
  "total_stands": 150,
  "base_price": 250000,
  "description": "Luxury residential development",
  ...
}

Response: 201 Created
{
  "data": { id, name, branch, ... },
  "error": null
}
```

#### Fetch Developments
```
GET /api/admin/developments?branch=Harare

Response: 200 OK
{
  "data": [
    { id, name, branch, stands: [...], ... },
    ...
  ],
  "error": null
}
```

#### Update Development
```
PUT /api/admin/developments
Content-Type: application/json

{
  "id": "dev-123",
  "name": "Updated Name",
  "base_price": 300000,
  ...
}

Response: 200 OK
{
  "data": { id, name, basePrice, ..., updatedAt },
  "error": null
}
```

#### Delete Development
```
DELETE /api/admin/developments
Content-Type: application/json

{
  "id": "dev-123"
}

Response: 200 OK
{
  "data": null,
  "error": null
}
```

## Key Files

### Server
- `server.ts` - Main Express app configuration
- `server/api/admin/developments.ts` - Developments CRUD endpoints

### Frontend (Updated)
- `lib/db.ts` - Database functions (now calls Express API)
- `components/AdminDevelopments.tsx` - Uses lib/db functions

### Configuration
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Frontend build config
- `.env.production` - Environment variables (Neon DB credentials)

## Data Persistence

✅ **Now fully persistent!** All developments are saved to Neon PostgreSQL:
- Create → Stored in DB
- Update → Changed in DB
- Delete → Removed from DB
- Refresh page → Data loads from DB

## Environment Variables

Required in `.env.production`:

```
DATABASE_URL=postgresql://...  # Neon pooled connection
DATABASE_URL_UNPOOLED=postgresql://...  # Neon unpooled (migrations)
PRISMA_CLIENT_ENGINE_TYPE=dataproxy
NODE_ENV=production
PORT=3000
```

## Logging

All API operations are logged to console with `[FORENSIC][API]` prefix:

```
[2024-12-29T15:30:45.123Z] POST   /api/admin/developments
[FORENSIC][API] POST /api/admin/developments called
[FORENSIC][API] Request payload: { name, branch, total_stands }
[FORENSIC][API] Development created: { id, name }
```

## Error Handling

All API errors return consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Error codes:
- `MISSING_FIELDS` - Required fields missing
- `DUPLICATE_NAME` - Development already exists
- `NOT_FOUND` - Development doesn't exist
- `CREATE_ERROR`, `UPDATE_ERROR`, `DELETE_ERROR` - Operation failed

## Next Steps

1. ✅ Backend server created and running
2. ✅ Express API routes functional
3. ✅ Database persistence working
4. Next: Deploy to production
   - Update Vercel build settings
   - Or deploy to Heroku/other Node.js host
5. Add more API routes as needed (clients, stands, reservations, etc.)

## Troubleshooting

### API returns 405 Method Not Allowed
- ✅ Fixed! This was the original issue - now using proper Express backend

### Database connection fails
- Verify `DATABASE_URL` in `.env.production`
- Check Neon database credentials
- Ensure network access is enabled

### Frontend can't reach API
- In dev: Check that both `npm run dev` and `npm run dev:backend` are running
- In prod: Ensure same server serves both frontend and API

### TypeScript errors
- Run `npm install` to install all dependencies
- Ensure `@types/express` and `@types/cors` are installed

