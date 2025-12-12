# Animalerie - site e-commerce (finalisé)

## Installation locale

1. Copier les fichiers du projet dans un dossier `animalerie-site`.
2. Installer Node.js (version 18+ recommandée).
3. Installer les dépendances :

```bash
npm init -y
npm install express stripe dotenv
```

4. Créer un fichier `.env` à la racine :

```
STRIPE_SECRET_KEY=sk_test_xxx
DOMAIN=http://localhost:3000
PORT=3000
```

5. Lancer le serveur :

```bash
node server.js
```

6. Ouvrir http://localhost:3000

## Remarques
- En production : utilisez vos clés Stripe live, configurez un webhook pour confirmer les paiements et enregistrez les commandes dans une base de données.
- Pour changer les photos, remplacez les fichiers dans `/images` et ajustez `data/produits.json`.
