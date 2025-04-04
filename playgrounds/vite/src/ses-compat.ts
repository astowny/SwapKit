/**
 * Ce fichier contient des correctifs pour les problèmes liés à Secure ECMAScript (SES)
 * utilisé par des extensions comme MetaMask.
 */

// Fonction pour vérifier si SES est actif
const isSESActive = () => {
  try {
    // SES modifie généralement Object.prototype ou Function.prototype
    return Object.getOwnPropertyDescriptor(Function.prototype, 'constructor')?.configurable === false;
  } catch (e) {
    return false;
  }
};

// Fonction pour appliquer les correctifs SES
const applySESFixes = () => {
  try {
    console.log('Tentative d\'application des correctifs SES...');
    
    // Créer un proxy pour intercepter les accès à des propriétés indéfinies
    const createSafeProxy = (target: any, name: string) => {
      return new Proxy(target, {
        get(target, prop) {
          // Si la propriété n'existe pas, retourner un objet vide au lieu de undefined
          if (prop in target) {
            return target[prop];
          }
          console.warn(`Accès à une propriété indéfinie ${name}.${String(prop)}, retour d'un objet vide`);
          return {};
        }
      });
    };

    // Appliquer le proxy aux objets globaux couramment utilisés
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.j = window.j || {};
      
      // Protéger les objets globaux
      const protectGlobal = (name: string, obj: any) => {
        try {
          // @ts-ignore
          window[name] = createSafeProxy(obj || {}, name);
        } catch (e) {
          console.warn(`Impossible de protéger l'objet global ${name}:`, e);
        }
      };
      
      // Protéger les objets globaux couramment utilisés par les extensions SES
      ['lockdown', 'harden', 'Compartment'].forEach(name => protectGlobal(name, {}));
      
      console.log('Correctifs SES appliqués avec succès');
    }
  } catch (error) {
    console.error('Erreur lors de l\'application des correctifs SES:', error);
  }
};

// Vérifier si SES est actif et appliquer les correctifs si nécessaire
if (isSESActive()) {
  console.log('SES détecté, application des correctifs...');
  applySESFixes();
} else {
  console.log('SES non détecté, aucun correctif nécessaire');
}

export default {};
