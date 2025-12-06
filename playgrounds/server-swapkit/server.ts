import cors from "cors";
import * as dotenv from "dotenv";
// Import des dépendances principales
import express from "express";
import swaggerUi from "swagger-ui-express";

// Import direct des modules SwapKit
import { Chain } from "@swapkit/helpers";
console.log("✅ Chain importé depuis les sources SwapKit");

import {
  getAllChainBalances,
  getChainBalance,
  thorchainSupportedChains,
} from "./core/balance/getAllBalances.js";
import { getEthBalance } from "./core/balance/getEthBalance.js";
import { connectKeystoreWrapper } from "./core/connectKeystore-wrapper.js";
import { getSwapKitClient } from "./core/swap/client.js";
import {
  executeRealSwap,
  enableSwapDebug,
  disableSwapDebug,
  setAmountModeToTargetToken,
  setAmountModeToUsdtAmount,
  getCurrentAmountMode
} from "./core/swap/realSwap.js";

// V2 imports - Following SwapKit documentation
import {
  getSwapQuoteV2,
  executeFullSwapV2,
  getBalanceV2,
  getWalletWithBalanceV2,
  connectWalletsV2,
} from "./core/swap/realSwapV2.js";
import { FeeOption } from "@swapkit/helpers";

// Autres imports
import { specs } from "./swagger.config.js";

console.log("✅ Tous les imports SwapKit chargés avec succès");

// Charger les variables d'environnement depuis .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3023;

// Middleware pour parser le JSON et activer CORS
app.use(express.json());
app.use(cors());

// Middleware d'authentification par clé API
const authenticateApiKey = (req: any, res: any, next: any) => {
  // Exclure certains endpoints de l'authentification (documentation, health check, page d'accueil)
  const publicEndpoints = ['/', '/health', '/api/health', '/api-docs', '/swagger.json'];
  const isPublicEndpoint = publicEndpoints.some(endpoint =>
    req.path === endpoint || req.path.startsWith('/api-docs')
  );

  if (isPublicEndpoint) {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const expectedApiKey = process.env.API_SECRET_KEY;

  if (!expectedApiKey) {
    console.error('❌ API_SECRET_KEY non configurée dans le fichier .env');
    return res.status(500).json({
      status: 'error',
      errorCode: 'SERVER_CONFIGURATION_ERROR',
      error: 'Clé API secrète non configurée sur le serveur',
      timestamp: new Date().toISOString()
    });
  }

  if (!apiKey) {
    return res.status(401).json({
      status: 'error',
      errorCode: 'MISSING_API_KEY',
      error: 'Clé API manquante. Veuillez fournir la clé API dans le header "x-api-key" ou "Authorization: Bearer <key>"',
      timestamp: new Date().toISOString()
    });
  }

  if (apiKey !== expectedApiKey) {
    console.warn(`⚠️ Tentative d'accès avec une clé API invalide: ${apiKey.substring(0, 10)}...`);
    return res.status(403).json({
      status: 'error',
      errorCode: 'INVALID_API_KEY',
      error: 'Clé API invalide',
      timestamp: new Date().toISOString()
    });
  }

  // Clé API valide, continuer
  next();
};

// Appliquer le middleware d'authentification à tous les endpoints
app.use(authenticateApiKey);

// Configuration Swagger
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "SwapKit API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true
    }
  }),
);

/**
 * @swagger
 * /:
 *   get:
 *     summary: Page d'accueil de l'API
 *     description: Redirige vers la documentation Swagger
 *     tags: [General]
 *     responses:
 *       200:
 *         description: Informations sur l'API
 */
app.get("/", (req, res) => {
  res.json({
    name: "SwapKit API Server",
    version: "1.0.0",
    description: "API pour les opérations de swap et de gestion de portefeuille",
    documentation: "/api-docs",
    authentication: {
      required: true,
      method: "API Key",
      header: "x-api-key ou Authorization: Bearer <key>",
      note: "Tous les endpoints (sauf /, /health, /api-docs) nécessitent une clé API valide"
    },
    endpoints: {
      swaps: "/api/swaps",
      balances: "/api/balances",
      health: "/health",
    },
  });
});

// Endpoint pour obtenir la spécification Swagger au format JSON - temporairement désactivé
// app.get('/swagger.json', (_: any, res: any) => {
//   res.setHeader('Content-Type', 'application/json');
//   res.send(swaggerSpec);
// });

/**
 * @swagger
 * /api/swaps:
 *   post:
 *     summary: Effectuer un swap entre deux assets
 *     description: Exécute un swap en utilisant SwapKit avec les paramètres fournis
 *     tags: [Swaps]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwapRequest'
 *           example:
 *             sourceAssetString: "ETH.ETH"
 *             destinationAssetString: "BTC.BTC"
 *             amount: "1"
 *             slippage: 3
 *     responses:
 *       200:
 *         description: Swap exécuté avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 txHash:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Paramètres manquants ou invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/api/swaps", async (req, res) => {
  try {
    const { sourceAssetString, destinationAssetString, amount, slippage = 3 } = req.body;

    // Validation des paramètres obligatoires
    if (!sourceAssetString || !destinationAssetString || !amount) {
      return res.status(400).json({
        status: "error",
        error:
          "Paramètres manquants. sourceAssetString, destinationAssetString et amount sont obligatoires.",
      });
    }

    console.log(
      `Demande de swap reçue: ${amount} ${sourceAssetString} → ${destinationAssetString}`,
    );

    // Exécuter le swap avec les options fournies
    const swapResult = await executeRealSwap({
      sourceAssetString,
      destinationAssetString,
      amount,
      slippage,
      enableDebug: false, // Désactiver les logs de débogage par défaut
    });

    // Retourner le résultat du swap
    if (swapResult?.status === "error") {
      // Déterminer le code HTTP approprié en fonction du type d'erreur
      let statusCode = 500; // Code par défaut pour les erreurs serveur

      // Mapper les codes d'erreur aux codes HTTP appropriés
      const errorCodeToHttpStatus = {
        INSUFFICIENT_BALANCE: 400,
        NO_BALANCE_FOUND: 400,
        SAFE_TRANSACTION_FAILURE: 400,
        CONTRACT_EXECUTION_FAILED: 400,
        EMPTY_QUOTE_RESPONSE: 404,
        API_RESPONSE_PROCESSING_ERROR: 502,
        UNKNOWN_ERROR: 500,
      };

      statusCode =
        (swapResult.errorCode &&
          errorCodeToHttpStatus[swapResult.errorCode as keyof typeof errorCodeToHttpStatus]) ||
        500;

      return res.status(statusCode).json({
        status: "error",
        errorCode: swapResult.errorCode,
        error: swapResult.errorMessage,
        details: swapResult.errorDetails,
        timestamp: swapResult.timestamp || new Date().toISOString(),
      });
    } else {
      return res.json({
        status: "success",
        data: swapResult,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Erreur lors du traitement du swap:", error);

    // Analyser l'erreur pour déterminer le code HTTP approprié
    let statusCode = 500;
    let errorCode = "SERVER_ERROR";
    const errorMessage = error.message || "Une erreur est survenue lors du traitement du swap";
    let errorDetails = {};

    // Extraire les détails de l'erreur si disponibles
    if (
      error.code === "VALIDATION_ERROR" ||
      errorMessage.includes("Paramètres manquants") ||
      errorMessage.includes("invalid") ||
      errorMessage.includes("Invalid")
    ) {
      statusCode = 400;
      errorCode = "VALIDATION_ERROR";
    } else if (error.code === "NOT_FOUND" || errorMessage.includes("not found")) {
      statusCode = 404;
      errorCode = "NOT_FOUND";
    }

    // Capturer les détails supplémentaires si disponibles
    if (error.details) {
      errorDetails = error.details;
    } else if (error.stack) {
      // En environnement de développement uniquement, inclure la stack trace
      if (process.env.NODE_ENV === "development") {
        errorDetails.stack = error.stack;
      }
    }

    return res.status(statusCode).json({
      status: "error",
      errorCode,
      error: errorMessage,
      details: errorDetails,
      timestamp: new Date().toISOString(),
    });
  }
});

// =============================================================================
// V2 ENDPOINTS - Following SwapKit Documentation
// https://swapkit.github.io/SwapKit/start/getting-started/
// https://swapkit.github.io/SwapKit/guides/actions/swap/
// =============================================================================

/**
 * @swagger
 * /api/v2/quote:
 *   post:
 *     summary: Get swap quote (V2 - Following SwapKit docs)
 *     description: |
 *       Get swap quotes using the recommended SwapKitApi.getSwapQuote() method.
 *       Returns available routes with expected amounts, fees, and estimated times.
 *
 *       Based on: https://swapkit.github.io/SwapKit/guides/actions/swap/
 *     tags: [V2 - Swaps]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sellAsset
 *               - buyAsset
 *               - sellAmount
 *             properties:
 *               sellAsset:
 *                 type: string
 *                 description: Asset to sell (e.g., "ETH.ETH")
 *                 example: "ETH.ETH"
 *               buyAsset:
 *                 type: string
 *                 description: Asset to buy (e.g., "BTC.BTC")
 *                 example: "BTC.BTC"
 *               sellAmount:
 *                 type: string
 *                 description: Amount to sell
 *                 example: "0.1"
 *               sourceAddress:
 *                 type: string
 *                 description: Source wallet address (optional)
 *               destinationAddress:
 *                 type: string
 *                 description: Destination address for swapped tokens
 *               slippage:
 *                 type: number
 *                 description: Slippage tolerance in percentage (default 3)
 *                 default: 3
 *     responses:
 *       200:
 *         description: Quote retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 routes:
 *                   type: array
 *                   items:
 *                     type: object
 *                 meta:
 *                   type: object
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
app.post("/api/v2/quote", async (req, res) => {
  try {
    const { sellAsset, buyAsset, sellAmount, sourceAddress, destinationAddress, slippage = 3 } = req.body;

    // Validation
    if (!sellAsset || !buyAsset || !sellAmount) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: sellAsset, buyAsset, sellAmount",
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[V2] Quote request: ${sellAmount} ${sellAsset} → ${buyAsset}`);

    const quoteResult = await getSwapQuoteV2({
      sellAsset,
      buyAsset,
      sellAmount,
      sourceAddress,
      destinationAddress,
      slippage,
    });

    if (!quoteResult.success) {
      return res.status(400).json({
        success: false,
        error: quoteResult.error,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      routes: quoteResult.routes,
      meta: quoteResult.meta,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[V2] Error getting quote:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @swagger
 * /api/v2/swaps:
 *   post:
 *     summary: Execute swap (V2 - Following SwapKit docs)
 *     description: |
 *       Execute a swap using the recommended SwapKit flow:
 *       1. Get quote with SwapKitApi.getSwapQuote()
 *       2. Execute with swapKit.swap({ route, feeOptionKey })
 *
 *       Based on: https://swapkit.github.io/SwapKit/guides/actions/swap/
 *     tags: [V2 - Swaps]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sellAsset
 *               - buyAsset
 *               - sellAmount
 *             properties:
 *               sellAsset:
 *                 type: string
 *                 description: Asset to sell (e.g., "ETH.ETH")
 *                 example: "ETH.ETH"
 *               buyAsset:
 *                 type: string
 *                 description: Asset to buy (e.g., "BTC.BTC")
 *                 example: "BTC.BTC"
 *               sellAmount:
 *                 type: string
 *                 description: Amount to sell
 *                 example: "0.1"
 *               sourceAddress:
 *                 type: string
 *                 description: Source wallet address (optional - uses connected wallet)
 *               destinationAddress:
 *                 type: string
 *                 description: Destination address for swapped tokens
 *               slippage:
 *                 type: number
 *                 description: Slippage tolerance in percentage (default 3)
 *                 default: 3
 *               feeOption:
 *                 type: string
 *                 enum: [Fast, Average, Fastest]
 *                 description: Fee option for transaction (Fast, Average, or Fastest)
 *                 default: Fast
 *               routeIndex:
 *                 type: number
 *                 description: Index of route to use (0 = best route)
 *                 default: 0
 *     responses:
 *       200:
 *         description: Swap executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 txHash:
 *                   type: string
 *                 route:
 *                   type: object
 *                 timestamp:
 *                   type: string
 *       400:
 *         description: Invalid parameters or swap failed
 *       500:
 *         description: Server error
 */
app.post("/api/v2/swaps", async (req, res) => {
  try {
    const {
      sellAsset,
      buyAsset,
      sellAmount,
      sourceAddress,
      destinationAddress,
      slippage = 3,
      feeOption = "Fast",
      routeIndex = 0
    } = req.body;

    // Validation
    if (!sellAsset || !buyAsset || !sellAmount) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: sellAsset, buyAsset, sellAmount",
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[V2] Swap request: ${sellAmount} ${sellAsset} → ${buyAsset}`);

    // Map string fee option to FeeOption enum
    const feeOptionMap: Record<string, FeeOption> = {
      "Fast": FeeOption.Fast,
      "Average": FeeOption.Average,
      "Fastest": FeeOption.Fastest,
    };
    const feeOptionKey = feeOptionMap[feeOption] || FeeOption.Fast;

    const swapResult = await executeFullSwapV2({
      sellAsset,
      buyAsset,
      sellAmount,
      sourceAddress,
      destinationAddress,
      slippage,
      feeOptionKey,
      routeIndex,
    });

    if (!swapResult.success) {
      return res.status(400).json({
        success: false,
        error: swapResult.error,
        errorCode: swapResult.errorCode,
        timestamp: swapResult.timestamp,
      });
    }

    return res.json({
      success: true,
      txHash: swapResult.txHash,
      route: swapResult.route,
      timestamp: swapResult.timestamp,
    });
  } catch (error: any) {
    console.error("[V2] Error executing swap:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @swagger
 * /api/v2/balances/{chain}:
 *   get:
 *     summary: Get balance for a chain (V2 - Following SwapKit docs)
 *     description: |
 *       Get wallet balance for a specific chain using the recommended swapKit.getBalance() method.
 *
 *       Based on: https://swapkit.github.io/SwapKit/start/getting-started/
 *     tags: [V2 - Balances]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chain
 *         required: true
 *         schema:
 *           type: string
 *         description: Chain identifier (e.g., Ethereum, Bitcoin, THORChain)
 *         example: Ethereum
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Force refresh balance from chain
 *         default: false
 *     responses:
 *       200:
 *         description: Balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 chain:
 *                   type: string
 *                 balance:
 *                   type: array
 *                 timestamp:
 *                   type: string
 *       400:
 *         description: Invalid chain
 *       500:
 *         description: Server error
 */
app.get("/api/v2/balances/:chain", async (req, res) => {
  try {
    const { chain } = req.params;
    const refresh = req.query.refresh === "true";

    console.log(`[V2] Balance request for chain: ${chain}, refresh: ${refresh}`);

    // Validate chain
    const chainEnum = Chain[chain as keyof typeof Chain];
    if (!chainEnum) {
      return res.status(400).json({
        success: false,
        error: `Invalid chain: ${chain}. Valid chains: ${Object.keys(Chain).join(", ")}`,
        timestamp: new Date().toISOString(),
      });
    }

    const balance = await getBalanceV2(chainEnum, refresh);

    return res.json({
      success: true,
      chain: chain,
      balance,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[V2] Error getting balance:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @swagger
 * /api/v2/wallet/{chain}:
 *   get:
 *     summary: Get wallet with balance (V2 - Following SwapKit docs)
 *     description: |
 *       Get wallet address and balance for a specific chain.
 *
 *       Based on: https://swapkit.github.io/SwapKit/start/getting-started/
 *     tags: [V2 - Balances]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chain
 *         required: true
 *         schema:
 *           type: string
 *         description: Chain identifier (e.g., Ethereum, Bitcoin, THORChain)
 *         example: Ethereum
 *     responses:
 *       200:
 *         description: Wallet info retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 chain:
 *                   type: string
 *                 address:
 *                   type: string
 *                 balance:
 *                   type: array
 *                 timestamp:
 *                   type: string
 *       400:
 *         description: Invalid chain
 *       500:
 *         description: Server error
 */
app.get("/api/v2/wallet/:chain", async (req, res) => {
  try {
    const { chain } = req.params;

    console.log(`[V2] Wallet request for chain: ${chain}`);

    // Validate chain
    const chainEnum = Chain[chain as keyof typeof Chain];
    if (!chainEnum) {
      return res.status(400).json({
        success: false,
        error: `Invalid chain: ${chain}. Valid chains: ${Object.keys(Chain).join(", ")}`,
        timestamp: new Date().toISOString(),
      });
    }

    const walletWithBalance = await getWalletWithBalanceV2(chainEnum);

    return res.json({
      success: true,
      chain: chain,
      address: walletWithBalance?.address,
      balance: walletWithBalance?.balance,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[V2] Error getting wallet:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @swagger
 * /api/v2/connect:
 *   post:
 *     summary: Connect wallets (V2 - Following SwapKit docs)
 *     description: |
 *       Connect wallets for specified chains using the keystore.
 *
 *       Based on: https://swapkit.github.io/SwapKit/guides/actions/connecting/
 *     tags: [V2 - Wallet]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chains
 *             properties:
 *               chains:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of chains to connect
 *                 example: ["Ethereum", "Bitcoin", "THORChain"]
 *     responses:
 *       200:
 *         description: Wallets connected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 connectedChains:
 *                   type: array
 *                   items:
 *                     type: string
 *                 timestamp:
 *                   type: string
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
app.post("/api/v2/connect", async (req, res) => {
  try {
    const { chains } = req.body;

    if (!chains || !Array.isArray(chains) || chains.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid 'chains' parameter. Provide an array of chain names.",
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[V2] Connect request for chains: ${chains.join(", ")}`);

    // Validate and convert chains
    const chainEnums: Chain[] = [];
    const invalidChains: string[] = [];

    for (const chain of chains) {
      const chainEnum = Chain[chain as keyof typeof Chain];
      if (chainEnum) {
        chainEnums.push(chainEnum);
      } else {
        invalidChains.push(chain);
      }
    }

    if (invalidChains.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid chains: ${invalidChains.join(", ")}. Valid chains: ${Object.keys(Chain).join(", ")}`,
        timestamp: new Date().toISOString(),
      });
    }

    await connectWalletsV2(chainEnums);

    return res.json({
      success: true,
      connectedChains: chains,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[V2] Error connecting wallets:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @swagger
 * /api/balances:
 *   get:
 *     summary: Récupérer les balances de toutes les chaînes
 *     description: Obtient les balances de tous les tokens sur toutes les chaînes supportées avec les prix en USD
 *     tags: [Balances]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Balances récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balances:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Balance'
 *                 totalValueUSD:
 *                   type: number
 *                   description: Valeur totale en USD
 *                 _meta:
 *                   type: object
 *                   properties:
 *                     executionTimeMs:
 *                       type: number
 *                     executionTimeSec:
 *                       type: number
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Erreur lors de la récupération des balances
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/api/balances", async (_: any, res: any) => {
  // Démarrer le timer
  const startTime = Date.now();
  console.log(`⏱️ [${new Date().toISOString()}] Début de la récupération des balances...`);

  try {
    const result = await getAllChainBalances();

    // Calculer le temps d'exécution
    const endTime = Date.now();
    const executionTimeMs = endTime - startTime;
    const executionTimeSec = (executionTimeMs / 1000).toFixed(2);

    console.log(
      `✅ [${new Date().toISOString()}] Récupération des balances terminée en ${executionTimeSec} secondes`,
    );

    // Ajouter le temps d'exécution à la réponse
    const resultWithTiming = {
      ...result,
      _meta: {
        executionTimeMs,
        executionTimeSec: Number.parseFloat(executionTimeSec),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      },
    };

    res.json(resultWithTiming);
  } catch (error) {
    // Calculer le temps jusqu'à l'erreur
    const errorTime = Date.now();
    const executionTimeMs = errorTime - startTime;
    const executionTimeSec = (executionTimeMs / 1000).toFixed(2);

    console.error(
      `❌ [${new Date().toISOString()}] Erreur lors de la récupération des balances après ${executionTimeSec} secondes:`,
      error,
    );

    res.status(500).json({
      status: "error",
      errorCode: "BALANCE_RETRIEVAL_ERROR",
      errorMessage: "Erreur lors de la récupération des balances",
      errorDetails: {
        message: error.message,
        name: error.name,
      },
      timestamp: new Date().toISOString(),
      _meta: {
        executionTimeMs,
        executionTimeSec: Number.parseFloat(executionTimeSec),
        startTime: new Date(startTime).toISOString(),
        errorTime: new Date(errorTime).toISOString(),
      },
    });
  }
});

// Endpoint pour récupérer les balances d'une chaîne spécifique
app.get("/api/balances/:chain", async (req: any, res: any) => {
  // Démarrer le timer
  const startTime = Date.now();
  const { chain } = req.params;
  console.log(
    `⏱️ [${new Date().toISOString()}] Début de la récupération des balances pour ${chain}...`,
  );

  try {
    // Vérifier si la chaîne est supportée
    if (!thorchainSupportedChains.includes(chain)) {
      console.log(`❌ [${new Date().toISOString()}] Chaîne ${chain} non supportée`);
      return res.status(400).json({
        status: "error",
        errorCode: "UNSUPPORTED_CHAIN",
        errorMessage: `La chaîne ${chain} n'est pas supportée par THORChain`,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await getChainBalance(chain);

    // Calculer le temps d'exécution
    const endTime = Date.now();
    const executionTimeMs = endTime - startTime;
    const executionTimeSec = (executionTimeMs / 1000).toFixed(2);

    console.log(
      `✅ [${new Date().toISOString()}] Récupération des balances pour ${chain} terminée en ${executionTimeSec} secondes`,
    );

    // Ajouter le temps d'exécution à la réponse
    const resultWithTiming = {
      ...result,
      _meta: {
        chain,
        executionTimeMs,
        executionTimeSec: Number.parseFloat(executionTimeSec),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      },
    };

    res.json(resultWithTiming);
  } catch (error) {
    // Calculer le temps jusqu'à l'erreur
    const errorTime = Date.now();
    const executionTimeMs = errorTime - startTime;
    const executionTimeSec = (executionTimeMs / 1000).toFixed(2);

    console.error(
      `❌ [${new Date().toISOString()}] Erreur lors de la récupération des balances pour ${chain} après ${executionTimeSec} secondes:`,
      error,
    );

    res.status(500).json({
      status: "error",
      errorCode: "BALANCE_RETRIEVAL_ERROR",
      errorMessage: "Erreur lors de la récupération des balances",
      errorDetails: {
        message: error.message,
        name: error.name,
      },
      timestamp: new Date().toISOString(),
      _meta: {
        chain,
        executionTimeMs,
        executionTimeSec: Number.parseFloat(executionTimeSec),
        startTime: new Date(startTime).toISOString(),
        errorTime: new Date(errorTime).toISOString(),
      },
    });
  }
});

// Endpoint pour récupérer uniquement les balances Ethereum (version simplifiée)
app.get("/api/eth-balance", async (_: any, res: any) => {
  // Démarrer le timer
  const startTime = Date.now();
  console.log(`⏱️ [${new Date().toISOString()}] Début de la récupération des balances Ethereum...`);

  try {
    const result = await getEthBalance();

    // Calculer le temps d'exécution
    const endTime = Date.now();
    const executionTimeMs = endTime - startTime;
    const executionTimeSec = (executionTimeMs / 1000).toFixed(2);

    console.log(
      `✅ [${new Date().toISOString()}] Récupération des balances Ethereum terminée en ${executionTimeSec} secondes`,
    );

    // Ajouter le temps d'exécution à la réponse
    const resultWithTiming = {
      ...result,
      _meta: {
        chain: "ETH",
        executionTimeMs,
        executionTimeSec: Number.parseFloat(executionTimeSec),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      },
    };

    res.json(resultWithTiming);
  } catch (error) {
    // Calculer le temps jusqu'à l'erreur
    const errorTime = Date.now();
    const executionTimeMs = errorTime - startTime;
    const executionTimeSec = (executionTimeMs / 1000).toFixed(2);

    console.error(
      `❌ [${new Date().toISOString()}] Erreur lors de la récupération des balances Ethereum après ${executionTimeSec} secondes:`,
      error,
    );

    res.status(500).json({
      status: "error",
      errorCode: "ETH_BALANCE_RETRIEVAL_ERROR",
      errorMessage: "Erreur lors de la récupération des balances Ethereum",
      errorDetails: {
        message: error.message,
        name: error.name,
      },
      timestamp: new Date().toISOString(),
      _meta: {
        chain: "ETH",
        executionTimeMs,
        executionTimeSec: Number.parseFloat(executionTimeSec),
        startTime: new Date(startTime).toISOString(),
        errorTime: new Date(errorTime).toISOString(),
      },
    });
  }
});

// Endpoint pour récupérer les adresses utilisées pour vérifier les balances
app.get("/api/addresses", async (_: any, res: any) => {
  // Démarrer le timer
  const startTime = Date.now();
  console.log(`⏱️ [${new Date().toISOString()}] Début de la récupération des adresses...`);

  try {
    // Initialiser SwapKit
    const swapKit = getSwapKitClient();

    // Vérifier si la phrase mnémonique est configurée
    if (!process.env.MNEMONIC) {
      console.log(`❌ [${new Date().toISOString()}] Phrase mnémonique non configurée`);
      return res.status(400).json({
        status: "error",
        errorCode: "MNEMONIC_NOT_CONFIGURED",
        errorMessage:
          "La phrase mnémonique n'est pas configurée dans le fichier .env (variable MNEMONIC)",
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`Phrase mnémonique trouvée (${process.env.MNEMONIC.split(" ").length} mots)`);

    // Obtenir les adresses pour chaque chaîne supportée
    const addresses: Record<string, string> = {};

    // Fonction pour récupérer l'adresse d'une chaîne spécifique
    async function getChainAddress(chain: Chain): Promise<{ chain: Chain; address: string }> {
      try {
        console.log(`Récupération de l'adresse pour ${chain}...`);

        // Vérifier si nous avons déjà une adresse pour cette chaîne
        let address = swapKit.getAddress(chain);

        // Si nous n'avons pas d'adresse, essayer de connecter le wallet
        if (!address) {
          console.log(`Connexion du wallet pour ${chain} en utilisant le wrapper...`);
          try {
            if (!process.env.MNEMONIC) {
              throw new Error("La phrase mnémonique n'est pas configurée");
            }
            await connectKeystoreWrapper({
              phrase: process.env.MNEMONIC,
              chains: chain,
            });
            console.log(`✅ Wallet connecté avec succès pour ${chain}`);

            // Récupérer l'adresse après la connexion
            address = swapKit.getAddress(chain);
          } catch (chainConnectError) {
            console.error(
              `Erreur lors de la connexion du wallet pour ${chain}:`,
              chainConnectError.message,
            );
          }
        }

        // Traitement spécial pour Dogecoin qui peut causer des erreurs
        if (chain === Chain.Dogecoin && !address) {
          console.log(`Traitement spécial pour ${chain} en raison de problèmes connus`);
          try {
            // Vérifier si la phrase mnémonique est configurée
            if (!process.env.MNEMONIC) {
              throw new Error("La phrase mnémonique n'est pas configurée");
            }
            // Connecter le wallet avec la phrase mnémonique pour Dogecoin
            await swapKit.connectKeystore({
              phrase: process.env.MNEMONIC,
              chains: [Chain.Dogecoin],
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

        return { chain, address: address || "" };
      } catch (error) {
        console.error(
          `Erreur lors de la récupération de l'adresse pour ${chain}:`,
          error.message || error,
        );
        return { chain, address: "" };
      }
    }

    // Connecter le wallet en utilisant notre wrapper qui est plus fiable
    console.log(
      "Connexion du wallet pour toutes les chaînes supportées en utilisant le wrapper...",
    );
    try {
      await connectKeystoreWrapper({
        chains: thorchainSupportedChains,
        phrase: process.env.MNEMONIC,
      });
      console.log("✅ Wallet connecté avec succès pour toutes les chaînes");
    } catch (connectError) {
      console.error(
        "Erreur lors de la connexion du wallet pour toutes les chaînes:",
        connectError.message,
      );
      console.log("Tentative de connexion individuelle pour chaque chaîne...");
    }

    // Récupérer les adresses en parallèle
    console.log(
      `Lancement des requêtes en parallèle pour ${thorchainSupportedChains.length} chaînes...`,
    );
    const startTime = Date.now();

    // Exécuter les requêtes en parallèle avec Promise.all
    const results = await Promise.all(
      thorchainSupportedChains.map((chain) => getChainAddress(chain)),
    );

    // Traiter les résultats
    for (const result of results) {
      addresses[result.chain] = result.address;
    }

    // Calculer le temps d'exécution
    const endTime = Date.now();
    const executionTimeMs = endTime - startTime;
    const executionTimeSec = (executionTimeMs / 1000).toFixed(2);

    console.log(
      `✅ [${new Date().toISOString()}] Récupération des adresses terminée en ${executionTimeSec} secondes`,
    );

    res.json({
      status: "success",
      data: {
        addresses,
      },
      timestamp: new Date().toISOString(),
      _meta: {
        executionTimeMs,
        executionTimeSec: Number.parseFloat(executionTimeSec),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      },
    });
  } catch (error) {
    // Calculer le temps jusqu'à l'erreur
    const errorTime = Date.now();
    const executionTimeMs = errorTime - startTime;
    const executionTimeSec = (executionTimeMs / 1000).toFixed(2);

    console.error(
      `❌ [${new Date().toISOString()}] Erreur lors de la récupération des adresses après ${executionTimeSec} secondes:`,
      error,
    );

    res.status(500).json({
      status: "error",
      errorCode: "ADDRESS_RETRIEVAL_ERROR",
      errorMessage: "Erreur lors de la récupération des adresses",
      errorDetails: {
        message: error.message,
        name: error.name,
      },
      timestamp: new Date().toISOString(),
      _meta: {
        executionTimeMs,
        executionTimeSec: Number.parseFloat(executionTimeSec),
        startTime: new Date(startTime).toISOString(),
        errorTime: new Date(errorTime).toISOString(),
      },
    });
  }
});

// Endpoint pour tester les variables d'environnement
app.get("/api/test-env", (_: any, res: any) => {
  try {
    // Vérifier si la variable MNEMONIC est définie
    const hasMnemonic = !!process.env.MNEMONIC;
    const mnemonicLength =
      hasMnemonic && process.env.MNEMONIC ? process.env.MNEMONIC.split(" ").length : 0;

    // Vérifier les autres variables d'environnement importantes
    const envVars = {
      PORT: process.env.PORT || "3023",
      NODE_ENV: process.env.NODE_ENV || "development",
      MNEMONIC: hasMnemonic ? `Défini (${mnemonicLength} mots)` : "Non défini",
      SWAPKIT_API_KEY: process.env.SWAPKIT_API_KEY ? "Défini" : "Non défini",
      ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY ? "Défini" : "Non défini",
    };

    // Informations sur le serveur
    const serverInfo = {
      timestamp: new Date().toISOString(),
      uptime: `${process.uptime().toFixed(1)} secondes`,
    };

    res.json({
      status: "success",
      message: "Test des variables d'environnement",
      data: {
        environment: envVars,
        server: serverInfo,
      },
    });
  } catch (error) {
    console.error("Erreur lors du test des variables d'environnement:", error);
    res.status(500).json({
      status: "error",
      errorCode: "ENV_TEST_ERROR",
      errorMessage: "Erreur lors du test des variables d'environnement",
      errorDetails: {
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Vérifier l'état du serveur
 *     description: Endpoint public pour vérifier que le serveur fonctionne correctement
 *     tags: [General]
 *     responses:
 *       200:
 *         description: Serveur opérationnel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 message:
 *                   type: string
 *                   example: "Le serveur API de swap est opérationnel"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get("/api/health", (_: any, res: any) => {
  res.json({
    status: "ok",
    message: "Le serveur API de swap est opérationnel",
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /api/auth-test:
 *   get:
 *     summary: Test d'authentification
 *     description: Endpoint protégé pour tester l'authentification par clé API
 *     tags: [General]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Authentification réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Authentification réussie"
 *                 authenticated:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Clé API manquante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Clé API invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get("/api/auth-test", (_: any, res: any) => {
  res.json({
    status: "success",
    message: "Authentification réussie ! Vous avez accès aux endpoints protégés.",
    authenticated: true,
    timestamp: new Date().toISOString(),
  });
});

// Endpoint pour activer le débogage des swaps
app.post('/api/debug/enable', (req: any, res: any) => {
  try {
    const { verbose = true } = req.body;
    enableSwapDebug(verbose);
    res.json({
      status: 'success',
      message: 'Mode débogage SwapKit activé',
      verbose: verbose,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors de l\'activation du débogage',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour désactiver le débogage des swaps
app.post('/api/debug/disable', (_: any, res: any) => {
  try {
    disableSwapDebug();
    res.json({
      status: 'success',
      message: 'Mode débogage SwapKit désactivé',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la désactivation du débogage',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour tester le débogage en profondeur avec un swap simple
app.post('/api/debug/test-swap', async (req: any, res: any) => {
  try {
    // Activer le débogage
    enableSwapDebug(true);

    // Paramètres de test par défaut
    const {
      fromAsset = "BTC.BTC",
      toAsset = "ETH.ETH",
      amount = "0.001"
    } = req.body;

    console.log(`\n🧪 Test de swap avec débogage en profondeur:`);
    console.log(`From: ${fromAsset} -> To: ${toAsset}, Amount: ${amount}`);

    // Exécuter le swap avec débogage complet
    const result = await executeRealSwap({
      sourceAssetString: fromAsset,
      destinationAssetString: toAsset,
      amount: amount,
      destinationAddress: undefined, // Utiliser l'adresse du wallet connecté
      waitForConfirmation: false // Ne pas attendre pour le test
    });

    res.json({
      status: 'success',
      message: 'Test de débogage terminé',
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erreur lors du test de débogage:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors du test de débogage',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  } finally {
    // Désactiver le débogage après le test
    disableSwapDebug();
  }
});

// Endpoints pour gérer le mode de calcul des montants
app.get('/api/amount-mode', (req: any, res: any) => {
  try {
    const currentMode = getCurrentAmountMode();
    res.json({
      status: 'success',
      currentMode: currentMode,
      description: currentMode === 'target-token'
        ? 'amount = montant du token cible'
        : 'amount = montant USDT à dépenser',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la récupération du mode',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/amount-mode/target-token', (req: any, res: any) => {
  try {
    setAmountModeToTargetToken();
    res.json({
      status: 'success',
      message: 'Mode changé: amount = montant du token cible',
      currentMode: 'target-token',
      description: 'Le paramètre amount représente maintenant le montant désiré du token cible',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors du changement de mode',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/amount-mode/usdt-amount', (req: any, res: any) => {
  try {
    setAmountModeToUsdtAmount();
    res.json({
      status: 'success',
      message: 'Mode changé: amount = montant USDT à dépenser',
      currentMode: 'usdt-amount',
      description: 'Le paramètre amount représente maintenant le montant USDT à dépenser',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors du changement de mode',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Initialiser le client SwapKit au démarrage du serveur
console.log("Initialisation du client SwapKit au démarrage du serveur...");
const startInitTime = Date.now();

// Obtenir l'instance du client SwapKit (initialise le singleton)
getSwapKitClient();
console.log("✅ Client SwapKit initialisé et prêt à être utilisé");

// ===== ENDPOINTS THORCHAIN LIQUIDITY =====

/**
 * @swagger
 * /api/liquidity/position:
 *   get:
 *     summary: Vérifier la position de liquidité THORChain
 *     description: Récupère les détails de la position de liquidité pour l'adresse THORChain connectée
 *     responses:
 *       200:
 *         description: Position de liquidité récupérée avec succès
 *       500:
 *         description: Erreur lors de la récupération de la position
 */
app.get('/api/liquidity/position', async (req: any, res: any) => {
  try {
    const swapKit = getSwapKitClient();
    const thorAddress = swapKit.getAddress(Chain.THORChain);

    if (!thorAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet THORChain non connecté',
        message: 'Veuillez connecter un wallet THORChain pour vérifier la position',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔍 Récupération de la position de liquidité pour: ${thorAddress}`);

    // Récupérer la position via l'API SwapKit
    const position = await swapKit.api.thorchainMidgard.getLiquidityPosition(thorAddress);

    res.json({
      success: true,
      position: {
        address: thorAddress,
        pools: position.pools || [],
        totalValueUSD: position.totalValueUSD || 0,
        totalPools: position.pools?.length || 0
      },
      details: position,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la position:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la position',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/liquidity/add:
 *   post:
 *     summary: Ajouter de la liquidité à THORChain
 *     description: Ajoute de la liquidité à un pool THORChain (symétrique ou asymétrique)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - asset
 *               - amount
 *             properties:
 *               asset:
 *                 type: string
 *                 description: Asset du pool (ex. BTC.BTC, ETH.ETH)
 *               amount:
 *                 type: string
 *                 description: Montant de l'asset à ajouter
 *               runeAmount:
 *                 type: string
 *                 description: Montant de RUNE (pour liquidité symétrique)
 *               mode:
 *                 type: string
 *                 enum: [sym, asset, baseAsset]
 *                 description: Mode de liquidité (sym=symétrique, asset=asset seulement, baseAsset=RUNE seulement)
 *     responses:
 *       200:
 *         description: Liquidité ajoutée avec succès
 *       400:
 *         description: Paramètres invalides
 *       500:
 *         description: Erreur lors de l'ajout de liquidité
 */
app.post('/api/liquidity/add', async (req: any, res: any) => {
  try {
    const { asset, amount, runeAmount, mode = 'sym' } = req.body;

    if (!asset || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants',
        message: 'asset et amount sont requis',
        timestamp: new Date().toISOString()
      });
    }

    const swapKit = getSwapKitClient();
    const thorAddress = swapKit.getAddress(Chain.THORChain);

    if (!thorAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet THORChain non connecté',
        message: 'Veuillez connecter un wallet THORChain',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`💰 Ajout de liquidité - Asset: ${asset}, Amount: ${amount}, Mode: ${mode}`);

    // Créer les AssetValue
    const { AssetValue } = await import('@swapkit/helpers');

    const assetValue = await AssetValue.from({ asset, value: amount });
    const runeAssetValue = runeAmount
      ? await AssetValue.from({ asset: 'THOR.RUNE', value: runeAmount })
      : await AssetValue.from({ asset: 'THOR.RUNE', value: 0 });

    // Déterminer la chaîne de l'asset
    const assetChain = assetValue.chain;
    const assetAddress = swapKit.getAddress(assetChain);

    const liquidityParams = {
      baseAssetValue: runeAssetValue,
      assetValue: assetValue,
      baseAssetAddr: thorAddress,
      assetAddr: assetAddress,
      mode: mode
    };

    console.log('📋 Paramètres de liquidité:', liquidityParams);

    // Ajouter la liquidité
    const result = await swapKit.thorchain.addLiquidity(liquidityParams);

    res.json({
      success: true,
      result: {
        baseAssetTx: result.baseAssetTx,
        assetTx: result.assetTx
      },
      details: {
        asset,
        amount,
        runeAmount: runeAmount || '0',
        mode,
        thorAddress,
        assetAddress
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout de liquidité:', JSON.stringify(error));
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'ajout de liquidité',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/liquidity/withdraw:
 *   post:
 *     summary: Retirer de la liquidité de THORChain
 *     description: Retire de la liquidité d'un pool THORChain
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - asset
 *               - percent
 *             properties:
 *               asset:
 *                 type: string
 *                 description: Asset du pool (ex. BTC.BTC, ETH.ETH)
 *               percent:
 *                 type: number
 *                 description: Pourcentage à retirer (1-100)
 *               from:
 *                 type: string
 *                 enum: [sym, asset, baseAsset]
 *                 description: Type de position source (sym=symétrique, asset=asset seulement, baseAsset=RUNE seulement)
 *               to:
 *                 type: string
 *                 enum: [sym, asset, baseAsset]
 *                 description: Type de retrait (sym=symétrique, asset=asset seulement, baseAsset=RUNE seulement)
 *     responses:
 *       200:
 *         description: Liquidité retirée avec succès
 *       400:
 *         description: Paramètres invalides
 *       500:
 *         description: Erreur lors du retrait de liquidité
 */
app.post('/api/liquidity/withdraw', async (req: any, res: any) => {
  try {
    const { asset, percent, from = 'sym', to = 'sym' } = req.body;

    if (!asset || !percent) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants',
        message: 'asset et percent sont requis',
        timestamp: new Date().toISOString()
      });
    }

    if (percent < 1 || percent > 100) {
      return res.status(400).json({
        success: false,
        error: 'Pourcentage invalide',
        message: 'Le pourcentage doit être entre 1 et 100',
        timestamp: new Date().toISOString()
      });
    }

    const swapKit = getSwapKitClient();
    const thorAddress = swapKit.getAddress(Chain.THORChain);

    if (!thorAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet THORChain non connecté',
        message: 'Veuillez connecter un wallet THORChain',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`💸 Retrait de liquidité - Asset: ${asset}, Percent: ${percent}%, From: ${from}, To: ${to}`);

    // Créer l'AssetValue pour identifier le pool
    const { AssetValue } = await import('@swapkit/helpers');
    const assetValue = await AssetValue.from({ asset, value: 0 }); // Montant 0 car on utilise le pourcentage

    const withdrawParams = {
      assetValue: assetValue,
      percent: percent,
      from: from,
      to: to
    };

    console.log('📋 Paramètres de retrait:', withdrawParams);

    // Retirer la liquidité
    const result = await swapKit.thorchain.withdraw(withdrawParams);

    res.json({
      success: true,
      result: result,
      details: {
        asset,
        percent,
        from,
        to,
        thorAddress
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur lors du retrait de liquidité:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du retrait de liquidité',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Démarrer le serveur
app.listen(Number(PORT), "0.0.0.0", async () => {
  console.log(`Serveur API de swap démarré sur le port ${PORT}`);

  // Pré-connecter le wallet si la phrase mnémonique est configurée
  if (process.env.MNEMONIC) {
    try {
      // Vérifier que la phrase mnémonique est définie et valide
      if (!process.env.MNEMONIC) {
        throw new Error("La phrase mnémonique n'est pas configurée");
      }
      console.log(
        `Pré-connexion du wallet avec la phrase mnémonique (${process.env.MNEMONIC.split(" ").length} mots)...`,
      );
      await connectKeystoreWrapper({
        phrase: process.env.MNEMONIC,
        chains: thorchainSupportedChains,
      });
      console.log("✅ Wallet pré-connecté avec succès pour toutes les chaînes");
    } catch (error) {
      console.error("Erreur lors de la pré-connexion du wallet:", error.message);
      console.log("Les connexions seront effectuées à la demande.");
    }
  } else {
    console.warn(
      "⚠️ La phrase mnémonique n'est pas configurée dans le fichier .env (variable MNEMONIC)",
    );
    console.log("Le wallet ne sera pas pré-connecté.");
  }

  const endInitTime = Date.now();
  console.log(`✅ Initialisation terminée en ${(endInitTime - startInitTime) / 1000} secondes`);

  console.log(`Endpoint de swap disponible sur http://0.0.0.0:${PORT}/api/swaps`);
  console.log(`Endpoint de balances disponible sur http://0.0.0.0:${PORT}/api/balances`);
  console.log(
    `Endpoint de balances Ethereum disponible sur http://0.0.0.0:${PORT}/api/eth-balance`,
  );
  console.log(`Endpoint d'adresses disponible sur http://0.0.0.0:${PORT}/api/addresses`);
  console.log(
    `Endpoint de test d'environnement disponible sur http://0.0.0.0:${PORT}/api/test-env`,
  );
  console.log(`Endpoint de santé disponible sur http://0.0.0.0:${PORT}/api/health`);
  console.log(`Documentation Swagger disponible sur http://0.0.0.0:${PORT}/api-docs`);

  // V2 Endpoints (Following SwapKit documentation)
  console.log(`\n📚 V2 Endpoints (SwapKit documentation-compliant):`);
  console.log(`  POST /api/v2/quote - Get swap quotes`);
  console.log(`  POST /api/v2/swaps - Execute swaps`);
  console.log(`  GET  /api/v2/balances/:chain - Get chain balance`);
  console.log(`  GET  /api/v2/wallet/:chain - Get wallet with balance`);
  console.log(`  POST /api/v2/connect - Connect wallets for chains`);
});
