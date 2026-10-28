# 🎬 Movie Watchlist Manager

A full-stack MERN application for managing your personal movie collection. Track movies you want to watch, are currently watching, or have already watched — with priorities, ratings, genre filters, and statistics.

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19 + Vite                     |
| Backend  | Node.js + Express 5                 |
| Database | MongoDB Atlas (via Mongoose)        |
| Styling  | Vanilla CSS (Space Cadet cinematic palette & Playfair Display typography) |

---

## Setup Instructions

### Prerequisites
- Node.js v18+ (v20 recommended)
- A MongoDB Atlas account with a cluster and database

### 1. Clone / navigate to the project

```bash
cd movie-watchlist
```

### 2. Configure the backend environment

Your `backend/.env` is already included for evaluation with a working MongoDB Atlas cluster:

```
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.ermdr2r.mongodb.net/
PORT=5000
```

> **Note:** The `.env` file is included in the submission so that evaluators can run the project immediately after cloning without needing to configure a database cluster.

### 3. Install dependencies

```bash
# Terminal 1 — backend
cd backend
npm install

# Terminal 2 — frontend
cd frontend
npm install
```

### 4. Run the application (two terminals)

**Terminal 1 — Backend (port 5000)**
```bash
cd backend
npm run dev        # uses nodemon for auto-reload
# or: npm start   # uses plain node
```

**Terminal 2 — Frontend (port 5173)**
```bash
cd frontend
npm run dev
```

Open your browser at **http://localhost:5173**

---

## Environment Variables

| Variable   | Required | Description                          |
|------------|----------|--------------------------------------|
| `MONGO_URI` | ✅ Yes  | MongoDB Atlas connection string      |
| `PORT`      | No       | Express port (default: `5000`)       |

---

## API Endpoints

Base URL: `http://localhost:5000/api/movies`

All responses follow the shape: `{ success, message, data }`

### Movies

| Method | Endpoint              | Description                                      |
|--------|-----------------------|--------------------------------------------------|
| GET    | `/`                   | List movies with search, filter, pagination      |
| GET    | `/?search=<query>`    | Search by title (case-insensitive)               |
| GET    | `/?genre=<genre>`     | Filter by genre                                  |
| GET    | `/?status=<status>`   | Filter by status                                 |
| GET    | `/?page=<n>`          | Paginate (6 movies per page)                     |
| GET    | `/watch-next`         | Get highest-priority To Watch movie (shortest runtime if tied) |
| GET    | `/stats`              | Get collection statistics                        |
| GET    | `/:id`                | Get a single movie by ID                         |
| POST   | `/`                   | Add a new movie (To Watch status, auto code)     |
| PUT    | `/:id`                | Edit movie (title/genre/runtime/platform/priority/rating) |
| PATCH  | `/:id/status`         | Valid status transitions (requires rating for Watched) |
| PATCH  | `/:id/rating`         | Edit rating for movies in Watched status (1–10)  |
| DELETE | `/:id`                | Delete movie (Watching movies cannot be deleted) |

### Query Parameters for GET /

| Parameter | Values                                        |
|-----------|-----------------------------------------------|
| `search`  | Any string — case-insensitive title search    |
| `genre`   | Action · Comedy · Drama · Horror · Sci-Fi · Romance · Thriller |
| `status`  | To Watch · Watching · Watched                 |
| `page`    | Positive integer (default: 1)                 |

### Sorting (GET /)
- **To Watch** movies: sorted by priority (highest first), then runtime (shortest first)
- **Watching** movies: after To Watch
- **Watched** movies: last, newest first

### POST / body

```json
{
  "title": "Inception",
  "genre": "Sci-Fi",
  "releaseYear": 2010,
  "runtime": 148,
  "platform": "Netflix",
  "priority": 4
}
```

Valid genres: `Action`, `Comedy`, `Drama`, `Horror`, `Sci-Fi`, `Romance`, `Thriller`  
Valid platforms: `Netflix`, `Prime Video`, `Hotstar`, `Theatre`, `Other`  
Priority: `1` (lowest) to `5` (highest)  
Runtime: `30` to `300` minutes  
Release year: `1950` to current year

### PATCH /:id/status body

```json
{ "status": "Watched", "rating": 8 }
```

Status transitions:
- `To Watch` → `Watching` or `Watched`
- `Watching` → `To Watch` or `Watched`
- `Watched` → ❌ (final, cannot transition)

A `rating` (1–10) is **required** when transitioning to `Watched`.

### Movie Code Format

Codes are auto-generated and immutable: `MV-<releaseYear>-<3-digit-sequence>`  
Example: `MV-2010-001`, `MV-2010-002`

---

## Features

| Feature | Status |
|---------|--------|
| Add movies with validation (frontend & backend) | ✅ |
| Auto-generated immutable movie codes (MV-YYYY-NNN) | ✅ |
| Duplicate title + year rejection (case-insensitive, HTTP 409) | ✅ |
| Status transitions dropdown showing only valid next statuses | ✅ |
| Rating mandatory when marking Watched (1–10) | ✅ |
| Watched date auto-recorded | ✅ |
| Watched status is final (cannot transition back) | ✅ |
| Edit rating later for Watched movies (PATCH /:id/rating) | ✅ |
| Edit title / genre / runtime / platform / priority / rating | ✅ |
| Delete with confirmation (Watching movies protected) | ✅ |
| Search by title (case-insensitive) | ✅ |
| Filter by genre | ✅ |
| Filter by status | ✅ |
| Combined search + genre + status filters | ✅ |
| Pagination (6 per page, Previous/Next) | ✅ |
| Page resets to 1 on filter change | ✅ |
| "What should I watch next?" recommendation button | ✅ |
| Statistics Dashboard (counts, hours watched, avg rating, top genre) | ✅ |
| Stats refresh automatically on add, edit, status change, delete | ✅ |
| Sorting: To Watch by priority then shortest runtime | ✅ |
| Empty-state messages | ✅ |
| Cinematic Space Cadet theme & responsive mobile layout | ✅ |

---

## Project Structure

```
movie-watchlist/
├── backend/
│   ├── models/
│   │   ├── Movie.js          # Mongoose schema
│   │   └── Counter.js        # Per-year sequence counter
│   ├── routes/
│   │   └── movieRoutes.js    # All API routes
│   ├── server.js             # Express app entry point
│   ├── .env                  # Included with active MongoDB Atlas credentials
│   ├── .env.example          # Template for .env
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx           # Main React component
    │   ├── App.css           # Cinematic dark theme (Space Cadet, Cyan Azure, Pink Lavender)
    │   ├── index.css         # Minimal CSS reset
    │   └── main.jsx          # React entry point
    └── package.json
```

---

## Screenshots

Start both servers, open http://localhost:5173, then add movies and interact with the interface to capture screenshots for submission.

Suggested screenshots:
1. The movie collection with multiple cards showing different statuses
2. The statistics section and Watch Next recommendation together

---

## Git

```bash
git status          # check uncommitted changes
git add -A
git commit -m "feat: add search, filters, pagination, watch-next, stats, edit, delete"
git log --oneline   # verify history
```
