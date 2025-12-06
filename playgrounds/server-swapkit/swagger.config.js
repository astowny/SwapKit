import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SwapKit API Server',
      version: '1.0.0',
      description: 'API pour les opérations de swap et de gestion de portefeuille avec SwapKit',
      contact: {
        name: 'SwapKit Team',
        email: 'support@swapkit.dev'
      }
    },
    servers: [
      {
        url: 'http://localhost:3023',
        description: 'Serveur de développement'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Clé API requise pour accéder aux endpoints protégés'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Token Bearer avec la clé API'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Message d\'erreur'
            },
            details: {
              type: 'object',
              description: 'Détails supplémentaires sur l\'erreur'
            }
          }
        },
        SwapRequest: {
          type: 'object',
          required: ['sourceAssetString', 'destinationAssetString', 'amount'],
          properties: {
            sourceAssetString: {
              type: 'string',
              description: 'Asset source (ex: ETH.ETH)',
              example: 'ETH.ETH'
            },
            destinationAssetString: {
              type: 'string', 
              description: 'Asset destination (ex: BTC.BTC)',
              example: 'BTC.BTC'
            },
            amount: {
              type: 'string',
              description: 'Montant à swapper',
              example: '1'
            },
            destinationAddress: {
              type: 'string',
              description: 'Adresse de destination (optionnel)'
            },
            sourceAddress: {
              type: 'string',
              description: 'Adresse source (optionnel)'
            }
          }
        },
        Balance: {
          type: 'object',
          properties: {
            chain: {
              type: 'string',
              description: 'Chaîne blockchain'
            },
            symbol: {
              type: 'string',
              description: 'Symbole du token'
            },
            balance: {
              type: 'string',
              description: 'Solde du token'
            },
            priceUSD: {
              type: 'number',
              description: 'Prix en USD'
            }
          }
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      },
      {
        BearerAuth: []
      }
    ]
  },
  apis: ['./server.ts', './core/**/*.ts'], // Chemins vers vos fichiers contenant les annotations JSDoc
};

export const specs = swaggerJsdoc(options);
