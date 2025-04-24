import swaggerJsdoc from 'swagger-jsdoc';
import { Chain } from '@swapkit/helpers';

// Définir manuellement les chaînes supportées par THORChain
// Cela évite les problèmes d'importation circulaire
const thorchainSupportedChains = [
  Chain.Bitcoin,
  Chain.Ethereum,
  Chain.BinanceSmartChain,
  Chain.THORChain,
  Chain.Avalanche,
  Chain.Cosmos,
  Chain.Litecoin,
  Chain.BitcoinCash,
  Chain.Dogecoin
];


// Options de configuration pour Swagger
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API SwapKit',
      version: '1.0.0',
      description: 'API pour effectuer des swaps et récupérer des balances avec SwapKit',
      contact: {
        name: 'Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3023',
        description: 'Serveur de développement'
      }
    ],
    tags: [
      {
        name: 'Swaps',
        description: 'Opérations liées aux swaps'
      },
      {
        name: 'Balances',
        description: 'Opérations liées aux balances'
      },
      {
        name: 'Système',
        description: 'Opérations système'
      }
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'error'
            },
            errorCode: {
              type: 'string',
              example: 'BALANCE_RETRIEVAL_ERROR'
            },
            errorMessage: {
              type: 'string',
              example: 'Erreur lors de la récupération des balances'
            },
            errorDetails: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'La phrase mnémonique n\'est pas configurée'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2023-04-07T15:32:45.123Z'
            }
          }
        },
        Balance: {
          type: 'object',
          properties: {
            chain: {
              type: 'string',
              example: 'ETH'
            },
            symbol: {
              type: 'string',
              example: 'ETH'
            },
            ticker: {
              type: 'string',
              example: 'ETH'
            },
            balance: {
              type: 'string',
              example: '0.1'
            },
            balanceFormatted: {
              type: 'string',
              example: '0.1 ETH'
            },
            address: {
              type: 'string',
              nullable: true,
              example: null
            },
            decimals: {
              type: 'integer',
              example: 18
            },
            isGasAsset: {
              type: 'boolean',
              example: true
            },
            isSynthetic: {
              type: 'boolean',
              example: false
            }
          }
        },
        AllBalancesResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'success'
            },
            data: {
              type: 'object',
              properties: {
                allBalances: {
                  type: 'object',
                  additionalProperties: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Balance'
                    }
                  },
                  example: {
                    'ETH': [
                      {
                        chain: 'ETH',
                        symbol: 'ETH',
                        ticker: 'ETH',
                        balance: '0.1',
                        balanceFormatted: '0.1 ETH',
                        address: null,
                        decimals: 18,
                        isGasAsset: true,
                        isSynthetic: false
                      }
                    ],
                    'BTC': []
                  }
                },
                nonEmptyBalances: {
                  type: 'object',
                  additionalProperties: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Balance'
                    }
                  },
                  example: {
                    'ETH': [
                      {
                        chain: 'ETH',
                        symbol: 'ETH',
                        ticker: 'ETH',
                        balance: '0.1',
                        balanceFormatted: '0.1 ETH',
                        address: null,
                        decimals: 18,
                        isGasAsset: true,
                        isSynthetic: false
                      }
                    ]
                  }
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2023-04-07T15:32:45.123Z'
            }
          }
        },
        ChainBalancesResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'success'
            },
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Balance'
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2023-04-07T15:32:45.123Z'
            }
          }
        },
        SwapRequest: {
          type: 'object',
          required: ['sourceAssetString', 'destinationAssetString', 'amount'],
          properties: {
            sourceAssetString: {
              type: 'string',
              example: 'ETH.ETH'
            },
            destinationAssetString: {
              type: 'string',
              example: 'ETH.USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
            },
            amount: {
              type: 'string',
              example: '0.01'
            },
            slippage: {
              type: 'number',
              example: 3
            }
          }
        },
        SwapResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'success'
            },
            data: {
              type: 'object',
              properties: {
                txHash: {
                  type: 'string',
                  example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
                },
                explorerUrl: {
                  type: 'string',
                  example: 'https://etherscan.io/tx/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
                },
                sourceAsset: {
                  type: 'string',
                  example: 'ETH.ETH'
                },
                destinationAsset: {
                  type: 'string',
                  example: 'ETH.USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
                },
                amount: {
                  type: 'string',
                  example: '0.01'
                },
                expectedOutput: {
                  type: 'string',
                  example: '19.5'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2023-04-07T15:32:45.123Z'
            }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok'
            },
            message: {
              type: 'string',
              example: 'Le serveur API de swap est opérationnel'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2023-04-07T15:32:45.123Z'
            }
          }
        }
      },
      parameters: {
        ChainParam: {
          name: 'chain',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            enum: thorchainSupportedChains,
            example: 'ETH'
          },
          description: 'Chaîne pour laquelle récupérer les balances'
        }
      }
    },
    paths: {
      '/api/swaps': {
        post: {
          tags: ['Swaps'],
          summary: 'Effectuer un swap',
          description: 'Effectue un swap entre deux actifs',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SwapRequest'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Swap effectué avec succès',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SwapResponse'
                  }
                }
              }
            },
            '400': {
              description: 'Paramètres invalides',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            },
            '500': {
              description: 'Erreur serveur',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/balances': {
        get: {
          tags: ['Balances'],
          summary: 'Récupérer les balances de toutes les chaînes',
          description: 'Récupère les balances de toutes les chaînes supportées par THORChain',
          responses: {
            '200': {
              description: 'Balances récupérées avec succès',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/AllBalancesResponse'
                  }
                }
              }
            },
            '500': {
              description: 'Erreur serveur',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/balances/{chain}': {
        get: {
          tags: ['Balances'],
          summary: 'Récupérer les balances d\'une chaîne spécifique',
          description: 'Récupère les balances d\'une chaîne spécifique supportée par THORChain',
          parameters: [
            {
              $ref: '#/components/parameters/ChainParam'
            }
          ],
          responses: {
            '200': {
              description: 'Balances récupérées avec succès',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ChainBalancesResponse'
                  }
                }
              }
            },
            '400': {
              description: 'Chaîne non supportée',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            },
            '500': {
              description: 'Erreur serveur',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/eth-balance': {
        get: {
          tags: ['Balances'],
          summary: 'Récupérer les balances Ethereum uniquement',
          description: 'Version simplifiée pour récupérer uniquement les balances Ethereum',
          responses: {
            '200': {
              description: 'Balances Ethereum récupérées avec succès',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ChainBalancesResponse'
                  }
                }
              }
            },
            '500': {
              description: 'Erreur serveur',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/addresses': {
        get: {
          tags: ['Balances'],
          summary: 'Récupérer les adresses utilisées pour vérifier les balances',
          description: 'Récupère les adresses utilisées pour vérifier les balances pour chaque chaîne',
          responses: {
            '200': {
              description: 'Adresses récupérées avec succès',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        example: 'success'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          addresses: {
                            type: 'object',
                            additionalProperties: {
                              type: 'string'
                            },
                            example: {
                              'BTC': 'bc1q....',
                              'ETH': '0x....',
                              'BNB': '0x....',
                              'THOR': 'thor...'
                            }
                          }
                        }
                      },
                      timestamp: {
                        type: 'string',
                        format: 'date-time',
                        example: '2023-04-07T15:32:45.123Z'
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Erreur de configuration',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            },
            '500': {
              description: 'Erreur lors de la récupération des adresses',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/test-env': {
        get: {
          tags: ['Système'],
          summary: 'Tester les variables d\'environnement',
          description: 'Vérifie les variables d\'environnement configurées',
          responses: {
            '200': {
              description: 'Variables d\'environnement récupérées avec succès',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        example: 'success'
                      },
                      message: {
                        type: 'string',
                        example: 'Test des variables d\'environnement'
                      },
                      data: {
                        type: 'object',
                        properties: {
                          environment: {
                            type: 'object',
                            properties: {
                              PORT: {
                                type: 'string',
                                example: '3023'
                              },
                              NODE_ENV: {
                                type: 'string',
                                example: 'development'
                              },
                              MNEMONIC: {
                                type: 'string',
                                example: 'Défini (12 mots)'
                              }
                            }
                          },
                          server: {
                            type: 'object',
                            properties: {
                              timestamp: {
                                type: 'string',
                                format: 'date-time',
                                example: '2023-04-07T15:32:45.123Z'
                              },
                              uptime: {
                                type: 'string',
                                example: '10.5 secondes'
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '500': {
              description: 'Erreur serveur',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/api/health': {
        get: {
          tags: ['Système'],
          summary: 'Vérifier l\'état du serveur',
          description: 'Vérifie si le serveur API est opérationnel',
          responses: {
            '200': {
              description: 'Serveur opérationnel',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/HealthResponse'
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./server.ts'] // Fichiers à scanner pour les commentaires JSDoc
};

// Générer la spécification Swagger
const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
