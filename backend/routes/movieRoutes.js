
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

// ADD MOVIE
router.post("/", async (req, res) => {
    try {
        let { title, genre, releaseYear, runtime, platform, priority } = req.body;

        title = typeof title === "string" ? title.trim() : "";

        if (!title || !genres.includes(genre) ||
            !platforms.includes(platform) ||
            !Number.isInteger(releaseYear) ||
            releaseYear < 1950 ||
            releaseYear > new Date().getFullYear() ||
            !Number.isInteger(runtime) || runtime < 30 || runtime > 300 ||
            !Number.isInteger(priority) || priority < 1 || priority > 5) {
            return response(res, 400, false, "Invalid movie details");
        }

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
            code, title, genre, releaseYear, runtime, platform, priority,
            status: "To Watch"
        });

        return response(res, 201, true, "Movie added successfully", movie);
    } catch (err) {
        if (err.code === 11000) {
            return response(res, 409, false, "Duplicate movie code or movie already exists");
        }
        return response(res, 500, false, "Failed to add movie");
    }
});

// WATCH NEXT
router.get("/watch-next", async (req, res) => {
    try {
        const movie = await Movie.findOne({ status: "To Watch" })
            .sort({ priority: -1, runtime: 1 });

        if (!movie) {
            return response(res, 404, false, "No movies available to watch next");
        }

        return response(res, 200, true, "Your next movie", movie);
    } catch (err) {
        return response(res, 500, false, "Failed to find next movie");
    }
});

// STATISTICS
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

        grouped.forEach(item => {
            statusCounts[item._id] = item.count;
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
            totalHoursWatched: Math.round(totalMinutes / 60 * 10) / 10,
            averageRating: Math.round(averageRating * 10) / 10,
            mostWatchedGenre: genresWatched[0]?._id || null
        });
    } catch (err) {
        return response(res, 500, false, "Failed to calculate statistics");
    }
});

// VIEW, SEARCH, FILTER AND PAGINATE
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
            filter.title = { $regex: req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
        }

        const total = await Movie.countDocuments(filter);

        const movies = await Movie.find(filter)
            .sort({ status: 1, priority: -1, runtime: 1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return response(res, 200, true, "Movies retrieved", {
            movies,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalMovies: total
        });
    } catch (err) {
        return response(res, 500, false, "Failed to retrieve movies");
    }
});

// GET ONE MOVIE
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

// EDIT MOVIE DETAILS
router.put("/:id", async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return response(res, 400, false, "Invalid movie ID");
        }

        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            return response(res, 404, false, "Movie not found");
        }

        const { title, genre, runtime, platform, priority } = req.body;

        if (title !== undefined &&
            (typeof title !== "string" || !title.trim())) {
            return response(res, 400, false, "Title is required");
        }

        if (genre !== undefined && !genres.includes(genre)) {
            return response(res, 400, false, "Invalid genre");
        }

        if (runtime !== undefined &&
            (!Number.isInteger(runtime) || runtime < 30 || runtime > 300)) {
            return response(res, 400, false, "Runtime must be 30 to 300 minutes");
        }

        if (platform !== undefined && !platforms.includes(platform)) {
            return response(res, 400, false, "Invalid platform");
        }

        if (priority !== undefined &&
            (!Number.isInteger(priority) || priority < 1 || priority > 5)) {
            return response(res, 400, false, "Priority must be 1 to 5");
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

// CHANGE STATUS OR EDIT A WATCHED MOVIE'S RATING

router.patch("/:id/status", async (req, res) => {
    try {
        const { status, rating } = req.body;
        const movie = await Movie.findById(req.params.id);

        if (!movie) {
            return res.status(404).json({
                success: false,
                message: "Movie not found"
            });
        }

        const allowed = {
            "To Watch": ["Watching", "Watched"],
            "Watching": ["To Watch", "Watched"],
            "Watched": []
        };

        if (!allowed[movie.status]?.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status transition"
            });
        }

        if (status === "Watched") {
            if (rating === undefined || rating === null || rating === "") {
                return res.status(400).json({
                    success: false,
                    message: "Rating is required when marking a movie Watched"
                });
            }

            if (!Number.isFinite(Number(rating)) ||
                Number(rating) < 1 || Number(rating) > 10) {
                return res.status(400).json({
                    success: false,
                    message: "Rating must be between 1 and 10"
                });
            }

            movie.rating = Number(rating);
            movie.watchedDate = new Date();
        }

        movie.status = status;
        await movie.save();

        res.json({
            success: true,
            message: "Movie status updated",
            data: movie
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// DELETE MOVIE
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
