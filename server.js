require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

function readProduits(){
  const p = path.join(__dirname, 'data', 'produits.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}
function writeProduits(list){
  const p = path.join(__dirname, 'data', 'produits.json');
  fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8');
}

app.post('/ajouter', (req, res) => {
  try{
    const data = readProduits();
    data.push(req.body);
    writeProduits(data);
    res.sendStatus(200);
  }catch(e){
    console.error(e);
    res.status(500).json({ error: "Impossible d'ajouter le produit." });
  }
});

app.post('/supprimer', (req, res) => {
  try{
    const { index } = req.body;
    const data = readProduits();
    if (typeof index !== 'number' || index < 0 || index >= data.length) {
      return res.status(400).json({ error: 'Index invalide.' });
    }
    data.splice(index, 1);
    writeProduits(data);
    res.sendStatus(200);
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Impossible de supprimer le produit.' });
  }
});

app.post('/create-checkout-session', async (req, res) => {
  try{
    if(!stripe){
      return res.status(500).json({ error: 'Stripe non configuré (STRIPE_SECRET_KEY manquante).' });
    }

    const { form, panier } = req.body;
    const produits = readProduits();

    const counts = {};
    (panier || []).forEach(id => counts[id] = (counts[id] || 0) + 1);

    const line_items = [];
    for(const idStr of Object.keys(counts)){
      const id = Number(idStr);
      const p = produits.find(x => Number(x.id) === id);
      if(!p) continue;
      line_items.push({
        price_data: {
          currency: 'xpf',
          product_data: { name: p.nom },
          unit_amount: p.prix
        },
        quantity: counts[idStr]
      });
    }

    if(line_items.length === 0){
      return res.status(400).json({ error: 'Panier vide ou produits introuvables.' });
    }

    const domain = process.env.DOMAIN || `http://localhost:${PORT}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${domain}/index.html?success=1`,
      cancel_url: `${domain}/paiement.html?cancel=1`,
      metadata: {
        customer_name: (form && form.nom) ? form.nom : '',
        customer_email: (form && form.email) ? form.email : '',
        creneau: (form && form.creneau) ? form.creneau : ''
      }
    });

    res.json({ url: session.url });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
