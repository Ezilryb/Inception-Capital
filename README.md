
# 🔮 CryptoOracle — AI Market Predictor

Outil de prédiction de marché crypto combinant **analyse technique** (RSI, MACD, EMA, Bollinger Bands) et **intelligence artificielle** (Google Gemini).

---

## 🚀 Déploiement sur GitHub Pages (5 minutes)

### Étape 1 — Créer le dépôt GitHub
1. Connectez-vous sur [github.com](https://github.com)
2. Cliquez **"New repository"** (bouton vert en haut à droite)
3. Nom : `crypto-oracle`
4. Visibilité : **Public** ✅
5. Cliquez **"Create repository"**

### Étape 2 — Uploader les fichiers
1. Sur la page du dépôt vide, cliquez **"uploading an existing file"**
2. Glissez-déposez les **3 fichiers** :
   - `index.html`
   - `indicators.js`
   - `app.js`
3. En bas, écrivez un message de commit : `Initial commit`
4. Cliquez **"Commit changes"**

### Étape 3 — Activer GitHub Pages
1. Cliquez sur l'onglet **"Settings"** de votre dépôt
2. Dans le menu gauche, cliquez **"Pages"**
3. Sous *Source*, sélectionnez **"Deploy from a branch"**
4. Branch : **main** — Folder : **/ (root)**
5. Cliquez **"Save"**
6. Attendez **1-2 minutes** → votre site est en ligne à :
   ```
   https://VOTRE-USERNAME.github.io/crypto-oracle
   ```

---

## 🔑 Configurer la clé API Gemini

1. Allez sur [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Connectez-vous avec votre compte Google
3. Cliquez **"Create API key"**
4. Copiez la clé (commence par `AIzaSy...`)
5. Collez-la dans le champ **🔑 Clé API Gemini** en bas de votre site

> La clé est stockée uniquement dans votre navigateur (localStorage). Elle n'est jamais envoyée à nos serveurs.

---

## 📊 Fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| **Données** | 300 bougies 30min — Binance (sans compte) |
| **Graphique** | Chandeliers japonais + EMA20/EMA50 superposés |
| **RSI** | Graphique RSI synchronisé avec lignes OB/OS |
| **Indicateurs** | RSI(14) · MACD(12,26,9) · EMA 20/50/200 · Bollinger Bands · Support/Résistance |
| **IA Gemini** | Signal LONG/SHORT/NEUTRAL · Cible · Stop Loss · Horizon · Risk/Reward |
| **Auto-refresh** | Toutes les 30 minutes automatiquement |
| **Cryptos** | BTC · ETH · SOL · BNB · XRP · DOGE · ADA · AVAX |
| **Responsive** | Mobile, tablette, desktop |

---

## 🧠 Comment fonctionne la prédiction IA

1. Les 300 bougies 30min sont récupérées depuis l'API publique Binance
2. Tous les indicateurs techniques sont calculés en JavaScript pur (pas de dépendance externe)
3. Un résumé complet est envoyé à **Gemini 1.5 Flash** avec le prompt :
   - Prix actuel, RSI, MACD, position des EMAs, Bollinger Bands, volumes, support/résistance
4. Gemini retourne un JSON structuré avec signal, cible, stop loss, horizon et analyse textuelle
5. L'interface met tout à jour en temps réel

---

## 🔄 Mise à jour du code

Pour modifier le site :
1. Éditez les fichiers directement sur GitHub (cliquez sur le fichier → icône crayon)
2. Ou re-uploadez les fichiers modifiés
3. Les changements sont visibles en **quelques secondes**

---

## ⚠️ Avertissement légal

> **Ce projet est à titre éducatif et de recherche uniquement.**
> Il ne constitue pas un conseil financier ou d'investissement.
> Le trading de cryptomonnaies comporte des risques significatifs de perte en capital.
> Les prédictions de l'IA sont basées sur des données historiques et ne garantissent aucun résultat futur.
> Investissez uniquement ce que vous êtes prêt à perdre.

---

## 📁 Structure du projet

```
crypto-oracle/
├── index.html       → Interface complète (HTML + CSS)
├── indicators.js    → Calcul RSI, EMA, MACD, Bollinger Bands
├── app.js           → Logique principale, Binance API, Gemini IA
└── README.md        → Ce fichier
```

---

*Construit avec ❤️ — Binance API · Google Gemini · TradingView Lightweight Charts*
