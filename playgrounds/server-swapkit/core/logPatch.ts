/**
 * Patch global pour console.log qui nettoie automatiquement les objets wallet
 * 
 * Ce module remplace la fonction console.log standard par une version
 * qui nettoie automatiquement les objets wallet avant de les afficher.
 */

import { cleanWalletForLogging, cleanSwapKitForLogging } from './swap/walletLogger';

// Sauvegarde de la fonction console.log originale
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

/**
 * Détermine si un objet est un wallet en vérifiant ses propriétés
 * @param obj Objet à vérifier
 * @returns true si l'objet semble être un wallet
 */
function isWalletObject(obj: any): boolean {
  return obj && 
         typeof obj === 'object' && 
         !Array.isArray(obj) &&
         'walletType' in obj && 
         'chain' in obj;
}

/**
 * Détermine si un objet est un client SwapKit en vérifiant ses propriétés
 * @param obj Objet à vérifier
 * @returns true si l'objet semble être un client SwapKit
 */
function isSwapKitClient(obj: any): boolean {
  return obj && 
         typeof obj === 'object' && 
         !Array.isArray(obj) &&
         (('thorchain' in obj && 'getAddress' in obj) || 
          ('api' in obj && 'getBalance' in obj));
}

/**
 * Nettoie récursivement un objet pour l'affichage
 * @param obj Objet à nettoyer
 * @returns Objet nettoyé
 */
function cleanObjectForLogging(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  // Si c'est un tableau, nettoyer chaque élément
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObjectForLogging(item));
  }
  
  // Si c'est un wallet, utiliser la fonction de nettoyage spécifique
  if (isWalletObject(obj)) {
    return cleanWalletForLogging(obj);
  }
  
  // Si c'est un client SwapKit, utiliser la fonction de nettoyage spécifique
  if (isSwapKitClient(obj)) {
    return cleanSwapKitForLogging(obj);
  }
  
  // Pour les autres objets, vérifier récursivement chaque propriété
  const cleanedObj: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      // Nettoyer les fonctions
      if (typeof value === 'function') {
        cleanedObj[key] = `[${value.constructor.name}]`;
      } 
      // Nettoyer récursivement les objets
      else if (typeof value === 'object' && value !== null) {
        cleanedObj[key] = cleanObjectForLogging(value);
      } 
      // Garder les valeurs primitives telles quelles
      else {
        cleanedObj[key] = value;
      }
    }
  }
  
  return cleanedObj;
}

/**
 * Nettoie les arguments pour l'affichage
 * @param args Arguments à nettoyer
 * @returns Arguments nettoyés
 */
function cleanArgsForLogging(...args: any[]): any[] {
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return cleanObjectForLogging(arg);
    }
    return arg;
  });
}

/**
 * Applique le patch à console.log
 */
export function applyLogPatch(): void {
  // Remplacer console.log
  console.log = function(...args: any[]) {
    originalConsoleLog.apply(console, cleanArgsForLogging(...args));
  };
  
  // Remplacer console.error
  console.error = function(...args: any[]) {
    originalConsoleError.apply(console, cleanArgsForLogging(...args));
  };
  
  // Remplacer console.warn
  console.warn = function(...args: any[]) {
    originalConsoleWarn.apply(console, cleanArgsForLogging(...args));
  };
  
  // Remplacer console.info
  console.info = function(...args: any[]) {
    originalConsoleInfo.apply(console, cleanArgsForLogging(...args));
  };
  
  // Remplacer console.debug
  console.debug = function(...args: any[]) {
    originalConsoleDebug.apply(console, cleanArgsForLogging(...args));
  };
  
  console.log("✅ Patch de console.log appliqué pour nettoyer automatiquement les objets wallet");
}

/**
 * Restaure les fonctions console originales
 */
export function removeLogPatch(): void {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
  console.debug = originalConsoleDebug;
  
  console.log("✅ Fonctions console originales restaurées");
}
