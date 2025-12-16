// =========================
// server.js (FINAL) — Animalerie
// - Produits en PostgreSQL (Render)
// - Admin sécurisé côté serveur
// - Upload images -> Cloudinary
// - Paiement Stripe Checkout
// =========================

require('dotenv').config();

const express = require('express');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Logs utiles ----------
console.log('🔥 SERVER.JS LANCÉ 🔥');
console.log('PORT =', PORT);
console.log('DATABASE_URL =', process.env.DATABASE_URL ? 'OK' : 'MANQUANT');
console.log('ADMIN_PASSWORD =', process.env.ADMIN_PASSWORD ? 'OK' : 'MANQUANT');
console.log('CLOUDINARY_CLOUD_NAME =', process.env.CLOUDINARY_CLOUD_NAME ? 'OK' : 'MANQUANT');
console.log('CLOUDINARY_API_KEY =', process.env.CLOUDINARY_API_KEY ? 'OK' : 'MANQUANT');
console.log('CLOUDINARY_API_SECRET =', process.env.CLOUDINARY_API_SECRET ? 'OK' : 'MANQUANT');
console.log('STRIPE_SECRET_KEY =', process.env.STRIPE_SECRET_KEY ? 'OK' : 'MANQUANT');
console.log('DOMAIN =', process.env.DOMAIN ? `Value: ${process.env.DOMAIN}` : '(non défini, fallback localhost)');

// ---------- Cloudinary ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- PostgreSQL ----------
if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL manquant : le serveur démarre, mais les produits ne pourront pas fonctionner.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render Postgres utilise SSL ; en local (External URL) aussi très souvent.
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

async function ensureDb() {
  if (!process.env.DATABASE_URL) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS produits (
      id BIGINT PRIMARY KEY,
      nom TEXT NOT NULL,
      prix INTEGER NOT NULL,      -- XPF (pas de centimes)
      image TEXT NOT NULL,        -- URL Cloudinary
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ DB ready');
}
ensureDb().catch((err) => console.error('❌ DB init error', err));

// ---------- Middlewares ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir le site statique (HTML/CSS/JS/images)
app.use(express.static(__dirname));

// Upload en mémoire (on envoie ensuite à Cloudinary)
const upload = multer({ storage: multer.memoryStorage() });

// =========================
// AUTH ADMIN (côté serveur)
// =========================
app.post('/admin-login', (req, res) => {
  const { password } = req.body || {};

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD non défini' });
  }
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.sendStatus(401);
  }
  return res.sendStatus(200);
});

// =========================
// PRODUITS
// =========================

// Liste produits
app.get('/produits', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nom, prix, image, description FROM produits ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ /produits error', err);
    res.status(500).json({ error: 'Erreur chargement produits' });
  }
});

// Ajout produit (multipart)
app.post('/ajouter', upload.single('image'), async (req, res) => {
  try {
    const { nom, prix, description } = req.body || {};
    const prixInt = Number(prix);

    if (!nom || !Number.isFinite(prixInt) || prixInt < 0) {
      return res.status(400).json({ error: 'Champs invalides (nom/prix)' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Image manquante' });
    }

    // Upload Cloudinary depuis buffer
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: 'animalerie',
    });

    const produit = {
      id: Date.now(),
      nom: String(nom).trim(),
      prix: prixInt, // XPF
      image: uploadResult.secure_url,
      description: description ? String(description).trim() : '',
    };

    await pool.query(
      'INSERT INTO produits (id, nom, prix, image, description) VALUES ($1, $2, $3, $4, $5)',
      [String(produit.id), produit.nom, produit.prix, produit.image, produit.description || null]
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ /ajouter error', err);
    return res.status(500).json({ error: 'Erreur ajout produit' });
  }
});

// Suppression produit (par index dans l’ordre d’affichage)
// IMPORTANT : c’est compatible avec ton admin.js actuel qui envoie { index }
app.post('/supprimer', async (req, res) => {
  try {
    const { index } = req.body || {};
    const idx = Number(index);

    if (!Number.isFinite(idx) || idx < 0) {
      return res.status(400).json({ error: 'Index invalide' });
    }

    const { rows } = await pool.query(
      'SELECT id FROM produits ORDER BY created_at DESC'
    );

    if (!rows[idx]) {
      return res.sendStatus(404);
    }

    await pool.query('DELETE FROM produits WHERE id = $1', [String(rows[idx].id)]);
    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ /supprimer error', err);
    return res.status(500).json({ error: 'Erreur suppression' });
  }
});

// =========================
// STRIPE CHECKOUT
// =========================
app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe non configuré (STRIPE_SECRET_KEY manquant)' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Panier vide' });
    }

    // Domaine (prod Render) ou fallback local
    const domain = process.env.DOMAIN || `http://localhost:${PORT}`;

    const line_items = items.map((i) => {
      const nom = String(i.nom || 'Article');
      const prix = Number(i.prix);
      const quantite = Number(i.quantite || 1);

      if (!Number.isFinite(prix) || prix < 0 || !Number.isFinite(quantite) || quantite < 1) {
        throw new Error('Item invalide');
      }

      return {
        price_data: {
          currency: 'xpf',
          product_data: { name: nom },
          // XPF : pas de centimes => unit_amount en XPF
          unit_amount: Math.round(prix),
        },
        quantity: Math.round(quantite),
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${domain}/paiement.html?success=1`,
      cancel_url: `${domain}/paiement.html?cancel=1`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe error', err);
    return res.status(500).json({ error: 'Erreur Stripe' });
  }
});

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`✅ Serveur actif sur http://localhost:${PORT}`);
});
