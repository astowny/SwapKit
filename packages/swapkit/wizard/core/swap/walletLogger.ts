/**
 * Utilitaire pour filtrer les logs des objets wallet
 * 
 * Ce module fournit des fonctions pour nettoyer les objets wallet avant de les afficher
 * afin de réduire la quantité de logs générés.
 */

/**
 * Propriétés à conserver lors de l'affichage d'un objet wallet
 */
const WALLET_PROPERTIES_TO_KEEP = [
  'chain',
  'address',
  'balance',
  'walletType'
];

/**
 * Nettoie un objet wallet pour l'affichage en ne conservant que les propriétés essentielles
 * @param wallet Objet wallet à nettoyer
 * @returns Objet wallet nettoyé
 */
export function cleanWalletForLogging(wallet: any): any {
  if (!wallet || typeof wallet !== 'object') {
    return wallet;
  }

  // Créer un nouvel objet avec seulement les propriétés essentielles
  const cleanedWallet: Record<string, any> = {};
  
  for (const prop of WALLET_PROPERTIES_TO_KEEP) {
    if (prop in wallet) {
      cleanedWallet[prop] = wallet[prop];
    }
  }

  return cleanedWallet;
}

/**
 * Nettoie un objet SwapKit pour l'affichage en ne conservant que les propriétés essentielles des wallets
 * @param swapKitClient Client SwapKit à nettoyer
 * @returns Objet SwapKit nettoyé
 */
export function cleanSwapKitForLogging(swapKitClient: any): any {
  if (!swapKitClient || typeof swapKitClient !== 'object') {
    return swapKitClient;
  }

  // Créer une copie superficielle de l'objet
  const cleanedClient: Record<string, any> = { ...swapKitClient };
  
  // Nettoyer les wallets
  for (const key in cleanedClient) {
    // Si la propriété est un objet et a une propriété 'walletType', c'est probablement un wallet
    if (
      cleanedClient[key] && 
      typeof cleanedClient[key] === 'object' && 
      'walletType' in cleanedClient[key]
    ) {
      cleanedClient[key] = cleanWalletForLogging(cleanedClient[key]);
    }
  }

  return cleanedClient;
}

/**
 * Version personnalisée de console.log qui nettoie les objets wallet avant de les afficher
 * @param message Message à afficher
 * @param args Arguments supplémentaires
 */
export function logWithCleanWallets(message: string, ...args: any[]): void {
  // Nettoyer les arguments qui pourraient être des objets wallet
  const cleanedArgs = args.map(arg => {
    if (arg && typeof arg === 'object') {
      // Si l'objet a une propriété 'walletType', c'est probablement un wallet
      if ('walletType' in arg) {
        return cleanWalletForLogging(arg);
      }
      
      // Si l'objet a des propriétés qui sont des wallets, nettoyer ces propriétés
      const hasWalletProperties = Object.values(arg).some(
        val => val && typeof val === 'object' && 'walletType' in (val as any)
      );
      
      if (hasWalletProperties) {
        return cleanSwapKitForLogging(arg);
      }
    }
    return arg;
  });

  // Afficher le message avec les arguments nettoyés
  console.log(message, ...cleanedArgs);
}
