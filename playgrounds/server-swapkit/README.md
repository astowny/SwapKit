# SwapKit API Server

Serveur API pour les opérations de swap et de gestion de portefeuille utilisant SwapKit.

## 🚀 Démarrage rapide

### 1. Installation des dépendances
```bash
npm run install-deps
```

### 2. Configuration
Créez un fichier `.env` avec vos clés API :
```env
PORT=3023
ALCHEMY_API_KEY=your_alchemy_api_key_here
MNEMONIC=your_mnemonic_phrase_here
SWAPKIT_API_KEY=your_swapkit_api_key_here
```

### 3. Démarrage du serveur
```bash
npm run dev
```

## 📚 Documentation

### Swagger UI
Une fois le serveur démarré, accédez à la documentation interactive :
- **URL** : http://localhost:3023/api-docs
- **Interface** : Swagger UI avec tous les endpoints documentés
- **Test** : Possibilité de tester les endpoints directement depuis l'interface

### Endpoints principaux

#### 🔄 Swaps
- **POST** `/api/swaps` - Effectuer un swap entre deux assets
- **Paramètres** : sourceAssetString, destinationAssetString, amount, slippage

#### 💰 Balances  
- **GET** `/api/balances` - Récupérer les balances de toutes les chaînes
- **Inclut** : Prix en USD, temps d'exécution, métadonnées

#### ℹ️ Informations
- **GET** `/` - Informations sur l'API et liens vers la documentation
- **GET** `/health` - Status de santé du serveur

## 🛠️ Développement

### Scripts disponibles
```bash
npm run dev          # Démarrage en mode développement
npm run start        # Démarrage en production
npm run build        # Compilation TypeScript
npm run docs         # Affiche l'URL de la documentation
npm run getTokenList # Récupère la liste des tokens
npm run runRealSwap  # Exécute un swap de test
```

### Structure du projet
```
├── server.ts                 # Point d'entrée principal
├── swagger.config.js         # Configuration Swagger
├── core/                     # Logique métier
│   ├── swap/                 # Fonctions de swap
│   ├── balance/              # Gestion des balances
│   └── ...
└── .env                      # Variables d'environnement
```

## 📖 Génération automatique de documentation

La documentation est générée automatiquement à partir des annotations JSDoc dans le code :

### Exemple d'annotation
```javascript
/**
 * @swagger
 * /api/swaps:
 *   post:
 *     summary: Effectuer un swap
 *     tags: [Swaps]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwapRequest'
 */
```

### Ajout de nouveaux endpoints
1. Ajoutez l'annotation `@swagger` au-dessus de votre route
2. Définissez les schémas dans `swagger.config.js` si nécessaire
3. La documentation sera automatiquement mise à jour

## 🔧 Configuration avancée

### Personnalisation Swagger
Modifiez `swagger.config.js` pour :
- Ajouter de nouveaux schémas
- Configurer les serveurs
- Personnaliser les informations de l'API

### Monitoring réseau
Le serveur inclut un système de monitoring des appels réseau :
- Logs des requêtes API
- Mesure des temps de réponse
- Sauvegarde dans `network_logs.json`

## 🚨 Sécurité

- Ne commitez jamais le fichier `.env`
- Utilisez des clés API sécurisées
- Configurez CORS selon vos besoins
- Activez HTTPS en production
