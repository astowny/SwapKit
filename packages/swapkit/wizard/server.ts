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
    if (swapResult?.status === 'error') {
      // Déterminer le code HTTP approprié en fonction du type d'erreur
      let statusCode = 500; // Code par défaut pour les erreurs serveur

      // Mapper les codes d'erreur aux codes HTTP appropriés
      const errorCodeToHttpStatus = {
        'INSUFFICIENT_BALANCE': 400,
        'NO_BALANCE_FOUND': 400,
        'SAFE_TRANSACTION_FAILURE': 400,
        'CONTRACT_EXECUTION_FAILED': 400,
        'UNKNOWN_ERROR': 500
      };

      statusCode = errorCodeToHttpStatus[swapResult.errorCode] || 500;

      return res.status(statusCode).json({
        status: 'error',
        errorCode: swapResult.errorCode,
        error: swapResult.errorMessage,
        details: swapResult.errorDetails,
        timestamp: swapResult.timestamp || new Date().toISOString()
      });
    } else {
      return res.json({
        status: 'success',
        data: swapResult,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Erreur lors du traitement du swap:', error);

    // Analyser l'erreur pour déterminer le code HTTP approprié
    let statusCode = 500;
    let errorCode = 'SERVER_ERROR';
    let errorMessage = error.message || 'Une erreur est survenue lors du traitement du swap';
    let errorDetails = {};

    // Extraire les détails de l'erreur si disponibles
    if (error.code === 'VALIDATION_ERROR' ||
        errorMessage.includes('Paramètres manquants') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('Invalid')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (error.code === 'NOT_FOUND' || errorMessage.includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    }

    // Capturer les détails supplémentaires si disponibles
    if (error.details) {
      errorDetails = error.details;
    } else if (error.stack) {
      // En environnement de développement uniquement, inclure la stack trace
      if (process.env.NODE_ENV === 'development') {
        errorDetails.stack = error.stack;
      }
    }

    return res.status(statusCode).json({
      status: 'error',
      errorCode,
      error: errorMessage,
      details: errorDetails,
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
