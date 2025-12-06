import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Charger les variables d'environnement depuis .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3023;

// Middleware pour parser le JSON et activer CORS
app.use(express.json());
app.use(cors());

// Endpoint de test simple
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Le serveur API de swap est opérationnel',
    timestamp: new Date().toISOString()
  });
});

// Endpoint pour tester les variables d'environnement
app.get('/api/test-env', (req, res) => {
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

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur API de swap démarré sur le port ${PORT}`);
  console.log(`Endpoint de santé disponible sur http://localhost:${PORT}/api/health`);
  console.log(`Endpoint de test d'environnement disponible sur http://localhost:${PORT}/api/test-env`);
});
