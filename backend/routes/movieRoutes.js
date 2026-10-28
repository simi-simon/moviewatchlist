
const express = require("express");
const router = express.Router();
const Movie = require("../models/Movie");
const Counter = require("../models/Counter");

const genres = ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Romance", "Thriller"];
const platforms = ["Netflix", "Prime Video", "Hotstar", "Theatre", "Other"];
const statuses = ["To Watch", "Watching", "Watched"];

function response(res, status, success, message, data = null) {
    return res.status(status).json({ success, message, data });
}

function validRating(rating) {
    return Number.isInteger(rating) && rating >= 1 && rating <= 10;
}

// ── ADD MOVIE ────────────────────────────────────────────────
router.post("/", async (req, res) => {
    try {
        let { title, genre, releaseYear, runtime, platform, priority, rating } = req.body;

        title = typeof title === "string" ? title.trim() : "";
        const curYear = new Date().getFullYear();

        if (
            !title ||
            !genres.includes(genre) ||
            !platforms.includes(platform) ||
            !Number.isInteger(releaseYear) ||
            releaseYear < 1950 ||
            releaseYear > curYear ||
            !Number.isInteger(runtime) ||
            runtime < 30 ||
            runtime > 300 ||
            !Number.isInteger(priority) ||
            priority < 1 ||
            priority > 5
        ) {
            return response(res, 400, false, "Invalid movie details. Please check all fields.");
        }

        // New movies start with status "To Watch" - rating must NOT be set
        if (rating !== undefined && rating !== null && rating !== "") {
            return response(res, 400, false, "Rating cannot be set for a movie in To Watch status");
        }

        // Check duplicate title & release year (case-insensitive)
        const duplicate = await Movie.findOne({
            title: { $regex: "^" + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" },
            releaseYear
        });

        if (duplicate) {
            return response(res, 409, false, "Movie with this title and year already exists");
        }

        const counter = await Counter.findOneAndUpdate(
            { year: releaseYear },
            { $inc: { sequence: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        const code = `MV-${releaseYear}-${String(counter.sequence).padStart(3, "0")}`;

        const movie = await Movie.create({
            code,
            title,
            genre,
            releaseYear,
            runtime,
            platform,
            priority,
            status: "To Watch",
            rating: null,
            watchedDate: null
        });

        return response(res, 201, true, "Movie added successfully", movie);
    } catch (err) {
        if (err.code === 11000) {
            return response(res, 409, false, "Movie with this title and year already exists");
        }
        return response(res, 500, false, "Failed to add movie");
    }
});

// ── WATCH NEXT ───────────────────────────────────────────────
router.get("/watch-next", async (req, res) => {
    try {
        const movie = await Movie.findOne({ status: "To Watch" })
            .sort({ priority: -1, runtime: 1, createdAt: -1 });

        if (!movie) {
            return response(res, 404, false, "No movies available to watch next");
        }

        return response(res, 200, true, "Your next movie", movie);
    } catch (err) {
        return response(res, 500, false, "Failed to find next movie");
    }
});

// ── STATISTICS ───────────────────────────────────────────────
router.get("/stats", async (req, res) => {
    try {
        const grouped = await Movie.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        const statusCounts = {
            "To Watch": 0,
            "Watching": 0,
            "Watched": 0
        };

        grouped.forEach((item) => {
            if (item._id && statusCounts[item._id] !== undefined) {
                statusCounts[item._id] = item.count;
            }
        });

        const watched = await Movie.aggregate([
            { $match: { status: "Watched" } },
            {
                $group: {
                    _id: null,
                    totalMinutes: { $sum: "$runtime" },
                    averageRating: { $avg: "$rating" }
                }
            }
        ]);

        const genresWatched = await Movie.aggregate([
            { $match: { status: "Watched" } },
            { $group: { _id: "$genre", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 1 }
        ]);

        const totalMinutes = watched[0]?.totalMinutes || 0;
        const averageRating = watched[0]?.averageRating || 0;

        return response(res, 200, true, "Statistics retrieved", {
            statusCounts,
            totalHoursWatched: Math.round((totalMinutes / 60) * 10) / 10,
            averageRating: Math.round(averageRating * 10) / 10,
            mostWatchedGenre: genresWatched[0]?._id || null
        });
    } catch (err) {
        return response(res, 500, false, "Failed to calculate statistics");
    }
});

// ── VIEW, SEARCH, FILTER AND PAGINATE ────────────────────────
router.get("/", async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = 6;

        if (!Number.isInteger(page) || page < 1) {
            return response(res, 400, false, "Page must be a positive integer");
        }

        const filter = {};

        if (req.query.status) {
            if (!statuses.includes(req.query.status)) {
                return response(res, 400, false, "Invalid status");
            }
            filter.status = req.query.status;
        }

        if (req.query.genre) {
            if (!genres.includes(req.query.genre)) {
                return response(res, 400, false, "Invalid genre");
            }
            filter.genre = req.query.genre;
        }

        if (req.query.search) {
            filter.title = {
                $regex: req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                $options: "i"
            };
        }

        const total = await Movie.countDocuments(filter);

        // Sorting: Movies in "To Watch" status must be sorted by Priority (high to low) first.
        // We use an aggregation pipeline with status ordering:
        // 1: To Watch (sorted by priority DESC, then runtime ASC)
        // 2: Watching (sorted by priority DESC)
        // 3: Watched (sorted by watchedDate DESC or createdAt DESC)
        const movies = await Movie.aggregate([
            { $match: filter },
            {
                $addFields: {
                    statusWeight: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$status", "To Watch"] }, then: 1 },
                                { case: { $eq: ["$status", "Watching"] }, then: 2 },
                                { case: { $eq: ["$status", "Watched"] }, then: 3 }
                            ],
                            default: 4
                        }
                    }
                }
            },
            {
                $sort: {
                    statusWeight: 1,
                    priority: -1,
                    runtime: 1,
                    createdAt: -1
                }
            },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { statusWeight: 0 } }
        ]);

        return response(res, 200, true, "Movies retrieved", {
            movies,
            currentPage: page,
            totalPages: Math.ceil(total / limit) || 1,
            totalMovies: total
        });
    } catch (err) {
        return response(res, 500, false, "Failed to retrieve movies");
    }
});

// ── GET ONE MOVIE ────────────────────────────────────────────
router.get("/:id", async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return response(res, 400, false, "Invalid movie ID");
        }

        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            return response(res, 404, false, "Movie not found");
        }

        return response(res, 200, true, "Movie retrieved", movie);
    } catch (err) {
        return response(res, 500, false, "Failed to retrieve movie");
    }
});

// ── EDIT MOVIE DETAILS ───────────────────────────────────────
// Title, Genre, Runtime, Platform, Priority can be edited. Code and ReleaseYear cannot.
// Rating can be edited if movie is in "Watched" status.
router.put("/:id", async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return response(res, 400, false, "Invalid movie ID");
        }

        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            return response(res, 404, false, "Movie not found");
        }

        const { title, genre, runtime, platform, priority, rating } = req.body;

        if (title !== undefined && (typeof title !== "string" || !title.trim())) {
            return response(res, 400, false, "Title is required");
        }

        if (genre !== undefined && !genres.includes(genre)) {
            return response(res, 400, false, "Invalid genre");
        }

        if (runtime !== undefined && (!Number.isInteger(runtime) || runtime < 30 || runtime > 300)) {
            return response(res, 400, false, "Runtime must be 30 to 300 minutes");
        }

        if (platform !== undefined && !platforms.includes(platform)) {
            return response(res, 400, false, "Invalid platform");
        }

        if (priority !== undefined && (!Number.isInteger(priority) || priority < 1 || priority > 5)) {
            return response(res, 400, false, "Priority must be 1 to 5");
        }

        // Rating can only be edited for Watched movies
        if (rating !== undefined && rating !== null && rating !== "") {
            if (movie.status !== "Watched") {
                return response(res, 400, false, "Rating can only be set or edited for Watched movies");
            }
            const numRating = Number(rating);
            if (!validRating(numRating)) {
                return response(res, 400, false, "Rating must be an integer between 1 and 10");
            }
            movie.rating = numRating;
        }

        if (title !== undefined) {
            const cleanTitle = title.trim();

            const duplicate = await Movie.findOne({
                _id: { $ne: movie._id },
                title: {
                    $regex: "^" + cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
                    $options: "i"
                },
                releaseYear: movie.releaseYear
            });

            if (duplicate) {
                return response(res, 409, false, "Movie with this title and year already exists");
            }

            movie.title = cleanTitle;
        }

        if (genre !== undefined) movie.genre = genre;
        if (runtime !== undefined) movie.runtime = runtime;
        if (platform !== undefined) movie.platform = platform;
        if (priority !== undefined) movie.priority = priority;

        await movie.save();

        return response(res, 200, true, "Movie updated successfully", movie);
    } catch (err) {
        return response(res, 400, false, "Failed to update movie");
    }
});

// ── EDIT RATING (FOR WATCHED MOVIES) ─────────────────────────
router.patch("/:id/rating", async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return response(res, 400, false, "Invalid movie ID");
        }

        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            return response(res, 404, false, "Movie not found");
        }

        if (movie.status !== "Watched") {
            return response(res, 400, false, "Rating can only be set or edited for Watched movies");
        }

        const { rating } = req.body;
        const numRating = Number(rating);

        if (!validRating(numRating)) {
            return response(res, 400, false, "Rating must be an integer between 1 and 10");
        }

        movie.rating = numRating;
        await movie.save();

        return response(res, 200, true, "Rating updated successfully", movie);
    } catch (err) {
        return response(res, 500, false, "Failed to update rating");
    }
});

// ── STATUS TRANSITION WORKFLOW ───────────────────────────────
// Allowed transitions:
// To Watch → Watching or Watched
// Watching → Watched or To Watch
// Watched is final and cannot be changed
router.patch("/:id/status", async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return response(res, 400, false, "Invalid movie ID");
        }

        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            return response(res, 404, false, "Movie not found");
        }

        const { status, rating } = req.body;

        // If movie is already Watched: status cannot be changed.
        if (movie.status === "Watched") {
            if (status && status !== "Watched") {
                return response(res, 400, false, "Watched status is final and cannot be changed");
            }
            // If user passed rating to update rating:
            if (rating !== undefined && rating !== null && rating !== "") {
                const numRating = Number(rating);
                if (!validRating(numRating)) {
                    return response(res, 400, false, "Rating must be an integer between 1 and 10");
                }
                movie.rating = numRating;
                await movie.save();
                return response(res, 200, true, "Rating updated successfully", movie);
            }
            return response(res, 400, false, "Watched status is final and cannot be changed");
        }

        const allowed = {
            "To Watch": ["Watching", "Watched"],
            "Watching": ["To Watch", "Watched"]
        };

        if (!status || !allowed[movie.status]?.includes(status)) {
            return response(res, 400, false, `Invalid status transition from "${movie.status}" to "${status}"`);
        }

        if (status === "Watched") {
            if (rating === undefined || rating === null || rating === "") {
                return response(res, 400, false, "Rating from 1 to 10 is mandatory when marking a movie as Watched");
            }

            const numRating = Number(rating);
            if (!validRating(numRating)) {
                return response(res, 400, false, "Rating must be an integer between 1 and 10");
            }

            movie.rating = numRating;
            movie.watchedDate = new Date();
        } else {
            // Transitioning to "To Watch" or "Watching" - rating cannot be set
            if (rating !== undefined && rating !== null && rating !== "") {
                return response(res, 400, false, "Rating can only be set for movies in Watched status");
            }
        }

        movie.status = status;
        await movie.save();

        return response(res, 200, true, `Movie status updated to "${status}"`, movie);
    } catch (error) {
        return response(res, 500, false, error.message);
    }
});

// ── DELETE MOVIE ─────────────────────────────────────────────
// Movies in "Watching" status cannot be deleted
router.delete("/:id", async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return response(res, 400, false, "Invalid movie ID");
        }

        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            return response(res, 404, false, "Movie not found");
        }

        if (movie.status === "Watching") {
            return response(res, 400, false, "Cannot delete a movie currently being watched");
        }

        await movie.deleteOne();

        return response(res, 200, true, "Movie deleted successfully", movie);
    } catch (err) {
        return response(res, 500, false, "Failed to delete movie");
    }
});

module.exports = router;
