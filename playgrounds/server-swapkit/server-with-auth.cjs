// const express = require('express');
// const swaggerUi = require('swagger-ui-express');
// const cors = require('cors');
// require('dotenv').config();

// const app = express();
// const PORT = 3025;

// // Middleware
// app.use(express.json());
// app.use(cors());

// // Configuration Swagger avec tous les endpoints
// const swaggerDocument = {
//   openapi: '3.0.0',
//   info: {
//     title: 'SwapKit API Server',
//     version: '1.0.0',
//     description: 'API pour les opérations de swap et de gestion de portefeuille avec SwapKit'
//   },
//   servers: [
//     {
//       url: `http://localhost:${PORT}`,
//       description: 'Serveur de développement'
//     }
//   ],
//   components: {
//     securitySchemes: {
//       ApiKeyAuth: {
//         type: 'apiKey',
//         in: 'header',
//         name: 'x-api-key',
//         description: 'Clé API requise pour accéder aux endpoints protégés'
//       },
//       BearerAuth: {
//         type: 'http',
//         scheme: 'bearer',
//         description: 'Token Bearer avec la clé API'
//       }
//     },
//     schemas: {
//       Error: {
//         type: 'object',
//         properties: {
//           status: { type: 'string' },
//           errorCode: { type: 'string' },
//           error: { type: 'string' },
//           timestamp: { type: 'string', format: 'date-time' }
//         }
//       },
//       SwapRequest: {
//         type: 'object',
//         required: ['sourceAssetString', 'destinationAssetString', 'amount'],
//         properties: {
//           sourceAssetString: { type: 'string', description: 'Asset source (ex: ETH.ETH)', example: 'ETH.ETH' },
//           destinationAssetString: { type: 'string', description: 'Asset destination (ex: BTC.BTC)', example: 'BTC.BTC' },
//           amount: { type: 'string', description: 'Montant à swapper', example: '1' },
//           slippage: { type: 'number', description: 'Slippage toléré', example: 3 }
//         }
//       }
//     }
//   },
//   security: [
//     { ApiKeyAuth: [] },
//     { BearerAuth: [] }
//   ],
//   paths: {
//     '/': {
//       get: {
//         summary: 'Page d\'accueil de l\'API',
//         description: 'Informations sur l\'API et l\'authentification',
//         tags: ['General'],
//         responses: {
//           200: { description: 'Informations sur l\'API' }
//         }
//       }
//     },
//     '/api/health': {
//       get: {
//         summary: 'Vérifier l\'état du serveur',
//         description: 'Endpoint public pour vérifier que le serveur fonctionne',
//         tags: ['General'],
//         responses: {
//           200: { description: 'Serveur opérationnel' }
//         }
//       }
//     },
//     '/api/auth-test': {
//       get: {
//         summary: 'Test d\'authentification',
//         description: 'Endpoint protégé pour tester l\'authentification par clé API',
//         tags: ['General'],
//         security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
//         responses: {
//           200: { description: 'Authentification réussie' },
//           401: { description: 'Clé API manquante' },
//           403: { description: 'Clé API invalide' }
//         }
//       }
//     },
//     '/api/swaps': {
//       post: {
//         summary: 'Effectuer un swap entre deux assets',
//         description: 'Exécute un swap en utilisant SwapKit avec les paramètres fournis',
//         tags: ['Swaps'],
//         security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
//         requestBody: {
//           required: true,
//           content: {
//             'application/json': {
//               schema: { $ref: '#/components/schemas/SwapRequest' }
//             }
//           }
//         },
//         responses: {
//           200: { description: 'Swap exécuté avec succès' },
//           400: { description: 'Paramètres invalides' },
//           500: { description: 'Erreur serveur' }
//         }
//       }
//     },
//     '/api/balances': {
//       get: {
//         summary: 'Récupérer les balances de toutes les chaînes',
//         description: 'Obtient les balances de tous les tokens sur toutes les chaînes supportées',
//         tags: ['Balances'],
//         security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
//         responses: {
//           200: { description: 'Balances récupérées avec succès' },
//           500: { description: 'Erreur lors de la récupération' }
//         }
//       }
//     },
//     '/api/balances/{chain}': {
//       get: {
//         summary: 'Récupérer les balances d\'une chaîne spécifique',
//         description: 'Obtient les balances pour une chaîne blockchain spécifique',
//         tags: ['Balances'],
//         security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
//         parameters: [
//           {
//             name: 'chain',
//             in: 'path',
//             required: true,
//             schema: { type: 'string' },
//             description: 'Nom de la chaîne (ex: ETH, BTC, BSC)'
//           }
//         ],
//         responses: {
//           200: { description: 'Balances récupérées avec succès' },
//           400: { description: 'Chaîne non supportée' },
//           500: { description: 'Erreur lors de la récupération' }
//         }
//       }
//     },
//     '/api/addresses': {
//       get: {
//         summary: 'Récupérer les adresses du wallet',
//         description: 'Obtient les adresses pour toutes les chaînes supportées',
//         tags: ['Wallet'],
//         security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
//         responses: {
//           200: { description: 'Adresses récupérées avec succès' },
//           500: { description: 'Erreur lors de la récupération' }
//         }
//       }
//     },
//     '/api/test-env': {
//       get: {
//         summary: 'Tester les variables d\'environnement',
//         description: 'Vérifie la configuration des variables d\'environnement',
//         tags: ['Debug'],
//         security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
//         responses: {
//           200: { description: 'Variables d\'environnement vérifiées' },
//           500: { description: 'Erreur lors de la vérification' }
//         }
//       }
//     }
//   }
// };

// // Middleware d'authentification
// const authenticateApiKey = (req, res, next) => {
//   // Endpoints publics
//   const publicEndpoints = ['/', '/api/health', '/api-docs'];
//   const isPublicEndpoint = publicEndpoints.some(endpoint => 
//     req.path === endpoint || req.path.startsWith('/api-docs')
//   );
  
//   if (isPublicEndpoint) {
//     return next();
//   }

//   const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
//   const expectedApiKey = process.env.API_SECRET_KEY;

//   if (!expectedApiKey) {
//     return res.status(500).json({
//       status: 'error',
//       errorCode: 'SERVER_CONFIGURATION_ERROR',
//       error: 'Clé API secrète non configurée sur le serveur',
//       timestamp: new Date().toISOString()
//     });
//   }

//   if (!apiKey) {
//     return res.status(401).json({
//       status: 'error',
//       errorCode: 'MISSING_API_KEY',
//       error: 'Clé API manquante. Veuillez fournir la clé API dans le header "x-api-key" ou "Authorization: Bearer <key>"',
//       timestamp: new Date().toISOString()
//     });
//   }

//   if (apiKey !== expectedApiKey) {
//     console.warn(`⚠️ Tentative d'accès avec une clé API invalide: ${apiKey.substring(0, 10)}...`);
//     return res.status(403).json({
//       status: 'error',
//       errorCode: 'INVALID_API_KEY',
//       error: 'Clé API invalide',
//       timestamp: new Date().toISOString()
//     });
//   }

//   next();
// };

// // Configuration Swagger UI
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
//   explorer: true,
//   customCss: '.swagger-ui .topbar { display: none }',
//   customSiteTitle: 'SwapKit API Documentation',
//   swaggerOptions: {
//     persistAuthorization: true,
//     displayRequestDuration: true,
//     docExpansion: 'list',
//     filter: true,
//     showExtensions: true,
//     showCommonExtensions: true,
//     tryItOutEnabled: true
//   }
// }));

// // Appliquer l'authentification
// app.use(authenticateApiKey);

// // Routes
// app.get('/', (req, res) => {
//   res.json({
//     name: 'SwapKit API Server',
//     version: '1.0.0',
//     description: 'API pour les opérations de swap et de gestion de portefeuille',
//     documentation: '/api-docs',
//     authentication: {
//       required: true,
//       method: 'API Key',
//       header: 'x-api-key ou Authorization: Bearer <key>',
//       note: 'Tous les endpoints (sauf /, /health, /api-docs) nécessitent une clé API valide'
//     },
//     endpoints: {
//       swaps: '/api/swaps',
//       balances: '/api/balances',
//       health: '/api/health',
//     },
//     timestamp: new Date().toISOString()
//   });
// });

// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'ok',
//     message: 'Le serveur API de swap est opérationnel',
//     timestamp: new Date().toISOString()
//   });
// });

// app.get('/api/auth-test', (req, res) => {
//   res.json({
//     status: 'success',
//     message: 'Authentification réussie ! Vous avez accès aux endpoints protégés.',
//     authenticated: true,
//     timestamp: new Date().toISOString()
//   });
// });

// // Endpoints simulés pour la démonstration
// app.post('/api/swaps', (req, res) => {
//   const { sourceAssetString, destinationAssetString, amount, slippage = 3 } = req.body;
  
//   if (!sourceAssetString || !destinationAssetString || !amount) {
//     return res.status(400).json({
//       status: 'error',
//       error: 'Paramètres manquants. sourceAssetString, destinationAssetString et amount sont obligatoires.',
//       timestamp: new Date().toISOString()
//     });
//   }

//   res.json({
//     status: 'success',
//     message: 'Swap simulé (serveur de démonstration)',
//     data: {
//       sourceAssetString,
//       destinationAssetString,
//       amount,
//       slippage,
//       note: 'Ceci est une simulation - le vrai serveur SwapKit exécuterait le swap'
//     },
//     timestamp: new Date().toISOString()
//   });
// });

// app.get('/api/balances', (req, res) => {
//   res.json({
//     status: 'success',
//     message: 'Balances simulées (serveur de démonstration)',
//     data: {
//       balances: [
//         { chain: 'ETH', symbol: 'ETH', balance: '1.5', priceUSD: 2000 },
//         { chain: 'BTC', symbol: 'BTC', balance: '0.1', priceUSD: 45000 }
//       ],
//       totalValueUSD: 7500,
//       note: 'Ceci est une simulation - le vrai serveur SwapKit récupérerait les vraies balances'
//     },
//     timestamp: new Date().toISOString()
//   });
// });

// app.get('/api/balances/:chain', (req, res) => {
//   const { chain } = req.params;
//   res.json({
//     status: 'success',
//     message: `Balances simulées pour ${chain} (serveur de démonstration)`,
//     data: {
//       chain,
//       balances: [
//         { symbol: chain, balance: '1.0', priceUSD: 1000 }
//       ],
//       note: 'Ceci est une simulation - le vrai serveur SwapKit récupérerait les vraies balances'
//     },
//     timestamp: new Date().toISOString()
//   });
// });

// app.get('/api/addresses', (req, res) => {
//   res.json({
//     status: 'success',
//     message: 'Adresses simulées (serveur de démonstration)',
//     data: {
//       addresses: {
//         ETH: '0x1234567890123456789012345678901234567890',
//         BTC: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
//         BSC: '0x1234567890123456789012345678901234567890'
//       },
//       note: 'Ceci est une simulation - le vrai serveur SwapKit récupérerait les vraies adresses'
//     },
//     timestamp: new Date().toISOString()
//   });
// });

// app.get('/api/test-env', (req, res) => {
//   res.json({
//     status: 'success',
//     message: 'Test des variables d\'environnement',
//     data: {
//       environment: {
//         PORT: PORT,
//         NODE_ENV: process.env.NODE_ENV || 'development',
//         API_SECRET_KEY: process.env.API_SECRET_KEY ? 'Configurée' : 'Non configurée',
//         MNEMONIC: process.env.MNEMONIC ? 'Configurée' : 'Non configurée'
//       },
//       server: {
//         timestamp: new Date().toISOString(),
//         uptime: `${process.uptime().toFixed(1)} secondes`
//       }
//     }
//   });
// });

// // Démarrer le serveur
// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`🚀 Serveur SwapKit avec authentification démarré sur le port ${PORT}`);
//   console.log(`📖 Documentation Swagger: http://localhost:${PORT}/api-docs`);
//   console.log(`🔑 Clé API: ${process.env.API_SECRET_KEY || 'Non configurée'}`);
//   console.log('');
//   console.log('🎯 Tous les endpoints SwapKit sont maintenant disponibles avec authentification !');
//   console.log('');
//   console.log('🧪 Pour utiliser Swagger UI avec authentification:');
//   console.log('1. Ouvrez http://localhost:' + PORT + '/api-docs');
//   console.log('2. Cliquez sur le bouton "Authorize" en haut à droite');
//   console.log('3. Entrez votre clé API dans ApiKeyAuth ou BearerAuth');
//   console.log('4. Cliquez sur "Authorize" puis "Close"');
//   console.log('5. Testez tous les endpoints directement dans l\'interface');
// });
