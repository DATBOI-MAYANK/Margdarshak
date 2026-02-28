# Voyage.IQ — Smart Travel Itinerary Planner

A full-stack travel itinerary planning application built with **Angular** (frontend) and **Node.js/Express** (backend), backed by **PostgreSQL**.

## Features

- Create, edit, and manage travel itineraries
- AI-powered activity suggestions per destination
- Real-time collaboration with other users (Socket.io)
- Messaging and notification system
- Profile management with image upload
- Role-based access (Traveler / Admin)
- Weather and currency info for destinations
- Responsive Material Design UI

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular, Angular Material, SCSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Railway) |
| Auth | JWT |
| Real-time | Socket.io |
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
│   │   │   └── guards/
│   │   └── environments/
│   └── public/assets/
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or Railway)

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env    # Edit with your DB credentials
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start               # Opens at http://localhost:4200
```

### Environment Variables (Backend)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_SSL` | Set to `true` if your DB requires SSL |
| `JWT_SECRET` | Secret key for JWT tokens |
| `PORT` | Server port (default: 3000) |
| `CORS_ORIGIN` | Allowed frontend origin |

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment instructions.

## License

[MIT](LICENSE)


