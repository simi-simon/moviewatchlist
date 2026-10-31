const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const movieRoutes = require("./routes/movieRoutes");
require("dotenv").config();

const app = express();

// Security HTTP headers with CSP configured to allow Google Fonts and client styles
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:", "http:"],
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Rate Limiting to prevent brute-force / DoS attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // max 300 requests per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes."
    }
});
app.use(limiter);

// Specific CORS configuration with support for multiple origins & Render URLs
const rawClientUrl = process.env.CLIENT_URL || "";
const clientOrigins = rawClientUrl
    .split(",")
    .map(url => url.trim().replace(/\/$/, ""))
    .filter(Boolean);

const allowedOrigins = [
    ...clientOrigins,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or in non-production
        if (!origin || process.env.NODE_ENV !== "production") {
            return callback(null, true);
        }
        const normalizedOrigin = origin.replace(/\/$/, "");
        if (
            allowedOrigins.includes("*") ||
            allowedOrigins.includes(normalizedOrigin) ||
            normalizedOrigin.endsWith(".onrender.com")
        ) {
            return callback(null, true);
        }
        callback(new Error(`CORS policy violation: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

// Body parser with strict size limit to prevent Denial of Service via large payloads
app.use(express.json({ limit: "20kb" }));

// If frontend build exists, serve static assets (supports monolithic single-service hosting on Render)
const frontendDist = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
}

// Detailed system and DB health check
app.get("/api/health", (req, res) => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    const dbState = states[mongoose.connection.readyState] || "unknown";
    const isConnected = mongoose.connection.readyState === 1;

    res.status(isConnected ? 200 : 503).json({
        success: isConnected,
        status: isConnected ? "healthy" : "degraded",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: {
            state: dbState,
            connected: isConnected,
            note: isConnected ? "MongoDB connected" : "MongoDB not connected. If using MongoDB Atlas, please verify IP whitelist."
        }
    });
});

// Guard middleware for /api/movies: fail fast if DB is disconnected instead of buffering/hanging
app.use("/api/movies", (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            success: false,
            message: "Database is currently disconnected. If using MongoDB Atlas, make sure your current IP address is whitelisted in MongoDB Atlas Network Access.",
            dbState: ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] || "unknown"
        });
    }
    next();
});

// Mount movie routes
app.use("/api/movies", movieRoutes);

// If frontend build exists, serve index.html for non-API client routes (SPA routing)
if (fs.existsSync(frontendDist)) {
    app.get(/^(?!\/api).*/, (req, res) => {
        res.sendFile(path.join(frontendDist, "index.html"));
    });
} else {
    // Root health check endpoint for standalone API
    app.get("/", (req, res) => {
        res.json({
            success: true,
            message: "Movie Watchlist API is running"
        });
    });
}

// Centralized 404 handler for unmatched routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Centralized error handler to prevent stack trace leaks
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.message);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message
    });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : (process.env.HOST || "0.0.0.0");

// Resilient MongoDB connection with auto-retry
let retryTimeout = null;
let isConnecting = false;

const connectWithRetry = async () => {
    if (!process.env.MONGO_URI) {
        console.error("CRITICAL: MONGO_URI is missing from environment variables!");
        return;
    }

    if (isConnecting || mongoose.connection.readyState === 1) {
        return;
    }

    isConnecting = true;
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log("MongoDB connected successfully");
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }
    } catch (err) {
        console.error("MongoDB connection error:", err.message);
        if (err.message.includes("SSL alert number 80") || err.message.includes("whitelist")) {
            console.error("------------------------------------------------------------------");
            console.error("ATLAS IP ACCESS REQUIRED: MongoDB Atlas rejected the TLS connection.");
            console.error("Add your IP to MongoDB Atlas Network Access -> IP Access List.");
            console.error("------------------------------------------------------------------");
        }
        if (!retryTimeout) {
            retryTimeout = setTimeout(() => {
                retryTimeout = null;
                connectWithRetry();
            }, 8000);
        }
    } finally {
        isConnecting = false;
    }
};

mongoose.connection.on("disconnected", () => {
    if (mongoose.connection.readyState === 0 && !retryTimeout && !isConnecting) {
        console.warn("MongoDB connection lost. Triggering reconnection attempt...");
        retryTimeout = setTimeout(() => {
            retryTimeout = null;
            connectWithRetry();
        }, 5000);
    }
});

const server = app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    connectWithRetry();
});

// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully...");
    server.close(() => {
        mongoose.connection.close(false).then(() => {
            console.log("Server and MongoDB connections closed.");
            process.exit(0);
        });
    });
});
