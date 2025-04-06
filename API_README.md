# API de Swap SwapKit

Cette API permet d'effectuer des swaps entre différentes crypto-monnaies en utilisant SwapKit.

## Configuration

1. Assurez-vous d'avoir Node.js installé (version 14 ou supérieure recommandée).

2. Installez les dépendances nécessaires :
   ```bash
   npm install express cors dotenv
   ```

3. Configurez le fichier `.env` avec les variables d'environnement requises :
   ```
   PORT=3023
   SWAPKIT_API_KEY=votre_clé_api_swapkit
   MNEMONIC=votre_phrase_mnémonique_de_12_ou_24_mots
   ```

## Démarrage du serveur

Pour démarrer le serveur API, exécutez :
```bash
node server.js
```

Le serveur démarrera sur le port spécifié dans le fichier `.env` (par défaut : 3023).

## Endpoints disponibles

### 1. Exécuter un swap

**Endpoint** : `POST /api/swaps`

**Corps de la requête** :
```json
{
  "sourceAssetString": "THOR.RUNE",
  "destinationAssetString": "BTC.BTC",
  "amount": "0.1",
  "slippage": 3
}
```

**Paramètres obligatoires** :
- `sourceAssetString` : L'asset source (ex: "THOR.RUNE")
- `destinationAssetString` : L'asset de destination (ex: "BTC.BTC")
- `amount` : Le montant à échanger (ex: "0.1")

**Paramètres optionnels** :
- `slippage` : Le pourcentage de slippage autorisé (par défaut: 3)

**Exemple de réponse** :
```json
{
  "status": "success",
  "data": {
    "status": "success",
    "txHash": "0x1234567890abcdef...",
    "receivedAmount": "0.00123456",
    "fees": {
      "asset": "BTC.BTC",
      "amount": "0.0001"
    }
  },
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### 2. Vérifier l'état du serveur

**Endpoint** : `GET /api/health`

**Exemple de réponse** :
```json
{
  "status": "ok",
  "message": "Le serveur API de swap est opérationnel",
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

## Test de l'API

Vous pouvez tester l'API en utilisant le fichier HTML fourni (`swap-test.html`). Ouvrez ce fichier dans un navigateur et utilisez le formulaire pour effectuer des swaps.

Vous pouvez également utiliser des outils comme Postman ou curl pour tester l'API :

```bash
curl -X POST http://localhost:3023/api/swaps \
  -H "Content-Type: application/json" \
  -d '{"sourceAssetString":"THOR.RUNE","destinationAssetString":"BTC.BTC","amount":"0.1"}'
```

## Sécurité

⚠️ **Attention** : Cette API utilise une phrase mnémonique stockée dans un fichier `.env`. Dans un environnement de production, vous devriez utiliser un système de gestion des secrets plus sécurisé.

## Dépannage

Si vous rencontrez des erreurs, vérifiez les points suivants :

1. Assurez-vous que votre clé API SwapKit est valide et active.
2. Vérifiez que votre phrase mnémonique est correcte et dispose de fonds suffisants.
3. Vérifiez que les assets que vous essayez d'échanger sont supportés par SwapKit.
4. Consultez les logs du serveur pour plus de détails sur les erreurs.
