// Polyfills pour résoudre les problèmes avec les extensions de sécurité comme MetaMask

// Importer les correctifs SES
import './ses-compat';

// Polyfill pour process
if (typeof window !== 'undefined') {
  // @ts-ignore - Ignorer les erreurs TypeScript pour ces modifications
  window.process = window.process || {};
  // @ts-ignore
  window.process.env = window.process.env || {};
  // @ts-ignore
  window.process.version = window.process.version || 'v16.0.0';
  // @ts-ignore
  window.process.browser = true;

  // Définir également sur globalThis
  // @ts-ignore
  globalThis.process = globalThis.process || {};
  // @ts-ignore
  globalThis.process.env = globalThis.process.env || {};
  // @ts-ignore
  globalThis.process.version = globalThis.process.version || 'v16.0.0';
  // @ts-ignore
  globalThis.process.browser = true;

  console.log('Polyfills process chargés:', {
    version: window.process.version,
    browser: window.process.browser
  });
}

// Polyfill pour Buffer
try {
  if (typeof window !== 'undefined' && !window.Buffer) {
    import('buffer').then(Buffer => {
      // @ts-ignore
      window.Buffer = Buffer.Buffer;
      // @ts-ignore
      globalThis.Buffer = Buffer.Buffer;
      console.log('Buffer importé avec succès');
    }).catch(error => {
      console.error('Erreur lors de l\'importation de Buffer:', error);
    });
  }
} catch (error) {
  console.error('Erreur lors de l\'initialisation de Buffer:', error);
}

// Polyfill pour global
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.global = window;
}

export default {};
