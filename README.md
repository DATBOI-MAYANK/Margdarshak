# Voyage.IQ — Smart Travel Itinerary Planner

A full-stack travel itinerary planning application built with **Angular** (frontend) and **Node.js/Express** (backend), backed by **PostgreSQL**.

## Features

- Create, edit, and manage travel itineraries
- AI-powered activity suggestions per destination
- Real-time collaboration with other users (Socket.io)
- Transport comparison — flights (Amadeus), trains (IRCTC), buses with route visualization
- Estimated trip budget auto-calculation (INR)
- Hotel search near destinations (Geoapify)
- Interactive route map (Mapbox GL)
- Messaging and notification system
- Profile management with image upload
- Role-based access (Traveler / Admin)
- Weather and currency info for destinations
- Responsive Material Design UI

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular 16, Angular Material, SCSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Railway) |
| Auth | JWT |
| Real-time | Socket.io |
| Maps | Mapbox GL JS |
| APIs | Amadeus (flights), IRCTC/RapidAPI (trains), Geoapify (places/hotels) |
| Hosting | Vercel (frontend), Render/Railway (backend) |

## Project Structure

```
├── backend/          # Express API server
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── config/
│   └── scripts/      # DB migration scripts
├── frontend/         # Angular SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── shared/components/
│   │   │   └── guards/
│   │   └── environments/
│   └── public/assets/
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or Railway)
- API keys (see below)

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env    # Fill in your credentials
npm run dev             # Starts at http://localhost:3000
```

### Frontend Setup
```bash
cd frontend
npm install
```

Create `frontend/.env` with your Mapbox token:
```
MAPBOX_TOKEN=your_mapbox_token_here
```

Copy and fill the environment files:
```bash
cp src/environments/environment.example.ts src/environments/environment.ts
cp src/environments/environment.prod.example.ts src/environments/environment.prod.ts
```

Then start the dev server:
```bash
npm start               # Opens at http://localhost:4200
```

### Environment Variables

#### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_SSL` | Set to `true` if your DB requires SSL |
| `JWT_SECRET` | Secret key for JWT tokens |
| `PORT` | Server port (default: 3000) |
| `CORS_ORIGIN` | Allowed frontend origin |
| `GEOAPIFY_API_KEY` | Geoapify API key for places/geocoding |
| `AMADEUS_API_KEY` | Amadeus API key for flight search |
| `AMADEUS_API_SECRET` | Amadeus API secret |
| `RAPIDAPI_KEY` | RapidAPI key for IRCTC train search |

#### Frontend (`frontend/src/environments/environment.ts`)

| Variable | Description |
|----------|-------------|
| `apiUrl` | Backend API URL |
| `geoapifyKey` | Geoapify API key for hotel search |

#### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `MAPBOX_TOKEN` | Mapbox GL access token |

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment instructions.

## License

[MIT](LICENSE)


