# 🔐 Sécurité de l'API SwapKit

Ce document explique comment utiliser l'authentification par clé API pour sécuriser l'accès aux endpoints de l'API SwapKit.

## 🔑 Configuration de la clé API

### 1. Clé API secrète

La clé API secrète est configurée dans le fichier `.env` :

```env
API_SECRET_KEY=sk_swapkit_2024_7f8e9d1a2b3c4e5f6789abcdef012345
```

**⚠️ Important :** 
- Gardez cette clé secrète et ne la partagez jamais
- Changez-la régulièrement pour plus de sécurité
- Ne la commitez jamais dans votre repository Git

### 2. Génération d'une nouvelle clé

Pour générer une nouvelle clé API sécurisée, vous pouvez utiliser :

```bash
# Méthode 1: Avec Node.js
node -e "console.log('sk_swapkit_2024_' + require('crypto').randomBytes(20).toString('hex'))"

# Méthode 2: Avec OpenSSL
echo "sk_swapkit_2024_$(openssl rand -hex 20)"
```

## 🛡️ Authentification

### Endpoints publics (pas d'authentification requise)

- `GET /` - Page d'accueil
- `GET /health` - Vérification de santé (Note: actuellement protégé, mais peut être rendu public)
- `GET /api-docs` - Documentation Swagger
- Tous les endpoints sous `/api-docs/*`

### Endpoints protégés (authentification requise)

Tous les autres endpoints sous `/api/*` nécessitent une authentification.

### Méthodes d'authentification

#### 1. Header `x-api-key`

```bash
curl -H "x-api-key: sk_swapkit_2024_7f8e9d1a2b3c4e5f6789abcdef012345" \
     http://localhost:3023/api/health
```

#### 2. Header `Authorization` avec Bearer token

```bash
curl -H "Authorization: Bearer sk_swapkit_2024_7f8e9d1a2b3c4e5f6789abcdef012345" \
     http://localhost:3023/api/health
```

## 📝 Exemples d'utilisation

### JavaScript/Node.js

```javascript
const API_KEY = 'sk_swapkit_2024_7f8e9d1a2b3c4e5f6789abcdef012345';
const API_BASE_URL = 'http://localhost:3023';

// Méthode 1: Avec x-api-key
const response1 = await fetch(`${API_BASE_URL}/api/health`, {
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  }
});

// Méthode 2: Avec Authorization Bearer
const response2 = await fetch(`${API_BASE_URL}/api/health`, {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Pour un POST (exemple swap)
const swapResponse = await fetch(`${API_BASE_URL}/api/swaps`, {
  method: 'POST',
  headers: {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sourceAssetString: 'ETH.ETH',
    destinationAssetString: 'BTC.BTC',
    amount: '1',
    slippage: 3
  })
});
```

### Python

```python
import requests

API_KEY = 'sk_swapkit_2024_7f8e9d1a2b3c4e5f6789abcdef012345'
API_BASE_URL = 'http://localhost:3023'

# Méthode 1: Avec x-api-key
headers1 = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
}

response1 = requests.get(f'{API_BASE_URL}/api/health', headers=headers1)

# Méthode 2: Avec Authorization Bearer
headers2 = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

response2 = requests.get(f'{API_BASE_URL}/api/health', headers=headers2)

# Pour un POST (exemple swap)
swap_data = {
    'sourceAssetString': 'ETH.ETH',
    'destinationAssetString': 'BTC.BTC',
    'amount': '1',
    'slippage': 3
}

swap_response = requests.post(
    f'{API_BASE_URL}/api/swaps',
    headers=headers1,
    json=swap_data
)
```

## 🧪 Tests de sécurité

Un script de test est fourni pour vérifier le bon fonctionnement de l'authentification :

```bash
node test-api-security.js
```

Ce script teste :
- ✅ Accès aux endpoints publics sans authentification
- ❌ Rejet des requêtes sans clé API sur les endpoints protégés
- ❌ Rejet des requêtes avec clé API invalide
- ✅ Acceptation des requêtes avec clé API valide (x-api-key)
- ✅ Acceptation des requêtes avec clé API valide (Bearer token)

## 🚨 Codes d'erreur d'authentification

### 401 Unauthorized - Clé API manquante

```json
{
  "status": "error",
  "errorCode": "MISSING_API_KEY",
  "error": "Clé API manquante. Veuillez fournir la clé API dans le header \"x-api-key\" ou \"Authorization: Bearer <key>\"",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 403 Forbidden - Clé API invalide

```json
{
  "status": "error",
  "errorCode": "INVALID_API_KEY",
  "error": "Clé API invalide",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 500 Internal Server Error - Configuration serveur

```json
{
  "status": "error",
  "errorCode": "SERVER_CONFIGURATION_ERROR",
  "error": "Clé API secrète non configurée sur le serveur",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔧 Configuration Swagger

La documentation Swagger inclut automatiquement les schémas d'authentification. Voici comment l'utiliser :

### Étapes pour s'authentifier dans Swagger :

1. **Ouvrir la documentation** : Visitez `http://localhost:3023/api-docs`

2. **Cliquer sur "Authorize"** : Vous verrez un bouton "Authorize" en haut à droite de l'interface Swagger

3. **Choisir la méthode d'authentification** :
   - **ApiKeyAuth** : Entrez votre clé API directement
   - **BearerAuth** : Entrez votre clé API (sans "Bearer ")

4. **Entrer votre clé API** : `sk_swapkit_2024_7f8e9d1a2b3c4e5f6789abcdef012345`

5. **Cliquer sur "Authorize"** puis "Close"

6. **Tester les endpoints** : Vous pouvez maintenant tester tous les endpoints protégés directement depuis l'interface

### Endpoints de test recommandés :

- **`GET /api/health`** : Endpoint public (pas d'auth requise)
- **`GET /api/auth-test`** : Endpoint protégé spécialement créé pour tester l'authentification
- **`GET /api/test-env`** : Endpoint protégé pour vérifier la configuration

## 🛠️ Dépannage

### Problème : "Clé API secrète non configurée"

**Solution :** Vérifiez que `API_SECRET_KEY` est définie dans votre fichier `.env`

### Problème : "Clé API invalide"

**Solutions :**
- Vérifiez que vous utilisez la bonne clé du fichier `.env`
- Assurez-vous qu'il n'y a pas d'espaces avant/après la clé
- Vérifiez le format du header (x-api-key ou Authorization: Bearer)

### Problème : Endpoint toujours accessible sans authentification

**Solution :** Vérifiez que l'endpoint n'est pas dans la liste `publicEndpoints` du middleware d'authentification
