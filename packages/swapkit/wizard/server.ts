import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { Chain } from '@swapkit/helpers';

import { executeRealSwap } from './core/swap/realSwap';
import { getAllChainBalances, getChainBalance, thorchainSupportedChains } from './core/balance/getAllBalances';
import { getEthBalance } from './core/balance/getEthBalance';
import swaggerSpec from './swagger';
import { getSwapKitClient } from './core/swap/client';
import { connectKeystoreWrapper } from './core/connectKeystore-wrapper';

// Charger les variables d'environnement depuis .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3023;

// Middleware pour parser le JSON et activer CORS
app.use(express.json());
app.use(cors());

// Configuration de Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Endpoint pour obtenir la spécification Swagger au format JSON
app.get('/swagger.json', (_: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

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
        'EMPTY_QUOTE_RESPONSE': 404,
        'API_RESPONSE_PROCESSING_ERROR': 502,
        'UNKNOWN_ERROR': 500
      };

      statusCode = swapResult.errorCode && errorCodeToHttpStatus[swapResult.errorCode as keyof typeof errorCodeToHttpStatus] || 500;

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

// Endpoint pour récupérer les balances de toutes les chaînes
app.get('/api/balances', async (_: any, res: any) => {
  try {
    const result = await getAllChainBalances();
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la récupération des balances:', error);
    res.status(500).json({
      status: 'error',
      errorCode: 'BALANCE_RETRIEVAL_ERROR',
      errorMessage: 'Erreur lors de la récupération des balances',
      errorDetails: {
        message: error.message,
        name: error.name
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour récupérer les balances d'une chaîne spécifique
app.get('/api/balances/:chain', async (req: any, res: any) => {
  try {
    const { chain } = req.params;

    // Vérifier si la chaîne est supportée
    if (!thorchainSupportedChains.includes(chain)) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'UNSUPPORTED_CHAIN',
        errorMessage: `La chaîne ${chain} n'est pas supportée par THORChain`,
        timestamp: new Date().toISOString()
      });
    }

    const result = await getChainBalance(chain);
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la récupération des balances:', error);
    res.status(500).json({
      status: 'error',
      errorCode: 'BALANCE_RETRIEVAL_ERROR',
      errorMessage: 'Erreur lors de la récupération des balances',
      errorDetails: {
        message: error.message,
        name: error.name
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour récupérer uniquement les balances Ethereum (version simplifiée)
app.get('/api/eth-balance', async (_: any, res: any) => {
  try {
    const result = await getEthBalance();
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la récupération des balances Ethereum:', error);
    res.status(500).json({
      status: 'error',
      errorCode: 'ETH_BALANCE_RETRIEVAL_ERROR',
      errorMessage: 'Erreur lors de la récupération des balances Ethereum',
      errorDetails: {
        message: error.message,
        name: error.name
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour récupérer les adresses utilisées pour vérifier les balances
app.get('/api/addresses', async (_: any, res: any) => {
  try {
    // Initialiser SwapKit
    const swapKit = getSwapKitClient();

    // Vérifier si la phrase mnémonique est configurée
    if (!process.env.MNEMONIC) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'MNEMONIC_NOT_CONFIGURED',
        errorMessage: "La phrase mnémonique n'est pas configurée dans le fichier .env (variable MNEMONIC)",
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Phrase mnémonique trouvée (${process.env.MNEMONIC.split(' ').length} mots)`);

    // Obtenir les adresses pour chaque chaîne supportée
    const addresses: Record<string, string> = {};

    // Fonction pour récupérer l'adresse d'une chaîne spécifique
    async function getChainAddress(chain: Chain): Promise<{ chain: Chain, address: string }> {
      try {
        console.log(`Récupération de l'adresse pour ${chain}...`);

        // Vérifier si nous avons déjà une adresse pour cette chaîne
        let address = swapKit.getAddress(chain);

        // Si nous n'avons pas d'adresse, essayer de connecter le wallet
        if (!address) {
          console.log(`Connexion du wallet pour ${chain} en utilisant le wrapper...`);
          try {
            await connectKeystoreWrapper({
              phrase: process.env.MNEMONIC,
              chains: chain
            });
            console.log(`✅ Wallet connecté avec succès pour ${chain}`);

            // Récupérer l'adresse après la connexion
            address = swapKit.getAddress(chain);
          } catch (chainConnectError) {
            console.error(`Erreur lors de la connexion du wallet pour ${chain}:`, chainConnectError.message);
          }
        }

        // Traitement spécial pour Dogecoin qui peut causer des erreurs
        if (chain === Chain.Dogecoin && !address) {
          console.log(`Traitement spécial pour ${chain} en raison de problèmes connus`);
          try {
            // Connecter le wallet avec la phrase mnémonique pour Dogecoin
            await swapKit.connectKeystore({
              phrase: process.env.MNEMONIC,
              chains: [Chain.Dogecoin]
            });
            address = swapKit.getAddress(chain);
          } catch (dogeError) {
            console.error(`Impossible de connecter le wallet pour ${chain}:`, dogeError.message);
          }
        }

        // Afficher le résultat
        if (address) {
          console.log(`✅ Adresse pour ${chain}: ${address}`);
        } else {
          console.log(`❌ Aucune adresse trouvée pour ${chain}`);
        }

        return { chain, address: address || '' };
      } catch (error) {
        console.error(`Erreur lors de la récupération de l'adresse pour ${chain}:`, error.message || error);
        return { chain, address: '' };
      }
    }

    // Connecter le wallet en utilisant notre wrapper qui est plus fiable
    console.log("Connexion du wallet pour toutes les chaînes supportées en utilisant le wrapper...");
    try {
      await connectKeystoreWrapper({chains: thorchainSupportedChains, phrase: process.env.MNEMONIC});
      console.log("✅ Wallet connecté avec succès pour toutes les chaînes");
    } catch (connectError) {
      console.error("Erreur lors de la connexion du wallet pour toutes les chaînes:", connectError.message);
      console.log("Tentative de connexion individuelle pour chaque chaîne...");
    }

    // Récupérer les adresses en parallèle
    console.log(`Lancement des requêtes en parallèle pour ${thorchainSupportedChains.length} chaînes...`);
    const startTime = Date.now();

    // Exécuter les requêtes en parallèle avec Promise.all
    const results = await Promise.all(
      thorchainSupportedChains.map(chain => getChainAddress(chain))
    );

    const endTime = Date.now();
    console.log(`Toutes les requêtes terminées en ${(endTime - startTime) / 1000} secondes`);

    // Traiter les résultats
    for (const result of results) {
      addresses[result.chain] = result.address;
    }

    res.json({
      status: 'success',
      data: {
        addresses
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des adresses:', error);
    res.status(500).json({
      status: 'error',
      errorCode: 'ADDRESS_RETRIEVAL_ERROR',
      errorMessage: 'Erreur lors de la récupération des adresses',
      errorDetails: {
        message: error.message,
        name: error.name
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour tester les variables d'environnement
app.get('/api/test-env', (_: any, res: any) => {
  try {
    // Vérifier si la variable MNEMONIC est définie
    const hasMnemonic = !!process.env.MNEMONIC;
    const mnemonicLength = hasMnemonic && process.env.MNEMONIC ? process.env.MNEMONIC.split(' ').length : 0;

    // Vérifier les autres variables d'environnement importantes
    const envVars = {
      PORT: process.env.PORT || '3023',
      NODE_ENV: process.env.NODE_ENV || 'development',
      MNEMONIC: hasMnemonic ? `Défini (${mnemonicLength} mots)` : 'Non défini',
      SWAPKIT_API_KEY: process.env.SWAPKIT_API_KEY ? 'Défini' : 'Non défini',
      ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY ? 'Défini' : 'Non défini'
    };

    // Informations sur le serveur
    const serverInfo = {
      timestamp: new Date().toISOString(),
      uptime: `${process.uptime().toFixed(1)} secondes`
    };

    res.json({
      status: 'success',
      message: 'Test des variables d\'environnement',
      data: {
        environment: envVars,
        server: serverInfo
      }
    });
  } catch (error) {
    console.error('Erreur lors du test des variables d\'environnement:', error);
    res.status(500).json({
      status: 'error',
      errorCode: 'ENV_TEST_ERROR',
      errorMessage: 'Erreur lors du test des variables d\'environnement',
      errorDetails: {
        message: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour vérifier l'état du serveur
app.get('/api/health', (_: any, res: any) => {
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
  console.log(`Endpoint de balances disponible sur http://localhost:${PORT}/api/balances`);
  console.log(`Endpoint de balances Ethereum disponible sur http://localhost:${PORT}/api/eth-balance`);
  console.log(`Endpoint d'adresses disponible sur http://localhost:${PORT}/api/addresses`);
  console.log(`Endpoint de test d'environnement disponible sur http://localhost:${PORT}/api/test-env`);
  console.log(`Endpoint de santé disponible sur http://localhost:${PORT}/api/health`);
  console.log(`Documentation Swagger disponible sur http://localhost:${PORT}/api-docs`);
});
