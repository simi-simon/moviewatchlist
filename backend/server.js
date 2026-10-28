
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const movieRoutes = require("./routes/movieRoutes");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Movie Watchlist API is running"
    });
});

app.use("/api/movies", movieRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, "127.0.0.1", () => {
    console.log(`Server running on port ${PORT}`);

    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("MongoDB connected successfully"))
        .catch((err) => console.error("MongoDB error:", err.message));
});
