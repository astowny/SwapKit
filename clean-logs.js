const fs = require('fs');
const path = require('path');

// Fonction pour rechercher et remplacer les logs directs de swapKit
function cleanLogsInFile(filePath) {
  try {
    // Lire le contenu du fichier
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remplacer les logs directs de swapKit par notre fonction de nettoyage
    const originalContent = content;
    
    // Remplacer console.log(cleanSwapKitForLogging(swapKit)) par notre fonction de nettoyage
    content = content.replace(
      /console\.log\s*\(\s*swapKit\s*\)/g, 
      'console.log(cleanSwapKitForLogging(swapKit))'
    );
    
    // Remplacer console.log("message", cleanSwapKitForLogging(swapKit)) par notre fonction de nettoyage
    content = content.replace(
      /console\.log\s*\(\s*(['"`][^'"`]*['"`])\s*,\s*swapKit\s*\)/g, 
      'console.log($1, cleanSwapKitForLogging(swapKit))'
    );
    
    // Vérifier si des modifications ont été apportées
    if (content !== originalContent) {
      // Vérifier si le fichier importe déjà cleanSwapKitForLogging
      if (!content.includes('import { cleanSwapKitForLogging }') && !content.includes('import { cleanWalletForLogging, cleanSwapKitForLogging }')) {
        // Ajouter l'import si nécessaire
        content = content.replace(
          /^(import .* from .*;\n)/m,
          '$1import { cleanSwapKitForLogging } from "./swap/walletLogger";\n'
        );
      }
      
      // Écrire le contenu modifié dans le fichier
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fichier modifié: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Erreur lors du traitement du fichier ${filePath}:`, error);
    return false;
  }
}

// Fonction pour parcourir récursivement un répertoire
function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  let modifiedFiles = 0;
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      // Ignorer les répertoires node_modules et .git
      if (file !== 'node_modules' && file !== '.git') {
        modifiedFiles += processDirectory(filePath);
      }
    } else if (stats.isFile() && (file.endsWith('.ts') || file.endsWith('.js'))) {
      if (cleanLogsInFile(filePath)) {
        modifiedFiles++;
      }
    }
  }
  
  return modifiedFiles;
}

// Répertoire de départ (répertoire courant)
const startDirectory = process.cwd();
console.log(`Nettoyage des logs dans le répertoire: ${startDirectory}`);

// Lancer le traitement
const modifiedFiles = processDirectory(startDirectory);
console.log(`Terminé! ${modifiedFiles} fichiers modifiés.`);
