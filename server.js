// =========================
// server.js — FINAL (RÈGLE A)
// =========================

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// LOGS
// =========================
console.log('🔥 SERVER.JS LANCÉ 🔥');
console.log('PORT =', PORT);

// =========================
// CLOUDINARY
// =========================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =========================
// POSTGRESQL
// =========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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

initDb().catch(console.error);

// =========================
// MIDDLEWARES
// =========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const upload = multer({ storage: multer.memoryStorage() });

// =========================
// AUTH ADMIN
// =========================
app.post('/admin-login', (req, res) => {
  if (req.body.password !== process.env.ADMIN_PASSWORD) {
    return res.sendStatus(401);
  }
  res.sendStatus(200);
});

// =========================
// PRODUITS
// =========================
app.get('/produits', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nom, prix, image, description FROM produits ORDER BY created_at DESC'
  );
  res.json(rows);
});

app.post('/ajouter', upload.single('image'), async (req, res) => {
  const { nom, prix, description } = req.body;
  const prixInt = Number(prix);

  if (!nom || !Number.isInteger(prixInt)) {
    return res.status(400).send('Prix invalide');
  }

  const b64 = req.file.buffer.toString('base64');
  const dataUri = `data:${req.file.mimetype};base64,${b64}`;

  const uploadResult = await cloudinary.uploader.upload(dataUri, {
    folder: 'animalerie',
  });

  await pool.query(
    'INSERT INTO produits (id, nom, prix, image, description) VALUES ($1,$2,$3,$4,$5)',
    [Date.now(), nom, prixInt, uploadResult.secure_url, description || '']
  );

  res.sendStatus(200);
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
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const domain = process.env.DOMAIN || `http://localhost:${PORT}`;

  const line_items = req.body.items.map(i => ({
    price_data: {
      currency: 'xpf',
      product_data: { name: i.nom },
      unit_amount: i.prix,
    },
    quantity: i.quantite,
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items,
    success_url: `${domain}/paiement.html?success=1`,
    cancel_url: `${domain}/paiement.html?cancel=1`,
  });

  res.json({ url: session.url });
});

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`✅ Serveur actif sur http://localhost:${PORT}`);
});
