require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   STRIPE
========================= */
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

/* =========================
   MIDDLEWARES
========================= */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

/* =========================
   MULTER (UPLOAD IMAGES)
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = Date.now() + ext;
    cb(null, filename);
  }
});

const upload = multer({ storage });

/* =========================
   PRODUITS (HELPERS)
========================= */
const produitsPath = path.join(__dirname, 'data', 'produits.json');

function readProduits() {
  return JSON.parse(fs.readFileSync(produitsPath, 'utf8'));
}

function writeProduits(data) {
  fs.writeFileSync(produitsPath, JSON.stringify(data, null, 2), 'utf8');
}

/* =========================
   ADMIN - AJOUT PRODUIT
========================= */
app.post('/ajouter', upload.single('image'), (req, res) => {
  try {
    const produits = readProduits();

    const produit = {
      id: Date.now(),
      nom: req.body.nom,
      prix: Math.round(Number(req.body.prix) * 100),
      image: 'images/' + req.file.filename,
      description: req.body.description || ''
    };

    produits.push(produit);
    writeProduits(produits);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'ajout du produit" });
  }
});

/* =========================
   ADMIN - SUPPRESSION
========================= */
app.post('/supprimer', (req, res) => {
  try {
    const { index } = req.body;
    const produits = readProduits();

    if (index < 0 || index >= produits.length) {
      return res.status(400).json({ error: 'Index invalide' });
    }

    produits.splice(index, 1);
    writeProduits(produits);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression produit" });
  }
});

/* =========================
   STRIPE - CHECKOUT
========================= */
app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe non configuré' });
    }

    const { form, panier } = req.body;
    const produits = readProduits();

    const counts = {};
    panier.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
    });

    const line_items = [];

    for (const id in counts) {
      const produit = produits.find(p => p.id === Number(id));
      if (!produit) continue;

      line_items.push({
        price_data: {
          currency: 'xpf',
          product_data: { name: produit.nom },
          unit_amount: produit.prix
        },
        quantity: counts[id]
      });
    }

    const domain =
      process.env.DOMAIN || `http://localhost:${PORT}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: `${domain}/index.html?success=1`,
      cancel_url: `${domain}/paiement.html?cancel=1`,
      metadata: {
        nom: form.nom,
        email: form.email,
        creneau: form.creneau
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
