
// SERVER.JS – COMPLET (ADMIN + CLOUDINARY + STRIPE)
// =========================
console.log("🔥 SERVER.JS LANCÉ 🔥");

require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();
const PORT = process.env.PORT || 3000;


// =========================
// CHECK CONFIG (LOGS)
// =========================
console.log("PORT =", PORT);
console.log("CLOUDINARY_CLOUD_NAME =", process.env.CLOUDINARY_CLOUD_NAME ? "OK" : "MANQUANT");
console.log("CLOUDINARY_API_KEY =", process.env.CLOUDINARY_API_KEY ? "OK" : "MANQUANT");
console.log("CLOUDINARY_API_SECRET =", process.env.CLOUDINARY_API_SECRET ? "OK" : "MANQUANT");
console.log("STRIPE_SECRET_KEY =", process.env.STRIPE_SECRET_KEY ? "OK" : "MANQUANT");
console.log("DOMAIN =", process.env.DOMAIN || "(non défini, fallback localhost)");

// =========================
// CLOUDINARY CONFIG
// =========================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =========================
// STRIPE
// =========================
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  }
} catch (e) {
  console.error("❌ Stripe n'a pas pu être initialisé:", e.message);
  stripe = null;
}

// =========================
// MIDDLEWARES
// =========================
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Sert tous les fichiers (index.html, js/, css/, data/, etc.)
app.use(express.static(path.join(__dirname)));

// =========================
// MULTER (UPLOAD TEMP)
// =========================
const upload = multer({ dest: "tmp/" });

app.post('/admin-login', (req, res) => {


  if (!req.body.password || req.body.password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  res.sendStatus(200);
});


// =========================
// PRODUITS JSON
// =========================
const produitsPath = path.join(__dirname, "data", "produits.json");

function readProduits() {
  try {
    if (!fs.existsSync(produitsPath)) return [];
    return JSON.parse(fs.readFileSync(produitsPath, "utf8"));
  } catch (e) {
    console.error("❌ Erreur lecture produits.json:", e.message);
    return [];
  }
}

function writeProduits(data) {
  fs.writeFileSync(produitsPath, JSON.stringify(data, null, 2), "utf8");
}

// =========================
// ROUTE TEST
// =========================
app.get("/test", (req, res) => res.send("SERVEUR OK ✅"));

// =========================
// ADMIN - AJOUT PRODUIT (image -> Cloudinary)
// =========================
app.post("/ajouter", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image manquante (champ 'image')." });
    }

    const nom = String(req.body.nom || "").trim();
    const prixXpf = Number(req.body.prix || 0);
    const description = String(req.body.description || "").trim();

    if (!nom || !Number.isFinite(prixXpf)) {
      // Nettoyage temp
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: "Champs invalides (nom/prix)." });
    }

    // Upload Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "animalerie",
    });

    // Nettoyage temp local
    try { fs.unlinkSync(req.file.path); } catch {}

    const produits = readProduits();

    const produit = {
      id: Date.now(),
      nom,
      prix: Math.round(prixXpf * 100), // en centimes XPF (comme avant)
      image: result.secure_url,         // URL Cloudinary (persistante)
      description,
    };

    produits.push(produit);
    writeProduits(produits);

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Erreur /ajouter:", err);
    res.status(500).json({ error: "Erreur ajout produit (Cloudinary/server)." });
  }
});

// =========================
// ADMIN - SUPPRESSION PRODUIT
// =========================
app.post("/supprimer", (req, res) => {
  try {
    const index = Number(req.body.index);

    const produits = readProduits();
    if (!Number.isFinite(index) || index < 0 || index >= produits.length) {
      return res.status(400).json({ error: "Index invalide." });
    }

    produits.splice(index, 1);
    writeProduits(produits);

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Erreur /supprimer:", err);
    res.status(500).json({ error: "Erreur suppression produit." });
  }
});

// =========================
// STRIPE - CHECKOUT
// =========================
app.post("/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe non configuré (STRIPE_SECRET_KEY manquante ou invalide)." });
    }

    const { form, panier } = req.body || {};
    const produits = readProduits();

    const counts = {};
    (panier || []).forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });

    const line_items = [];
    for (const idStr of Object.keys(counts)) {
      const id = Number(idStr);
      const p = produits.find((x) => Number(x.id) === id);
      if (!p) continue;

      line_items.push({
        price_data: {
          currency: "xpf",
          product_data: { name: p.nom },
          unit_amount: p.prix, // centimes
        },
        quantity: counts[idStr],
      });
    }

    if (line_items.length === 0) {
      return res.status(400).json({ error: "Panier vide ou produits introuvables." });
    }

    const domain = process.env.DOMAIN || `http://localhost:${PORT}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      success_url: `${domain}/index.html?success=1`,
      cancel_url: `${domain}/paiement.html?cancel=1`,
      metadata: {
        nom: form?.nom || "",
        email: form?.email || "",
        creneau: form?.creneau || "",
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Erreur Stripe:", err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`✅ Serveur actif sur http://localhost:${PORT}`);
});
=======
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const stripeLib = require('stripe');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const stripe = process.env.STRIPE_SECRET_KEY ? stripeLib(process.env.STRIPE_SECRET_KEY) : null;

/* =========================
   CONFIG CLOUDINARY
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* =========================
   DB (PostgreSQL)
========================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined
});

// Création table si besoin (safe)
async function ensureDb() {
  if (!process.env.DATABASE_URL) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS produits (
      id BIGSERIAL PRIMARY KEY,
      nom TEXT NOT NULL,
      prix INTEGER NOT NULL,
      image TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

ensureDb().then(() => console.log('✅ DB ready')).catch(err => console.error('❌ DB init error', err));

/* =========================
   MIDDLEWARES
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   FICHIERS STATIQUES
========================= */
app.use(express.static(__dirname));

/* =========================
   JSON FALLBACK
========================= */
const DATA_FILE = path.join(__dirname, 'data', 'produits.json');

function readJsonProduits() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeJsonProduits(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

/* =========================
   UPLOAD (MULTER EN MÉMOIRE)
========================= */
const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   LOGIN ADMIN (SECURISÉ)
========================= */
app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }
  res.sendStatus(200);
});

/* =========================
   API PRODUITS (DB + fallback)
========================= */

// Lire produits (DB sinon JSON)
app.get('/produits', async (req, res) => {
  try {
    if (process.env.DATABASE_URL) {
      const r = await pool.query('SELECT id, nom, prix, image, description FROM produits ORDER BY created_at DESC');
      // Si DB vide, fallback JSON (pour garder tes produits actuels visibles)
      if (r.rows.length === 0) {
        return res.json(readJsonProduits());
      }
      return res.json(r.rows);
    }

    // si pas de DB
    return res.json(readJsonProduits());
  } catch (err) {
    console.error(err);
    // fallback JSON en cas de souci DB
    return res.json(readJsonProduits());
  }
});

// Ajouter produit (upload → cloudinary → DB, et miroir JSON en backup)
app.post('/ajouter', upload.single('image'), async (req, res) => {
  try {
    const { nom, prix, description } = req.body;
    const prixInt = Number(prix);

    if (!nom || !Number.isFinite(prixInt)) {
      return res.status(400).json({ error: 'Champs invalides' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Image manquante' });
    }

    const uploadResult = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
      { folder: 'animalerie' }
    );

    const imageUrl = uploadResult.secure_url;

    // 1) DB (si disponible)
    if (process.env.DATABASE_URL) {
      await pool.query(
        'INSERT INTO produits (nom, prix, image, description) VALUES ($1, $2, $3, $4)',
        [nom, prixInt, imageUrl, description || null]
      );
    }

    // 2) Backup JSON (toujours)
    const produits = readJsonProduits();
    produits.unshift({
      id: Date.now(),
      nom,
      prix: prixInt,
      image: imageUrl,
      description: description || ''
    });
    writeJsonProduits(produits);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur ajout produit' });
  }
});

// Supprimer produit (DB + JSON)
app.post('/supprimer', async (req, res) => {
  try {
    const { index } = req.body;

    // On supprime côté JSON par index (comme avant)
    const produitsJson = readJsonProduits();
    const removed = produitsJson.splice(Number(index), 1)[0];
    writeJsonProduits(produitsJson);

    // Côté DB : si on a un id, on tente de supprimer par id
    if (process.env.DATABASE_URL && removed && removed.id) {
      // attention: removed.id est BIGINT côté DB, mais on a peut-être un id "Date.now()" du JSON.
      // Si la DB a ses propres ids, on ne casse rien : on essaye juste.
      await pool.query('DELETE FROM produits WHERE id = $1', [String(removed.id)]);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

/* =========================
   STRIPE
========================= */
app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe non configuré' });

    const { items } = req.body;
    const domain = process.env.DOMAIN || `http://localhost:${PORT}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map(i => ({
        price_data: {
          currency: 'xpf',
          product_data: { name: i.nom },
          unit_amount: Number(i.prix)
        },
        quantity: Number(i.quantite)
      })),
      mode: 'payment',
      success_url: `${domain}/paiement.html?success=1`,
      cancel_url: `${domain}/paiement.html?cancel=1`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur Stripe' });
  }
});

/* =========================
   LANCEMENT SERVEUR
========================= */
app.listen(PORT, () => {
  console.log(`✅ Serveur actif sur http://localhost:${PORT}`);
});

