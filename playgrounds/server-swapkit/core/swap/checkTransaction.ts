import { ChainId } from "../../../../types/src/index";
import { checkSwapStatus } from "./verifyTransaction";

/**
 * Script simple pour vérifier l'état d'une transaction de swap existante
 * 
 * Usage:
 * node checkTransaction.js <txHash> <chainId> <destinationAsset> <destinationAddress>
 * 
 * Exemple:
 * node checkTransaction.js 0x123abc ChainId.Ethereum ETH.ETH 0x456def
 */

// Récupérer les arguments de la ligne de commande
const txHash = process.argv[2];
const chainIdStr = process.argv[3];
const destinationAsset = process.argv[4];
const destinationAddress = process.argv[5];

// Vérifier que tous les arguments nécessaires sont fournis
if (!txHash || !chainIdStr || !destinationAsset || !destinationAddress) {
  console.error(`
Usage: node checkTransaction.js <txHash> <chainId> <destinationAsset> <destinationAddress>
Exemple: node checkTransaction.js 0x123abc Ethereum ETH.ETH 0x456def
  `);
  process.exit(1);
}

// Convertir la chaîne ChainId en enum
const chainId = ChainId[chainIdStr] || chainIdStr;

// Exécuter la vérification
console.log(`
=================================================
🔍 VÉRIFICATION D'UNE TRANSACTION DE SWAP
=================================================
Transaction: ${txHash}
Chaîne: ${chainIdStr}
Asset de destination: ${destinationAsset}
Adresse de destination: ${destinationAddress}
=================================================
`);

checkSwapStatus(txHash, chainId as ChainId, destinationAsset, destinationAddress)
  .then(result => {
    console.log("\nRésultat détaillé:");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error("Erreur lors de la vérification:", error);
    process.exit(1);
  });
