
import { useEffect, useState, useCallback } from "react";
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
  const [message, setMessage] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editMessage, setEditMessage] = useState("");

  // Watch Next
  const [watchNext, setWatchNext] = useState(null);
  const [watchNextMsg, setWatchNextMsg] = useState("");

  // Stats
  const [stats, setStats] = useState(null);

  // ── Load movies ──────────────────────────────────────────
  async function loadMovies(page, srch, genre, status) {
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
      setMessage("Error: " + err.message);
    }
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    loadMovies(1, search, filterGenre, filterStatus);
  }, [search, filterGenre, filterStatus]);

  function goToPage(page) {
    loadMovies(page, search, filterGenre, filterStatus);
  }

  // ── Watch Next ───────────────────────────────────────────
  async function loadWatchNext() {
    setWatchNextMsg("");
    setWatchNext(null);
    try {
      const res = await fetch(`${API}/watch-next`);
      const result = await res.json();
      if (res.status === 404) { setWatchNextMsg(result.message); return; }
      if (!res.ok) throw new Error(result.message || "Failed");
      setWatchNext(result.data);
    } catch (err) {
      setWatchNextMsg("Error: " + err.message);
    }
  }

  // ── Stats ────────────────────────────────────────────────
  async function loadStats() {
    try {
      const res = await fetch(`${API}/stats`);
      const result = await res.json();
      if (!res.ok) return;
      setStats(result.data);
    } catch (_) {}
  }

  useEffect(() => { loadWatchNext(); loadStats(); }, []);

  // ── Add movie ────────────────────────────────────────────
  function updateForm(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function addMovie(e) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          releaseYear: Number(form.releaseYear),
          runtime: Number(form.runtime),
          priority: Number(form.priority),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Could not add movie");
      setMessage("Movie added successfully!");
      setForm({ title: "", genre: "Action", releaseYear: new Date().getFullYear(), runtime: 120, platform: "Netflix", priority: 3 });
      loadMovies(1, search, filterGenre, filterStatus);
      loadWatchNext();
      loadStats();
    } catch (err) {
      setMessage("Error: " + err.message);
    }
  }

  // ── Status change ────────────────────────────────────────
  async function changeStatus(movie, status, rating) {
    try {
      const res = await fetch(`${API}/${movie._id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rating }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Status update failed");
      setMessage(result.message);
      loadMovies(currentPage, search, filterGenre, filterStatus);
      loadWatchNext();
      loadStats();
    } catch (err) {
      setMessage("Error: " + err.message);
    }
  }

  // ── Delete ───────────────────────────────────────────────
  async function deleteMovie(movie) {
    if (!window.confirm(`Delete "${movie.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/${movie._id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Delete failed");
      setMessage(result.message);
      const newPage = movies.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      loadMovies(newPage, search, filterGenre, filterStatus);
      loadWatchNext();
      loadStats();
    } catch (err) {
      setMessage("Error: " + err.message);
    }
  }

  // ── Edit ─────────────────────────────────────────────────
  function startEdit(movie) {
    setEditingId(movie._id);
    setEditForm({ title: movie.title, genre: movie.genre, runtime: movie.runtime, platform: movie.platform, priority: movie.priority });
    setEditMessage("");
  }
  function cancelEdit() { setEditingId(null); setEditForm({}); setEditMessage(""); }

  async function saveEdit(movie) {
    setEditMessage("");
    try {
      const res = await fetch(`${API}/${movie._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, runtime: Number(editForm.runtime), priority: Number(editForm.priority) }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Update failed");
      setMessage(result.message);
      setEditingId(null);
      loadMovies(currentPage, search, filterGenre, filterStatus);
    } catch (err) {
      setEditMessage("Error: " + err.message);
    }
  }

  const statusSlug = { "To Watch": "to-watch", "Watching": "watching", "Watched": "watched" };

  return (
    <main className="app">
      <header>
        <h1>🎬 Movie Watchlist</h1>
        <p>Your personal movie collection</p>
      </header>

      {/* ── Statistics ── */}
      {stats && (
        <section className="stats-section">
          <h2>Collection Statistics</h2>
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
              <span className="stat-label">Hours Watched</span>
            </div>
            <div className="stat-box">
              <span className="stat-num">{stats.averageRating > 0 ? stats.averageRating + "/10" : "—"}</span>
              <span className="stat-label">Avg Rating</span>
            </div>
            <div className="stat-box">
              <span className="stat-num stat-genre">{stats.mostWatchedGenre || "—"}</span>
              <span className="stat-label">Top Genre</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Watch Next ── */}
      <section className="watch-next-section">
        <div className="watch-next-header">
          <h2>Watch Next</h2>
          <button className="btn-secondary" onClick={loadWatchNext}>↻ Refresh</button>
        </div>
        {watchNext ? (
          <div className="watch-next-card">
            <h3>{watchNext.title}</h3>
            <div className="watch-next-meta">
              <span><strong>Code:</strong> {watchNext.code}</span>
              <span><strong>Genre:</strong> {watchNext.genre}</span>
              <span><strong>Runtime:</strong> {watchNext.runtime} min</span>
              <span><strong>Priority:</strong> {watchNext.priority}/5</span>
              <span><strong>Platform:</strong> {watchNext.platform}</span>
            </div>
          </div>
        ) : (
          <p className="section-note">{watchNextMsg || "Loading…"}</p>
        )}
      </section>

      {/* ── Add Movie Form ── */}
      <section className="panel">
        <h2>Add a Movie</h2>
        <form onSubmit={addMovie}>
          <label>
            Title
            <input name="title" value={form.title} onChange={updateForm} required placeholder="e.g. Inception" />
          </label>
          <label>
            Genre
            <select name="genre" value={form.genre} onChange={updateForm}>
              {GENRES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label>
            Release Year
            <input name="releaseYear" type="number" min="1950" max={new Date().getFullYear()} value={form.releaseYear} onChange={updateForm} required />
          </label>
          <label>
            Runtime (minutes)
            <input name="runtime" type="number" min="30" max="300" value={form.runtime} onChange={updateForm} required />
          </label>
          <label>
            Platform
            <select name="platform" value={form.platform} onChange={updateForm}>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select name="priority" value={form.priority} onChange={updateForm}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button type="submit">Add Movie</button>
        </form>
        {message && <p role="status">{message}</p>}
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
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)}>
            <option value="">All Genres</option>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(search || filterGenre || filterStatus) && (
            <button className="btn-secondary btn-clear" onClick={() => { setSearch(""); setFilterGenre(""); setFilterStatus(""); }}>
              ✕ Clear
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
                  <label>Title<input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></label>
                  <label>Genre
                    <select value={editForm.genre} onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}>
                      {GENRES.map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </label>
                  <label>Runtime (min)<input type="number" min="30" max="300" value={editForm.runtime} onChange={(e) => setEditForm({ ...editForm, runtime: e.target.value })} /></label>
                  <label>Platform
                    <select value={editForm.platform} onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })}>
                      {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </label>
                  <label>Priority
                    <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  {editMessage && <p className="edit-error">{editMessage}</p>}
                  <div className="card-actions">
                    <button onClick={() => saveEdit(movie)}>Save</button>
                    <button className="btn-ghost" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className={`status-badge ${statusSlug[movie.status]}`}>{movie.status}</span>
                  <h3>{movie.title}</h3>
                  <p><strong>Code:</strong> {movie.code}</p>
                  <p>{movie.genre} · {movie.releaseYear}</p>
                  <p>{movie.runtime} min · {movie.platform}</p>
                  <p>Priority: {movie.priority}/5</p>
                  {movie.status === "Watched" && <p>Rating: {movie.rating}/10</p>}

                  {movie.status !== "Watched" && (
                    <div className="status-controls">
                      {movie.status === "To Watch" && (
                        <button onClick={() => changeStatus(movie, "Watching")}>Start Watching</button>
                      )}
                      <button onClick={() => {
                        const r = window.prompt("Rate this movie from 1 to 10:");
                        if (r !== null && r.trim() !== "") changeStatus(movie, "Watched", Number(r));
                      }}>Mark Watched</button>
                      {movie.status === "Watching" && (
                        <button onClick={() => changeStatus(movie, "To Watch")}>Move to To Watch</button>
                      )}
                    </div>
                  )}

                  <div className="card-actions">
                    <button className="btn-ghost" onClick={() => startEdit(movie)}>Edit</button>
                    {movie.status !== "Watching" ? (
                      <button className="btn-danger" onClick={() => deleteMovie(movie)}>Delete</button>
                    ) : (
                      <button className="btn-danger" disabled title="Cannot delete a movie being watched">Delete</button>
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
              : "No movies yet. Add one using the form above."}
          </p>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn-secondary" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>← Previous</button>
            <span className="page-info">Page {currentPage} of {totalPages}</span>
            <button className="btn-secondary" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>Next →</button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
