# Voyage.IQ — Deployment Guide

## Architecture

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | Your Vercel URL |
| Backend | Render / Railway | `https://smartitinery2-1.onrender.com` |
| Database | Railway (PostgreSQL) | Internal/Public URL from Railway dashboard |

---

## Frontend Deployment (Vercel)

### Prerequisites
- Vercel account (free tier works)
- Backend already deployed

### 1. Update Backend URL

Edit `frontend/src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://your-backend-url.com/api'
};
```

### 2. Deploy

**Via Vercel Dashboard:**
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repository
3. Set **Root Directory** to `frontend`
4. Deploy

**Via CLI:**
```bash
cd frontend
npx vercel --prod
```

The `vercel.json` is already configured with SPA rewrites and security headers.

---

## Backend Deployment (Render or Railway)

### Environment Variables

Set these in your hosting platform's dashboard:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | PostgreSQL connection string from Railway | Yes |
| `DB_SSL` | `false` (Railway proxy) / `true` (direct SSL) | Yes |
| `JWT_SECRET` | A secure random string | Yes |
| `PORT` | `3000` | Yes |
| `NODE_ENV` | `production` | Yes |
| `CORS_ORIGIN` | Your Vercel frontend URL | Yes |

### Build & Start Commands
```bash
npm install
npm run build
npm start
```

---

## Database (Railway PostgreSQL)

### Setup
1. Create a PostgreSQL service on [railway.app](https://railway.app)
2. Copy the **DATABASE_PUBLIC_URL** for external access or **DATABASE_URL** for internal (Railway-to-Railway) access
3. Run migrations:
```bash
cd backend
node scripts/run_postgres_migrations.js
```

### Notes
- Profile pictures are stored as **base64 in the database** (not on the filesystem), so they persist across redeployments
- The Railway proxy does **not** require SSL — set `DB_SSL=false` when connecting via the public proxy URL

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 on page refresh | `vercel.json` rewrites handle this — check it's configured |
| API calls failing | Verify `apiUrl` in `environment.prod.ts` and backend CORS settings |
| Profile pictures disappearing | Already fixed — pictures are stored as base64 in the DB |
| DB connection error with SSL | Set `DB_SSL=false` for Railway proxy connections |
