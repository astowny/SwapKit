const fs = require('fs');
const path = require('path');

// Chemin du fichier à modifier
const filePath = path.join(__dirname, 'packages/swapkit/wizard/core/swap/realSwap.ts');

// Lire le contenu du fichier
let content = fs.readFileSync(filePath, 'utf8');

// Remplacer les console.log par logger.debug
content = content.replace(/console\.log\(\s*(`[^`]*`|"[^"]*"|'[^']*')([^)]*)\)/g, (match, p1, p2) => {
  // Si le message commence par [DEBUG], on le remplace par logger.debug sans le préfixe
  if (p1.includes('[DEBUG]')) {
    const message = p1.replace(/\[DEBUG\]\s*/, '');
    return `logger.debug(${message}${p2})`;
  }
  // Sinon, on le remplace par logger.info
  return `logger.info(${p1}${p2})`;
});

// Remplacer les console.error par logger.error
content = content.replace(/console\.error\(\s*(`[^`]*`|"[^"]*"|'[^']*')([^)]*)\)/g, (match, p1, p2) => {
  return `logger.error(${p1}${p2})`;
});

// Remplacer les console.warn par logger.warn
content = content.replace(/console\.warn\(\s*(`[^`]*`|"[^"]*"|'[^']*')([^)]*)\)/g, (match, p1, p2) => {
  return `logger.warn(${p1}${p2})`;
});

// Écrire le contenu modifié dans le fichier
fs.writeFileSync(filePath, content, 'utf8');

console.log('Remplacement des logs terminé !');
