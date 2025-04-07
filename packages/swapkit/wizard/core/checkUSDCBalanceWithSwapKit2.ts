import { AssetValue, Chain, ChainToChainId } from "@swapkit/helpers";
import { erc20ABI } from "@swapkit/contracts";
import { getSwapKitClient } from "./swap/client";
import { createEvmApiFactory, ApiType } from "./swap/apiFactory";

/**
 * Vérifie la balance USDC d'une adresse Ethereum en utilisant SwapKit
 * Méthode alternative utilisant directement le contrat ERC20
 * @param address Adresse Ethereum à vérifier
 */
async function checkUSDCBalanceWithSwapKit2(address: string = "0x4cE8bEe6A8afC3debF669adC3b1727103cdBB649") {
  try {
    console.log("Initialisation de SwapKit...");

    // Initialiser SwapKit avec la factory et l'Alchemy API key comme dans swap/client.ts
    const swapKit = getSwapKitClient();

    // Connecter le wallet Ethereum
    console.log("Connexion du wallet Ethereum...");

    // Utiliser une phrase mnémonique pour connecter le wallet
    // ATTENTION: Dans un environnement de production, ne stockez JAMAIS votre phrase mnémonique en clair dans le code
    // Utilisez plutôt une variable d'environnement ou un stockage sécurisé
    const phrase = process.env.MNEMONIC || "test test test test test test test test test test test junk";

    try {
      // Connecter le wallet Ethereum avec la phrase mnémonique
      await swapKit.connectKeystore([Chain.Ethereum], phrase);

      // Vérifier si le wallet est connecté
      const ethAddress = swapKit.getAddress(Chain.Ethereum);
      if (ethAddress) {
        console.log(`✅ Wallet Ethereum connecté avec succès!`);
        console.log(`Adresse du wallet: ${ethAddress}`);
      } else {
        console.log(`❌ Échec de la connexion du wallet Ethereum`);
      }
    } catch (connectError) {
      console.error("Erreur lors de la connexion du wallet Ethereum:", connectError);
    }

    // Charger les assets statiques pour s'assurer que les tokens sont reconnus
    await AssetValue.loadStaticAssets();
    console.log("Assets statiques chargés avec succès");

    // Adresse du contrat USDC sur Ethereum
    const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const usdcIdentifier = `ETH.USDC-${usdcAddress}`;

    console.log(`Vérification de la balance USDC pour l'adresse: ${address}`);

    // Méthode 1: Utiliser le SwapKit client avec la factory et l'Alchemy API key
    console.log("\nMéthode 1: Utilisation du SwapKit client avec la factory et l'Alchemy API key");

    // Créer une instance de la factory d'API EVM avec la configuration spécifiée
    const apiFactory = createEvmApiFactory({
      apiKeys: {
        alchemy: process.env.ALCHEMY_API_KEY || "",
        covalent: process.env.COVALENT_API_KEY || "",
        ethplorer: process.env.ETHPLORER_API_KEY || "freekey",
      },
      defaultApiType: ApiType.ALCHEMY, // Type d'API par défaut
    });

    // Créer une API pour Ethereum
    const ethereumApi = apiFactory.createEthereumApi();

    try {
      // Obtenir la balance avec l'API
      const balances = await ethereumApi.getBalance(address, ChainToChainId[Chain.Ethereum]);

      // Chercher USDC dans les balances
      const usdcBalance = balances.find((token: any) =>
        token.symbol.toLowerCase().includes("usdc") ||
        (token.address && token.address.toLowerCase() === usdcAddress.toLowerCase())
      );

      if (usdcBalance) {
        // Créer un AssetValue pour formater la balance
        const usdcAsset = AssetValue.from({
          asset: usdcIdentifier,
          decimal: usdcBalance.decimal,
          value: usdcBalance.value,
        });

        console.log(`✅ Balance USDC trouvée avec l'API:`);
        console.log(`   Montant: ${usdcAsset.getValue("string")} USDC`);
        console.log(`   Valeur en base: ${usdcAsset.getBaseValue("string")}`);
        console.log(`   Décimales: ${usdcAsset.decimal}`);
      } else {
        console.log(`❌ Aucune balance USDC trouvée pour l'adresse ${address} avec l'API`);

        // Afficher toutes les balances trouvées pour aider au débogage
        console.log("\nBalances disponibles:");
        balances.forEach((token: any) => {
          console.log(`- ${token.symbol}: ${token.value}`);
        });
      }
    } catch (apiError) {
      console.error("Erreur lors de l'utilisation de l'API:", apiError);
    }

    // Méthode 2: Utiliser le SwapKit client avec le wallet connecté
    console.log("\nMéthode 2: Utilisation du SwapKit client avec le wallet connecté");

    try {
      // Obtenir le toolbox EVM
      const evmToolbox = swapKit.getWallet(Chain.Ethereum);

      if (!evmToolbox) {
        console.log("Note: Le wallet Ethereum n'est pas connecté dans SwapKit. Vérifiez que la connexion a réussi.");
      } else {
        console.log("Utilisation du wallet connecté pour vérifier la balance USDC...");

        // Méthode 2.1: Utiliser getBalance du wallet
        console.log("\nMéthode 2.1: Utilisation de getBalance du wallet");
        try {
          // Récupérer toutes les balances du wallet
          const walletBalances = await swapKit.getBalance(Chain.Ethereum, true);

          // Chercher USDC dans les balances
          const walletUsdcBalance = walletBalances.find((asset: any) =>
            asset.symbol.toLowerCase().includes("usdc") ||
            (asset.address && asset.address.toLowerCase() === usdcAddress.toLowerCase())
          );

          if (walletUsdcBalance) {
            console.log(`✅ Balance USDC trouvée avec getBalance:`);
            console.log(`   Montant: ${walletUsdcBalance.getValue("string")} USDC`);
            console.log(`   Valeur en base: ${walletUsdcBalance.getBaseValue("string")}`);
            console.log(`   Décimales: ${walletUsdcBalance.decimal}`);
          } else {
            console.log(`❌ Aucune balance USDC trouvée avec getBalance`);
          }
        } catch (balanceError) {
          console.error("Erreur lors de l'utilisation de getBalance:", balanceError);
        }

        // Méthode 2.2: Utiliser directement le contrat USDC
        console.log("\nMéthode 2.2: Utilisation directe du contrat USDC");
        try {
          // Créer une instance du contrat USDC
          const usdcContract = evmToolbox.createContract(usdcAddress, erc20ABI);

          // Obtenir les décimales du token
          const decimals = await usdcContract.decimals();

          // Obtenir la balance
          const balance = await usdcContract.balanceOf(address);

          // Créer un AssetValue pour formater la balance
          const usdcAsset = AssetValue.from({
            asset: usdcIdentifier,
            decimal: Number(decimals),
            value: balance.toString(),
          });

          console.log(`✅ Balance USDC trouvée avec le contrat:`);
          console.log(`   Montant: ${usdcAsset.getValue("string")} USDC`);
          console.log(`   Valeur en base: ${usdcAsset.getBaseValue("string")}`);
          console.log(`   Décimales: ${usdcAsset.decimal}`);
        } catch (contractError) {
          console.error("Erreur lors de l'utilisation directe du contrat USDC:", contractError);
        }
      }
    } catch (swapKitError) {
      console.error("Erreur lors de l'utilisation de SwapKit:", swapKitError);
    }
  } catch (error) {
    console.error("Erreur lors de la vérification de la balance USDC:", error);

    // Afficher des informations supplémentaires pour aider au débogage
    if (error instanceof Error) {
      console.error("Message d'erreur:", error.message);
      console.error("Stack trace:", error.stack);
    }
  }
}

// Exécuter la fonction avec l'adresse par défaut
// Vous pouvez passer une autre adresse en argument
checkUSDCBalanceWithSwapKit2();
