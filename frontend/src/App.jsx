import { useEffect, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:5000/api/movies";

const GENRES = ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Romance", "Thriller"];
const PLATFORMS = ["Netflix", "Prime Video", "Hotstar", "Theatre", "Other"];
const STATUSES = ["To Watch", "Watching", "Watched"];

function App() {
  // Movie list + pagination
  const [movies, setMovies] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMovies, setTotalMovies] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [filterGenre, setFilterGenre] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Add-movie form
  const [form, setForm] = useState({
    title: "",
    genre: "Action",
    releaseYear: new Date().getFullYear(),
    runtime: 120,
    platform: "Netflix",
    priority: 3,
  });
  const [formMessage, setFormMessage] = useState({ text: "", isError: false });

  // General feedback message
  const [globalMessage, setGlobalMessage] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editMessage, setEditMessage] = useState("");

  // Watch Next state
  const [watchNext, setWatchNext] = useState(null);
  const [watchNextMsg, setWatchNextMsg] = useState("");
  const [watchNextLoading, setWatchNextLoading] = useState(false);

  // Stats state
  const [stats, setStats] = useState(null);

  // ── Load movies ──────────────────────────────────────────
  async function fetchMovies(page = 1, srch = search, genre = filterGenre, status = filterStatus) {
    try {
      const p = new URLSearchParams({ page });
      if (srch && srch.trim()) p.set("search", srch.trim());
      if (genre) p.set("genre", genre);
      if (status) p.set("status", status);

      const res = await fetch(`${API}?${p}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Could not load movies");

      setMovies(result.data.movies || []);
      setCurrentPage(result.data.currentPage || 1);
      setTotalPages(result.data.totalPages || 1);
      setTotalMovies(result.data.totalMovies || 0);
    } catch (err) {
      setGlobalMessage("Error: " + err.message);
    }
  }

  // ── Watch Next ───────────────────────────────────────────
  async function loadWatchNext() {
    setWatchNextLoading(true);
    setWatchNextMsg("");
    setWatchNext(null);
    try {
      const res = await fetch(`${API}/watch-next`);
      const result = await res.json();
      if (res.status === 404) {
        setWatchNextMsg(result.message || "No movies available to watch next");
        return;
      }
      if (!res.ok) throw new Error(result.message || "Failed to fetch recommendation");
      setWatchNext(result.data);
    } catch (err) {
      setWatchNextMsg("Error: " + err.message);
    } finally {
      setWatchNextLoading(false);
    }
  }

  // ── Stats ────────────────────────────────────────────────
  async function loadStats() {
    try {
      const res = await fetch(`${API}/stats`);
      const result = await res.json();
      if (!res.ok) return;
      setStats(result.data);
    } catch (err) {
      console.error("Stats load failed:", err);
    }
  }

  // Refresh all dashboard data
  function refreshAll(page = currentPage) {
    fetchMovies(page, search, filterGenre, filterStatus);
    loadStats();
    loadWatchNext();
  }

  // Effect to load movies when search, genre, status, or page changes
  useEffect(() => {
    let isMounted = true;
    const p = new URLSearchParams({ page: currentPage });
    if (search && search.trim()) p.set("search", search.trim());
    if (filterGenre) p.set("genre", filterGenre);
    if (filterStatus) p.set("status", filterStatus);

    fetch(`${API}?${p}`)
      .then((r) => r.json())
      .then((result) => {
        if (!isMounted) return;
        if (result.success && result.data) {
          setMovies(result.data.movies || []);
          setTotalPages(result.data.totalPages || 1);
          setTotalMovies(result.data.totalMovies || 0);
        } else {
          setGlobalMessage(result.message || "Could not load movies");
        }
      })
      .catch((err) => {
        if (isMounted) setGlobalMessage("Error: " + err.message);
      });

    return () => {
      isMounted = false;
    };
  }, [search, filterGenre, filterStatus, currentPage]);

  // Initial load for Stats and Watch Next
  useEffect(() => {
    let isMounted = true;
    fetch(`${API}/stats`)
      .then((r) => r.json())
      .then((result) => {
        if (isMounted && result.success && result.data) {
          setStats(result.data);
        }
      })
      .catch(() => {});

    fetch(`${API}/watch-next`)
      .then((r) => r.json())
      .then((result) => {
        if (!isMounted) return;
        if (result.success && result.data) {
          setWatchNext(result.data);
        } else {
          setWatchNextMsg(result.message || "No movies available to watch next");
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  function handleFilterChange(setter) {
    return (e) => {
      setter(e.target.value);
      setCurrentPage(1);
    };
  }

  function clearFilters() {
    setSearch("");
    setFilterGenre("");
    setFilterStatus("");
    setCurrentPage(1);
  }

  // ── Add movie ────────────────────────────────────────────
  function updateForm(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function addMovie(e) {
    e.preventDefault();
    setFormMessage({ text: "", isError: false });

    const releaseYear = Number(form.releaseYear);
    const runtime = Number(form.runtime);
    const priority = Number(form.priority);
    const curYear = new Date().getFullYear();

    // Frontend validation
    if (!form.title.trim()) {
      setFormMessage({ text: "Title is required", isError: true });
      return;
    }
    if (releaseYear < 1950 || releaseYear > curYear) {
      setFormMessage({ text: `Release year must be between 1950 and ${curYear}`, isError: true });
      return;
    }
    if (runtime < 30 || runtime > 300) {
      setFormMessage({ text: "Runtime must be between 30 and 300 minutes", isError: true });
      return;
    }

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
          releaseYear,
          runtime,
          priority,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setFormMessage({ text: result.message || "Could not add movie", isError: true });
        return;
      }

      setFormMessage({ text: `"${result.data.title}" added successfully! Code: ${result.data.code}`, isError: false });
      setForm({
        title: "",
        genre: "Action",
        releaseYear: curYear,
        runtime: 120,
        platform: "Netflix",
        priority: 3,
      });

      setCurrentPage(1);
      refreshAll(1);
    } catch (err) {
      setFormMessage({ text: "Error: " + err.message, isError: true });
    }
  }

  // ── Status change via Dropdown ───────────────────────────
  async function handleStatusDropdown(movie, nextStatus) {
    let rating = null;

    if (nextStatus === "Watched") {
      const input = window.prompt(`Rate "${movie.title}" from 1 to 10 (Mandatory):`);
      if (input === null) return; // User cancelled

      const r = Number(input.trim());
      if (!Number.isInteger(r) || r < 1 || r > 10) {
        window.alert("Rating is mandatory and must be an integer between 1 and 10.");
        return;
      }
      rating = r;
    }

    try {
      const res = await fetch(`${API}/${movie._id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, rating }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Status update failed");

      setGlobalMessage(result.message);
      refreshAll();
    } catch (err) {
      setGlobalMessage("Error: " + err.message);
    }
  }

  // ── Edit Rating for Watched movie ────────────────────────
  async function editRating(movie) {
    const input = window.prompt(`Edit rating for "${movie.title}" (1 to 10):`, movie.rating || 5);
    if (input === null) return;

    const r = Number(input.trim());
    if (!Number.isInteger(r) || r < 1 || r > 10) {
      window.alert("Rating must be an integer between 1 and 10.");
      return;
    }

    try {
      const res = await fetch(`${API}/${movie._id}/rating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: r }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to update rating");

      setGlobalMessage(`Rating for "${movie.title}" updated to ${r}/10`);
      refreshAll();
    } catch (err) {
      setGlobalMessage("Error: " + err.message);
    }
  }

  // ── Delete Movie ─────────────────────────────────────────
  async function deleteMovie(movie) {
    if (movie.status === "Watching") {
      window.alert("Cannot delete a movie currently being watched.");
      return;
    }

    if (!window.confirm(`Delete "${movie.title}" (${movie.code})? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${API}/${movie._id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Delete failed");

      setGlobalMessage(result.message);
      const newPage = movies.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setCurrentPage(newPage);
      refreshAll(newPage);
    } catch (err) {
      setGlobalMessage("Error: " + err.message);
    }
  }

  // ── Edit Movie details ───────────────────────────────────
  function startEdit(movie) {
    setEditingId(movie._id);
    setEditForm({
      title: movie.title,
      genre: movie.genre,
      runtime: movie.runtime,
      platform: movie.platform,
      priority: movie.priority,
      rating: movie.rating || 5,
    });
    setEditMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setEditMessage("");
  }

  async function saveEdit(movie) {
    setEditMessage("");
    const runtime = Number(editForm.runtime);
    const priority = Number(editForm.priority);

    if (!editForm.title || !editForm.title.trim()) {
      setEditMessage("Title is required");
      return;
    }
    if (runtime < 30 || runtime > 300) {
      setEditMessage("Runtime must be between 30 and 300 minutes");
      return;
    }

    const payload = {
      title: editForm.title.trim(),
      genre: editForm.genre,
      runtime,
      platform: editForm.platform,
      priority,
    };

    if (movie.status === "Watched") {
      const r = Number(editForm.rating);
      if (!Number.isInteger(r) || r < 1 || r > 10) {
        setEditMessage("Rating must be an integer between 1 and 10");
        return;
      }
      payload.rating = r;
    }

    try {
      const res = await fetch(`${API}/${movie._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Update failed");

      setGlobalMessage(result.message);
      setEditingId(null);
      refreshAll();
    } catch (err) {
      setEditMessage("Error: " + err.message);
    }
  }

  const statusSlug = { "To Watch": "to-watch", Watching: "watching", Watched: "watched" };

  return (
    <main className="app">
      <header>
        <h1>🎬 Movie Watchlist Manager</h1>
        <p>Plan what to watch, track what you are watching, and rate what you have finished.</p>
      </header>

      {/* Global alert feedback banner */}
      {globalMessage && (
        <div className="alert-banner">
          <span>{globalMessage}</span>
          <button className="btn-close" onClick={() => setGlobalMessage("")}>✕</button>
        </div>
      )}

      {/* ── Statistics Dashboard ── */}
      {stats && (
        <section className="stats-section">
          <h2>Statistics Dashboard</h2>
          <div className="stats-grid">
            <div className="stat-box">
              <span className="stat-num">{stats.statusCounts["To Watch"]}</span>
              <span className="stat-label">To Watch</span>
            </div>
            <div className="stat-box">
              <span className="stat-num">{stats.statusCounts["Watching"]}</span>
              <span className="stat-label">Watching</span>
            </div>
            <div className="stat-box">
              <span className="stat-num">{stats.statusCounts["Watched"]}</span>
              <span className="stat-label">Watched</span>
            </div>
            <div className="stat-box">
              <span className="stat-num">{stats.totalHoursWatched}h</span>
              <span className="stat-label">Total Hours Watched</span>
            </div>
            <div className="stat-box">
              <span className="stat-num">{stats.averageRating > 0 ? stats.averageRating + "/10" : "—"}</span>
              <span className="stat-label">Avg Rating (Watched)</span>
            </div>
            <div className="stat-box">
              <span className="stat-num stat-genre">{stats.mostWatchedGenre || "—"}</span>
              <span className="stat-label">Top Watched Genre</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Watch Next Section ── */}
      <section className="watch-next-section">
        <div className="watch-next-header">
          <h2>Watch Next Recommendation</h2>
          <button
            className="btn-watch-next"
            onClick={loadWatchNext}
            disabled={watchNextLoading}
          >
            {watchNextLoading ? "Finding..." : "🎬 What should I watch next?"}
          </button>
        </div>
        {watchNext ? (
          <div className="watch-next-card">
            <div className="watch-next-top">
              <span className="status-badge to-watch">To Watch</span>
              <span className="watch-next-code">{watchNext.code}</span>
            </div>
            <h3>{watchNext.title}</h3>
            <div className="watch-next-meta">
              <span><strong>Genre:</strong> {watchNext.genre}</span>
              <span><strong>Release Year:</strong> {watchNext.releaseYear}</span>
              <span><strong>Runtime:</strong> {watchNext.runtime} min</span>
              <span><strong>Platform:</strong> {watchNext.platform}</span>
              <span><strong>Priority:</strong> {watchNext.priority}/5</span>
            </div>
          </div>
        ) : (
          <p className="section-note">{watchNextMsg || "Click the button above to get your next movie recommendation!"}</p>
        )}
      </section>

      {/* ── Add Movie Form ── */}
      <section className="panel">
        <h2>Add a Movie</h2>
        <form onSubmit={addMovie}>
          <label>
            Title
            <input
              name="title"
              value={form.title}
              onChange={updateForm}
              required
              placeholder="e.g. Interstellar"
            />
          </label>
          <label>
            Genre
            <select name="genre" value={form.genre} onChange={updateForm}>
              {GENRES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Release Year (1950 - {new Date().getFullYear()})
            <input
              name="releaseYear"
              type="number"
              min="1950"
              max={new Date().getFullYear()}
              value={form.releaseYear}
              onChange={updateForm}
              required
            />
          </label>
          <label>
            Runtime (30 - 300 minutes)
            <input
              name="runtime"
              type="number"
              min="30"
              max="300"
              value={form.runtime}
              onChange={updateForm}
              required
            />
          </label>
          <label>
            Platform
            <select name="platform" value={form.platform} onChange={updateForm}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Priority (1 to 5, where 5 is highest)
            <select name="priority" value={form.priority} onChange={updateForm}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{n} {n === 5 ? "(Highest)" : n === 1 ? "(Lowest)" : ""}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary">Add Movie</button>
        </form>
        {formMessage.text && (
          <p
            role="status"
            className={formMessage.isError ? "form-msg error" : "form-msg success"}
          >
            {formMessage.text}
          </p>
        )}
      </section>

      {/* ── Movie Collection ── */}
      <section>
        <h2>Your Movies ({totalMovies})</h2>

        {/* Search + Filter Controls */}
        <div className="controls">
          <input
            className="search-input"
            type="search"
            placeholder="Search by title…"
            value={search}
            onChange={handleFilterChange(setSearch)}
          />
          <select value={filterGenre} onChange={handleFilterChange(setFilterGenre)}>
            <option value="">All Genres</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={handleFilterChange(setFilterStatus)}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(search || filterGenre || filterStatus) && (
            <button className="btn-secondary btn-clear" onClick={clearFilters}>
              ✕ Clear Filters
            </button>
          )}
        </div>

        {/* Movie Cards */}
        <div className="movie-list">
          {movies.map((movie) => (
            <article className={`movie-card status-${statusSlug[movie.status]}`} key={movie._id}>
              {editingId === movie._id ? (
                <div className="edit-form">
                  <p className="edit-title">Editing: {movie.title}</p>
                  <p className="edit-readonly">Code: <strong>{movie.code}</strong> (Immutable)</p>
                  <p className="edit-readonly">Release Year: <strong>{movie.releaseYear}</strong> (Immutable)</p>

                  <label>
                    Title
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Genre
                    <select
                      value={editForm.genre}
                      onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                    >
                      {GENRES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Runtime (30 - 300 min)
                    <input
                      type="number"
                      min="30"
                      max="300"
                      value={editForm.runtime}
                      onChange={(e) => setEditForm({ ...editForm, runtime: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Platform
                    <select
                      value={editForm.platform}
                      onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })}
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Priority (1 to 5)
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>

                  {movie.status === "Watched" && (
                    <label>
                      Rating (1 to 10)
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={editForm.rating}
                        onChange={(e) => setEditForm({ ...editForm, rating: e.target.value })}
                        required
                      />
                    </label>
                  )}

                  {editMessage && <p className="edit-error">{editMessage}</p>}
                  <div className="card-actions">
                    <button className="btn-primary" onClick={() => saveEdit(movie)}>Save Changes</button>
                    <button className="btn-ghost" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="card-header">
                    <span className={`status-badge ${statusSlug[movie.status]}`}>{movie.status}</span>
                    <span className="movie-code-badge">{movie.code}</span>
                  </div>

                  <h3>{movie.title}</h3>
                  <p><strong>Genre:</strong> {movie.genre} · <strong>Year:</strong> {movie.releaseYear}</p>
                  <p><strong>Runtime:</strong> {movie.runtime} min · <strong>Platform:</strong> {movie.platform}</p>
                  <p><strong>Priority:</strong> {movie.priority}/5</p>

                  {/* Watched details & Rating */}
                  {movie.status === "Watched" && (
                    <div className="watched-info">
                      <p className="rating-tag">⭐ Rating: <strong>{movie.rating}/10</strong></p>
                      {movie.watchedDate && (
                        <p className="watched-date">Watched: {new Date(movie.watchedDate).toLocaleDateString()}</p>
                      )}
                      <button className="btn-ghost btn-sm" onClick={() => editRating(movie)}>
                        ✏️ Edit Rating
                      </button>
                    </div>
                  )}

                  {/* Status Workflow Dropdown (Shows ONLY valid next statuses) */}
                  {movie.status === "To Watch" && (
                    <div className="status-dropdown-wrap">
                      <label className="dropdown-label">Next Status:</label>
                      <select
                        className="status-dropdown"
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          e.target.value = "";
                          if (val) handleStatusDropdown(movie, val);
                        }}
                      >
                        <option value="" disabled>Change status to...</option>
                        <option value="Watching">Watching</option>
                        <option value="Watched">Watched</option>
                      </select>
                    </div>
                  )}

                  {movie.status === "Watching" && (
                    <div className="status-dropdown-wrap">
                      <label className="dropdown-label">Next Status:</label>
                      <select
                        className="status-dropdown"
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          e.target.value = "";
                          if (val) handleStatusDropdown(movie, val);
                        }}
                      >
                        <option value="" disabled>Change status to...</option>
                        <option value="To Watch">To Watch</option>
                        <option value="Watched">Watched</option>
                      </select>
                    </div>
                  )}

                  {movie.status === "Watched" && (
                    <div className="status-final-wrap">
                      <span className="status-final-note">🔒 Watched is final</span>
                    </div>
                  )}

                  <div className="card-actions">
                    <button className="btn-ghost" onClick={() => startEdit(movie)}>Edit</button>
                    {movie.status === "Watching" ? (
                      <button
                        className="btn-danger"
                        disabled
                        title="Cannot delete a movie currently being watched"
                      >
                        Delete (Locked)
                      </button>
                    ) : (
                      <button className="btn-danger" onClick={() => deleteMovie(movie)}>
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </article>
          ))}
        </div>

        {movies.length === 0 && (
          <p className="empty-state">
            {search || filterGenre || filterStatus
              ? "No movies match your search or filters."
              : "No movies yet. Add your first movie using the form above."}
          </p>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="btn-secondary"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              ← Previous
            </button>
            <span className="page-info">Page {currentPage} of {totalPages}</span>
            <button
              className="btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
