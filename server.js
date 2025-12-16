// =========================
// SERVER.JS - VERSION PROPRE POSTGRESQL
// =========================

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Pool } = require('pg');
const stripeLib = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// CONFIG
// =========================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const stripe = stripeLib(process.env.STRIPE_SECRET_KEY);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

// =========================
// MIDDLEWARES
// =========================

app.use(express.json());
app.use(express.static(path.join(__dirname)));
const upload = multer({ dest: 'tmp/' });

// =========================
// DB INIT
// =========================

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS produits (
      id BIGINT PRIMARY KEY,
      nom TEXT NOT NULL,
      prix INTEGER NOT NULL,
      image TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ DB ready');
}

initDb().catch(err => {
  console.error('❌ DB init error', err);
});

// =========================
// ROUTES
// =========================

app.get('/produits', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM produits ORDER BY created_at DESC');
  res.json(rows);
});

app.post('/ajouter', upload.single('image'), async (req, res) => {
  try {
    const { nom, prix, description } = req.body;

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'animalerie',
    });

    fs.unlinkSync(req.file.path);

    await pool.query(
      `INSERT INTO produits (id, nom, prix, image, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        Date.now(),
        nom,
        Number(prix),
        result.secure_url,
        description || '',
      ]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post('/supprimer', async (req, res) => {
  const { index } = req.body;
  const { rows } = await pool.query(
    'SELECT id FROM produits ORDER BY created_at DESC'
  );

  if (!rows[index]) return res.sendStatus(404);

  await pool.query('DELETE FROM produits WHERE id = $1', [rows[index].id]);
  res.sendStatus(200);
});

// =========================
// STRIPE
// =========================

app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: req.body.items,
    success_url: `${process.env.DOMAIN}/success.html`,
    cancel_url: `${process.env.DOMAIN}/cancel.html`,
  });

  res.json({ url: session.url });
});

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
  console.log('🔥 SERVER.JS LANCÉ 🔥');
  console.log(`✅ Serveur actif sur http://localhost:${PORT}`);
});
