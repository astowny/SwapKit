import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { executeRealSwap } from './core/swap/realSwap.ts';

// Charger les variables d'environnement depuis .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3023;

// Middleware pour parser le JSON et activer CORS
app.use(express.json());
app.use(cors());

// Endpoint pour effectuer un swap
app.post('/api/swaps', async (req, res) => {
  try {
    const { sourceAssetString, destinationAssetString, amount, slippage = 3 } = req.body;

    // Validation des paramètres obligatoires
    if (!sourceAssetString || !destinationAssetString || !amount) {
      return res.status(400).json({
        status: 'error',
        error: 'Paramètres manquants. sourceAssetString, destinationAssetString et amount sont obligatoires.'
      });
    }

    console.log(`Demande de swap reçue: ${amount} ${sourceAssetString} → ${destinationAssetString}`);

    // Exécuter le swap avec les options fournies
    const swapResult = await executeRealSwap({
      sourceAssetString,
      destinationAssetString,
      amount,
      slippage,
      enableDebug: false // Désactiver les logs de débogage par défaut
    });

    // Retourner le résultat du swap
    return res.json({
      status: swapResult?.status || 'success',
      data: swapResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur lors du traitement du swap:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message || 'Une erreur est survenue lors du traitement du swap',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour vérifier l'état du serveur
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    message: 'Le serveur API de swap est opérationnel',
    timestamp: new Date().toISOString()
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur API de swap démarré sur le port ${PORT}`);
  console.log(`Endpoint de swap disponible sur http://localhost:${PORT}/api/swaps`);
  console.log(`Endpoint de santé disponible sur http://localhost:${PORT}/api/health`);
});
