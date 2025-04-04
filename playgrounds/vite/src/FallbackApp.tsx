import React, { useState } from 'react';

/**
 * Application de secours simplifiée qui s'affiche lorsque l'application principale
 * ne peut pas se charger à cause de conflits avec des extensions de navigateur.
 */
const FallbackApp: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <h1 style={{ color: '#2196f3' }}>SwapKit Playground</h1>
      
      <div style={{ 
        padding: '20px', 
        border: '1px solid #e0e0e0', 
        borderRadius: '8px',
        backgroundColor: '#f5f5f5',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#d32f2f', marginTop: 0 }}>Problème de compatibilité détecté</h2>
        
        <p>
          L'application ne peut pas se charger correctement en raison d'un conflit avec une extension de navigateur 
          (probablement un portefeuille crypto comme MetaMask).
        </p>
        
        <h3>Solutions possibles :</h3>
        <ol>
          <li>Désactivez temporairement vos extensions de portefeuille crypto</li>
          <li>Utilisez le mode navigation privée/incognito</li>
          <li>Essayez un autre navigateur</li>
          <li>Utilisez le mode de compatibilité ci-dessous</li>
        </ol>
        
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#2196f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Réessayer
          </button>
          
          <button 
            onClick={() => setShowDetails(!showDetails)} 
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#f5f5f5', 
              color: '#333', 
              border: '1px solid #ccc', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
          >
            {showDetails ? 'Masquer les détails' : 'Afficher les détails techniques'}
          </button>
        </div>
        
        {showDetails && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#fff', 
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}>
            <h3>Détails techniques</h3>
            <p>
              L'erreur <code>SES_UNCAUGHT_EXCEPTION: TypeError: j is undefined</code> est causée par un conflit 
              entre l'application et Secure ECMAScript (SES) utilisé par certaines extensions de navigateur.
            </p>
            <p>
              SES impose des restrictions sur les objets globaux et les prototypes, ce qui peut interférer avec 
              le fonctionnement normal de certaines bibliothèques JavaScript.
            </p>
            <p>
              Pour les développeurs : vous pouvez essayer de modifier le code pour éviter les conflits avec SES, 
              par exemple en utilisant des polyfills ou en évitant de modifier les prototypes natifs.
            </p>
          </div>
        )}
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '40px', color: '#666' }}>
        <p>
          SwapKit Playground - Version de compatibilité
        </p>
      </div>
    </div>
  );
};

export default FallbackApp;
