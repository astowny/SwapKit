/**
 * Fonction pour vérifier l'impact de prix et annuler le swap si nécessaire
 * @param route La route de swap à vérifier
 * @returns true si le swap doit être annulé, false sinon
 */
export function checkPriceImpact(route: any): boolean {
  // Vérifier si la route contient des avertissements
  if (route.warnings && route.warnings.length > 0) {
    // Rechercher les avertissements de type "highPriceImpact"
    const highImpactWarning = route.warnings.find((warning: any) => warning.code === "highPriceImpact");

    if (highImpactWarning) {
      console.log(`\n⚠️ Avertissement détecté: ${highImpactWarning.code}`);
      console.log(`Impact affiché: ${highImpactWarning.display}`);
      console.log(`Détail: ${highImpactWarning.tooltip}`);

      // Vérifier si l'impact de prix est disponible dans les métadonnées
      if (route.meta && typeof route.meta.priceImpact === 'number') {
        const priceImpact = route.meta.priceImpact;
        console.log(`Impact de prix: ${priceImpact}%`);

        // Annuler le swap si l'impact de prix est inférieur à -50%
        if (priceImpact <= -50) {
          console.error(`\n❌ Swap annulé: L'impact de prix est trop élevé (${priceImpact}%).`);
          console.error("Pour des raisons de sécurité, les swaps avec un impact de prix inférieur à -50% sont automatiquement annulés.");
          console.error("Vous pouvez essayer avec un montant plus petit ou un autre fournisseur.");
          return true;
        } else if (priceImpact <= -10) {
          // Avertissement pour les impacts entre -10% et -50%
          console.warn(`\n⚠️ Attention: L'impact de prix est élevé (${priceImpact}%).`);
          console.warn("Cela signifie que vous pourriez recevoir significativement moins que la valeur marchande.");
        }
      } else if (highImpactWarning.display) {
        // Si l'impact numérique n'est pas disponible, essayer de parser l'affichage
        const displayImpact = highImpactWarning.display.replace('%', '');
        const parsedImpact = parseFloat(displayImpact);

        if (!isNaN(parsedImpact) && parsedImpact <= -50) {
          console.error(`\n❌ Swap annulé: L'impact de prix est trop élevé (${displayImpact}%).`);
          console.error("Pour des raisons de sécurité, les swaps avec un impact de prix inférieur à -50% sont automatiquement annulés.");
          console.error("Vous pouvez essayer avec un montant plus petit ou un autre fournisseur.");
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Fonction utilitaire pour formater un montant en unités lisibles par l'homme
 * @param amount Le montant à formater (en wei, gwei, etc.)
 * @param decimals Le nombre de décimales à utiliser
 * @param symbol Le symbole de l'unité (ETH, BTC, etc.)
 * @returns Le montant formaté
 */
export function formatAmount(amount: string | number | bigint, decimals: number = 18, symbol: string = ''): string {
  try {
    // Convertir en BigInt si ce n'est pas déjà le cas
    const amountBigInt = typeof amount === 'bigint'
      ? amount
      : typeof amount === 'string' && amount.startsWith('0x')
        ? BigInt(amount)
        : BigInt(String(amount));

    // Convertir en nombre décimal
    const divisor = BigInt(10) ** BigInt(decimals);
    const integerPart = amountBigInt / divisor;
    const fractionalPart = amountBigInt % divisor;

    // Formater la partie fractionnaire avec le bon nombre de zéros de remplissage
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    // Supprimer les zéros de fin
    fractionalStr = fractionalStr.replace(/0+$/, '');

    // Construire la chaîne finale
    const result = fractionalStr.length > 0
      ? `${integerPart}.${fractionalStr}`
      : `${integerPart}`;

    return symbol ? `${result} ${symbol}` : result;
  } catch (e) {
    return `${amount} ${symbol}`.trim(); // Fallback en cas d'erreur
  }
}

/**
 * Fonction pour extraire et afficher les informations sur les tokens impliqués dans le swap
 * @param route La route de swap à analyser
 */
export function logTokenInfo(route: any): void {
  console.log("\n💰 Informations sur les tokens:");

  // Afficher les informations sur les assets
  if (route.meta && route.meta.assets && Array.isArray(route.meta.assets)) {
    route.meta.assets.forEach((asset: any, index: number) => {
      console.log(`\nToken ${index + 1}: ${asset.asset}`);
      if (asset.price) console.log(`- Prix: $${asset.price}`);
      if (asset.image) console.log(`- Image: ${asset.image}`);
    });
  }

  // Afficher les informations sur les assets source et destination
  console.log("\nDétails du swap:");
  console.log(`- Asset source: ${route.sellAsset}`);
  console.log(`- Montant source: ${route.sellAmount}`);
  console.log(`- Asset destination: ${route.buyAsset}`);
  console.log(`- Montant destination estimé: ${route.expectedBuyAmount}`);

  // Calculer le taux de change
  if (route.sellAmount && route.expectedBuyAmount) {
    const rate = parseFloat(route.expectedBuyAmount) / parseFloat(route.sellAmount);
    console.log(`- Taux de change: 1 ${route.sellAsset.split('-')[0]} = ${rate.toFixed(6)} ${route.buyAsset.split('-')[0]}`);
  }

  // Afficher l'impact de prix s'il est disponible
  if (route.meta && typeof route.meta.priceImpact === 'number') {
    const priceImpact = route.meta.priceImpact;
    const impactColor = priceImpact <= -10 ? "\x1b[31m" : priceImpact < 0 ? "\x1b[33m" : "\x1b[32m";
    const resetColor = "\x1b[0m";
    console.log(`- Impact de prix: ${impactColor}${priceImpact}%${resetColor}`);
  }
}

/**
 * Fonction pour extraire et afficher les informations sur les frais de gas
 * @param route La route de swap à analyser
 */
export function logGasFees(route: any): void {
  console.log("\n💸 Informations sur les frais de réseau (gas):");

  // Vérifier si les informations sur les frais sont disponibles
  if (route.fees) {
    console.log("\nStructure des frais:", JSON.stringify(route.fees, null, 2));

    // Afficher les frais détaillés
    route.fees.forEach((fee: any, index: number) => {
      console.log(`\nFrais ${index + 1}:`);
      console.log(`- Type: ${fee.type || 'N/A'}`);
      console.log(`- Montant: ${fee.amount || 'N/A'} ${fee.asset || 'N/A'}`);
      console.log(`- Chaîne: ${fee.chain || 'N/A'}`);
      console.log(`- Protocole: ${fee.protocol || 'N/A'}`);
    });
  }

  // Afficher les informations de transaction
  if (route.tx) {
    console.log("\nInformations de transaction:");
    console.log(`- Gas: ${parseInt(route.tx.gas, 16) || 'N/A'}`);
    console.log(`- Prix du gas: ${parseInt(route.tx.gasPrice, 16) / 1e9 || 'N/A'} Gwei`);
    console.log(`- To: ${route.tx.to}`);
    console.log(`- From: ${route.tx.from}`);
    console.log(`- Value: ${route.tx.value}`);

    // Calculer le coût total du gas en ETH
    if (route.tx.gas && route.tx.gasPrice) {
      const gasLimit = parseInt(route.tx.gas, 16);
      const gasPrice = parseInt(route.tx.gasPrice, 16);
      const gasCostWei = BigInt(gasLimit) * BigInt(gasPrice);

      console.log(`- Limite de gas: ${gasLimit.toLocaleString()} unités`);
      console.log(`- Prix du gas: ${formatAmount(gasPrice, 9, 'Gwei')}`);
      console.log(`- Coût total estimé: ${formatAmount(gasCostWei, 18, 'ETH')}`);

      // Estimer le coût en USD (approximatif, basé sur un prix ETH de 1800 USD)
      const ethPrice = 1800; // Prix approximatif de l'ETH en USD
      const gasCostEth = Number(gasCostWei) / 1e18;
      const gasCostUsd = gasCostEth * ethPrice;
      console.log(`- Coût total estimé (USD): $${gasCostUsd.toFixed(2)}`);
    }

    // Décoder et afficher les données de transaction
    if (route.tx.data) {
      console.log("\n🔍 Décodage des données de transaction:");

      // Afficher les données brutes
      console.log(`\nDonnées brutes: ${route.tx.data}`);

      // Extraire le sélecteur de fonction (premiers 4 octets / 8 caractères après 0x)
      const selector = route.tx.data.substring(0, 10);
      console.log(`\nSélecteur de fonction: ${selector}`);

      // Essayer d'identifier la fonction en fonction du sélecteur
      const knownSelectors: Record<string, string> = {
        '0x18cbafe5': 'swapExactTokensForTokens (Uniswap V2)',
        '0x38ed1739': 'swapExactTokensForTokens (Uniswap V2 - variante)',
        '0x8a0d6b5d': 'swapTokensForExactTokens (Uniswap V2)',
        '0x4a25d94a': 'swapTokensForExactETH (Uniswap V2)',
        '0x7ff36ab5': 'swapExactETHForTokens (Uniswap V2)',
        '0xfb3bdb41': 'swapETHForExactTokens (Uniswap V2)',
        '0x5c11d795': 'swapExactTokensForTokensSupportingFeeOnTransferTokens (Uniswap V2)',
        '0xb6f9de95': 'swapExactETHForTokensSupportingFeeOnTransferTokens (Uniswap V2)',
        '0x791ac947': 'swapExactTokensForETHSupportingFeeOnTransferTokens (Uniswap V2)',
        '0x04e45aaf': 'exactInputSingle (Uniswap V3)',
        '0xac9650d8': 'multicall (Uniswap V3)',
        '0x83800a8e': 'swap (1inch)',
        '0xe449022e': 'uniswapV3SwapTo (1inch)',
        '0x12aa3caf': 'swap (0x Protocol)',
      };

      const functionName = knownSelectors[selector] || 'Fonction inconnue';
      console.log(`Fonction identifiée: ${functionName}`);

      // Afficher les données par blocs de 32 octets (64 caractères) pour faciliter la lecture
      // Ignorer le sélecteur de fonction (10 premiers caractères incluant 0x)
      const dataWithoutSelector = route.tx.data.substring(10);
      console.log("\nDonnées découpées par paramètres (blocs de 32 octets):");

      for (let i = 0; i < dataWithoutSelector.length; i += 64) {
        const paramIndex = Math.floor(i / 64);
        const paramData = dataWithoutSelector.substring(i, i + 64);
        console.log(`Paramètre ${paramIndex + 1}: ${paramData}`);

        // Essayer d'interpréter les données
        try {
          // Si c'est un nombre
          const numValue = BigInt('0x' + paramData);
          if (numValue < BigInt('0x1000000000000000000000000')) { // Si c'est un nombre raisonnable
            console.log(`  Interprété comme nombre: ${numValue.toString()}`);

            // Essayer d'interpréter comme montant avec différentes décimales
            console.log(`  Interprété comme montant (18 décimales): ${formatAmount(numValue, 18, 'ETH')}`);
            console.log(`  Interprété comme montant (6 décimales): ${formatAmount(numValue, 6, 'USDC')}`);
          }

          // Si c'est une adresse (les adresses sont souvent précédées de zéros)
          if (paramData.startsWith('000000000000000000000000')) {
            const address = '0x' + paramData.substring(24);
            console.log(`  Interprété comme adresse: ${address}`);
          }
        } catch (e) {
          // Ignorer les erreurs d'interprétation
        }
      }
    }
  }

  // Afficher les informations de temps estimé
  if (route.estimatedTime) {
    console.log("\nTemps estimé:");
    console.log(`- Entrée: ${route.estimatedTime.inbound || 0} secondes`);
    console.log(`- Swap: ${route.estimatedTime.swap || 0} secondes`);
    console.log(`- Sortie: ${route.estimatedTime.outbound || 0} secondes`);
    console.log(`- Total: ${route.estimatedTime.total || 0} secondes`);
  }
}

/**
 * Fonction principale pour analyser et afficher toutes les informations d'une route de swap
 * @param route La route de swap à analyser
 * @returns true si le swap doit être annulé, false sinon
 */
export function analyzeSwapRoute(route: any): boolean {
  console.log("\n🔎 ANALYSE DÉTAILLÉE DE LA ROUTE DE SWAP");
  console.log("===========================================\n");

  // Afficher les informations sur les tokens
  logTokenInfo(route);

  // Afficher les informations sur les frais de gas
  logGasFees(route);

  // Vérifier l'impact de prix
  const shouldCancel = checkPriceImpact(route);

  console.log("\n===========================================\n");

  if (shouldCancel) {
    console.log("\n❌ CONCLUSION: Le swap a été annulé en raison d'un impact de prix trop élevé.");
  } else {
    console.log("\n✅ CONCLUSION: Le swap peut être exécuté en toute sécurité.");
  }

  return shouldCancel;
}
