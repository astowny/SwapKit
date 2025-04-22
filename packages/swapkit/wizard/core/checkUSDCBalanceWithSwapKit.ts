import { AssetValue, Chain } from "@swapkit/helpers";
import { erc20ABI } from "@swapkit/contracts";
import { getSwapKitClient } from "./swap/client";
import { ETHToolbox } from "@swapkit/toolbox-evm";
import { ethers } from "ethers";

/**
 * Vérifie la balance USDC d'une adresse Ethereum en utilisant SwapKit
 * @param address Adresse Ethereum à vérifier
 */
async function checkUSDCBalanceWithSwapKit(address: string = "0x4cE8bEe6A8afC3debF669adC3b1727103cdBB649") {
  try {
    console.log("Initialisation...");

    // Charger les assets statiques pour s'assurer que les tokens sont reconnus
    await AssetValue.loadStaticAssets();
    console.log("Assets statiques chargés avec succès");

    // Adresse du contrat USDC sur Ethereum
    const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const usdcIdentifier = `ETH.USDC-${usdcAddress}`;

    console.log(`Vérification de la balance USDC pour l'adresse: ${address}`);

    // Méthode 1: Utiliser directement le toolbox Ethereum
    // Cette méthode ne nécessite pas de connecter un wallet
    console.log("\nMéthode 1: Utilisation directe du toolbox Ethereum");

    // Créer une instance du toolbox Ethereum
    // Utiliser un RPC public pour Ethereum
    const rpcUrl = "https://eth.llamarpc.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const toolbox = ETHToolbox({
      provider,
      apiKey: "freekey"
    });

    try {
      // Obtenir la balance avec le toolbox
      const balances = await toolbox.getBalance(address, true);

      // Chercher USDC dans les balances
      const usdcBalance = balances.find((asset: any) =>
        asset.symbol.toLowerCase().includes("usdc") ||
        asset.ticker.toLowerCase() === "usdc"
      );

      if (usdcBalance) {
        console.log(`✅ Balance USDC trouvée:`);
        console.log(`   Montant: ${usdcBalance.getValue("string")} USDC`);
        console.log(`   Valeur en base: ${usdcBalance.getBaseValue("string")}`);
        console.log(`   Décimales: ${usdcBalance.decimal}`);
      } else {
        console.log(`❌ Aucune balance USDC trouvée pour l'adresse ${address}`);

        // Afficher toutes les balances trouvées pour aider au débogage
        console.log("\nBalances disponibles:");
        balances.forEach((asset: any) => {
          console.log(`- ${asset.symbol}: ${asset.getValue("string")}`);
        });
      }
    } catch (error) {
      console.error("Erreur lors de l'utilisation du toolbox Ethereum:", error);

      // Méthode 2: Utiliser directement le contrat USDC
      console.log("\nMéthode 2: Utilisation directe du contrat USDC");

      try {
        // Créer une instance du contrat USDC
        const usdcContract = toolbox.createContract(usdcAddress, erc20ABI);

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

        console.log(`✅ Balance USDC:`);
        console.log(`   Montant: ${usdcAsset.getValue("string")} USDC`);
        console.log(`   Valeur en base: ${usdcAsset.getBaseValue("string")}`);
        console.log(`   Décimales: ${usdcAsset.decimal}`);
      } catch (contractError) {
        console.error("Erreur lors de l'utilisation directe du contrat USDC:", contractError);
      }
    }

    // Méthode 3: Utiliser SwapKit (nécessite un wallet connecté)
    console.log("\nMéthode 3: Utilisation de SwapKit");
    try {
      // Initialiser SwapKit
      const swapKit = getSwapKitClient();

      // Obtenir le toolbox EVM
      const evmToolbox = swapKit.getWallet(Chain.Ethereum);

      if (!evmToolbox) {
        console.log("Note: Le wallet Ethereum n'est pas connecté dans SwapKit. Cette méthode nécessite un wallet connecté.");
        console.log("Utilisez les méthodes 1 ou 2 qui ne nécessitent pas de wallet connecté.");
      } else {
        // Vérifier la balance
        const balances = await evmToolbox.getBalance(address, true);

        // Chercher USDC dans les balances
        const usdcBalance = balances.find((asset: any) =>
          asset.symbol.toLowerCase().includes("usdc") ||
          asset.ticker.toLowerCase() === "usdc"
        );

        if (usdcBalance) {
          console.log(`✅ Balance USDC trouvée avec SwapKit:`);
          console.log(`   Montant: ${usdcBalance.getValue("string")} USDC`);
          console.log(`   Valeur en base: ${usdcBalance.getBaseValue("string")}`);
          console.log(`   Décimales: ${usdcBalance.decimal}`);
        } else {
          console.log(`❌ Aucune balance USDC trouvée pour l'adresse ${address} avec SwapKit`);
        }
      }
    } catch (swapKitError) {
      console.log("Note: Erreur lors de l'utilisation de SwapKit. Cette méthode nécessite un wallet connecté.");
      console.log("Utilisez les méthodes 1 ou 2 qui ne nécessitent pas de wallet connecté.");
    }
  } catch (error) {
    console.error("Erreur lors de la vérification de la balance USDC:", error);
  }
}

// Exécuter la fonction avec l'adresse par défaut
// Vous pouvez passer une autre adresse en argument
// checkUSDCBalanceWithSwapKit();
