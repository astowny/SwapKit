import {config} from 'dotenv';
import { ethers } from 'ethers';
config()
async function checkUSDCBalance() {
  // Créer un provider (connexion au réseau Ethereum)
  // Utilisation d'un RPC public Ethereum
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');

  // Adresse du contrat USDC sur Ethereum mainnet
  const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  // Adresse à vérifier
  const addressToCheck = '0x4cE8bEe6A8afC3debF669adC3b1727103cdBB649';

  // ABI minimal pour appeler balanceOf
  const minABI = [
    {
      "constant": true,
      "inputs": [{ "name": "_owner", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "name": "balance", "type": "uint256" }],
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [{ "name": "", "type": "uint8" }],
      "type": "function"
    }
  ];

  // Créer une instance du contrat
  const contract = new ethers.Contract(usdcAddress, minABI, provider);

  // Obtenir les décimales
  const decimals = await contract.decimals();

  // Obtenir la balance
  const balance = await contract.balanceOf(addressToCheck);

  // Convertir la balance en format lisible
  const formattedBalance = ethers.formatUnits(balance, decimals);

  console.log(`Balance USDC: ${formattedBalance}`);
}

checkUSDCBalance();