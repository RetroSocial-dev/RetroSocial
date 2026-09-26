const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      author TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.get("/api/posts", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, author, text, created_at
      FROM posts
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ошибка базы данных" });
  }
});

app.post("/api/posts", async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();

    if (!text) {
      return res.status(400).json({ error: "Пустой пост" });
    }

    const result = await pool.query(
      `INSERT INTO posts (author, text)
       VALUES ($1, $2)
       RETURNING id, author, text, created_at`,
      ["Герман", text]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ошибка базы данных" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "RetroSocial работает!" });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`RetroSocial running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
