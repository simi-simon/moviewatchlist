# Hosting Movie Watchlist on Render

This guide outlines how to deploy the **Movie Watchlist** application to [Render](https://render.com).

---

## ⚠️ Pre-Deployment Step: MongoDB Atlas Whitelist (Mandatory)

Render instances use dynamic outbound IP addresses on free and starter plans. If MongoDB Atlas has restricted IP access, your server cannot connect.

1. Go to your [MongoDB Atlas Dashboard](https://cloud.mongodb.com/).
2. In the left navigation, under **Security**, click **Network Access**.
3. Click the **+ Add IP Address** button.
4. Click **Allow Access from Anywhere** (`0.0.0.0/0`).
5. Click **Confirm** and wait 1–2 minutes for the change to deploy.

---

## Deployment Option 1: 1-Click Render Blueprint (Recommended)

This project includes a `render.yaml` blueprint that configures both the backend API and frontend static site automatically.

### Steps:
1. Push all latest changes to your GitHub repository:
   ```bash
   git add .
   git commit -m "Configure Render hosting with render.yaml"
   git push origin main
   ```
2. Log in to [dashboard.render.com](https://dashboard.render.com/).
3. Click **New +** (top right) and select **Blueprint**.
4. Connect your GitHub account and choose the repository `moviewatchlist`.
5. Render will scan `render.yaml` and configure two services:
   - **`movie-watchlist-api`** (Node.js Web Service)
   - **`movie-watchlist-ui`** (Vite Static Site)
6. When prompted for environment variables:
   - Enter your **`MONGO_URI`** (your MongoDB Atlas connection string).
7. Click **Apply**.
8. Once both services deploy:
   - Copy your UI URL (e.g., `https://movie-watchlist-ui.onrender.com`).
   - Copy your API URL (e.g., `https://movie-watchlist-api.onrender.com`).
   - In `movie-watchlist-ui` settings -> **Environment**, set `VITE_API_URL` to `https://movie-watchlist-api.onrender.com`.
   - In `movie-watchlist-api` settings -> **Environment**, set `CLIENT_URL` to `https://movie-watchlist-ui.onrender.com`.

---

## Deployment Option 2: Manual Dashboard Setup (Free Tier)

If you prefer to configure the services manually in the Render dashboard:

### Step 1: Deploy Backend Web Service
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Name**: `movie-watchlist-api`
   - **Language / Runtime**: `Node`
   - **Root Directory**: `backend`
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
4. Under **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `MONGO_URI` = `<your_mongodb_connection_string>`
5. Click **Create Web Service**. Wait for the service to deploy and copy the backend URL (e.g. `https://movie-watchlist-api.onrender.com`).

---

### Step 2: Deploy Frontend Static Site
1. In Render Dashboard, click **New +** -> **Static Site**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Name**: `movie-watchlist-ui`
   - **Root Directory**: `frontend`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://movie-watchlist-api.onrender.com` (your backend URL from Step 1)
5. Under **Redirects / Rewrites**, click **Add Rule**:
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
6. Click **Create Static Site**.

---

### Step 3: Link CORS (Optional but Recommended)
In your `movie-watchlist-api` Web Service settings:
- Add or update the environment variable:
  - `CLIENT_URL` = `https://movie-watchlist-ui.onrender.com`
*(Note: CORS is pre-configured to automatically accept any `*.onrender.com` subdomains in production as a fallback).*

---

## Deployment Option 3: All-in-One Web Service (Monolith)

If you only want a single Render service to conserve free tier hours:

1. Click **New +** -> **Web Service**.
2. Leave **Root Directory** blank (uses the repository root).
3. Set:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `MONGO_URI` = `<your_mongodb_connection_string>`
5. Click **Create Web Service**.
The Express backend will automatically build and serve the React application from the same domain with no CORS configuration needed!
