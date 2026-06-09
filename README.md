# Leaflet Employee Frontend

Next.js frontend for the Leaflet Employee and Leaflet Admin employee management system.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app runs at `http://localhost:3000`.

## Environment

Use `.env.example` as the template for local configuration. Do not commit `.env`, `.env.local`, or any production secrets.

For production, set:

```bash
NEXT_PUBLIC_API_BASE_URL=https://leaflet-employee-backend.onrender.com/api/v1
```

## Vercel Deployment

Create a Vercel project from this repository.

- Framework preset: `Next.js`
- Root directory: leave empty
- Build command: `npm run build`
- Output directory: leave default
- Install command: `npm install`

Required environment variable:

```bash
NEXT_PUBLIC_API_BASE_URL=https://leaflet-employee-backend.onrender.com/api/v1
```

## Scripts

```bash
npm run dev
npm run build
npm run start
```
