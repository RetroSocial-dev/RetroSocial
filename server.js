const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/*
  Увеличиваем лимит JSON,
  потому что аватар передаётся как Base64.
*/
app.use(express.json({ limit: "500kb" }));

app.use(express.static(path.join(__dirname, "public")));


/* =========================
   DATABASE
========================= */

async function initDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      author TEXT NOT NULL,
      avatar TEXT,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS avatar TEXT
  `);

}


/* =========================
   GET POSTS
========================= */

app.get("/api/posts", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        author,
        avatar,
        text,
        created_at
      FROM posts
      ORDER BY created_at DESC
    `);

    res.json(result.rows);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Database error"
    });

  }

});


/* =========================
   CREATE POST
========================= */

app.post("/api/posts", async (req, res) => {

  try {

    const text =
      String(req.body.text || "").trim();

    const author =
      String(req.body.author || "Аноним").trim();

    const avatar =
      String(req.body.avatar || "").trim();


    if (!text) {

      return res.status(400).json({
        error: "Empty post"
      });

    }


    if (text.length > 5000) {

      return res.status(400).json({
        error: "Post is too long"
      });

    }


    const safeAuthor =
      author.length > 30
        ? author.slice(0, 30)
        : author;


    /*
      Base64-аватар теперь может быть
      намного больше 2000 символов.
    */

    const safeAvatar =
      avatar.length > 150000
        ? ""
        : avatar;


    const result = await pool.query(
      `
      INSERT INTO posts (
        author,
        avatar,
        text
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        author,
        avatar,
        text,
        created_at
      `,
      [
        safeAuthor || "Аноним",
        safeAvatar,
        text
      ]
    );


    res.json(result.rows[0]);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Database error"
    });

  }

});


/* =========================
   DELETE POST
========================= */

app.delete("/api/posts/:id", async (req, res) => {

  try {

    const id =
      Number(req.params.id);


    if (!Number.isInteger(id)) {

      return res.status(400).json({
        error: "Invalid ID"
      });

    }


    const result = await pool.query(
      `
      DELETE FROM posts
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );


    if (result.rowCount === 0) {

      return res.status(404).json({
        error: "Post not found"
      });

    }


    res.json({
      ok: true
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Database error"
    });

  }

});


/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {

  res.json({
    ok: true,
    message: "RetroSocial работает!"
  });

});


/* =========================
   START
========================= */

initDatabase()
  .then(() => {

    app.listen(PORT, () => {

      console.log(
        `RetroSocial running on port ${PORT}`
      );

    });

  })
  .catch((error) => {

    console.error(
      "Database initialization failed:",
      error
    );

    process.exit(1);

  });
