import { networkMonitor, NetworkData } from './networkMonitor';
import fs from 'fs';

/**
 * Obtient les logs réseau
 * @returns Les logs réseau
 */
export function getNetworkLogs(): NetworkData[] {
  return networkMonitor.getLogs();
}

/**
 * Efface les logs réseau
 */
export function clearNetworkLogs(): void {
  networkMonitor.clearLogs();
}

/**
 * Exporte les logs réseau vers un fichier JSON
 * @param filePath Chemin du fichier de sortie
 * @returns true si l'export a réussi, false sinon
 */
export function exportNetworkLogs(filePath: string): boolean {
  try {
    const logs = networkMonitor.getLogs();
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf8');
    console.log(`Logs réseau exportés vers ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'export des logs réseau: ${error}`);
    return false;
  }
}

/**
 * Analyse les logs réseau pour obtenir des statistiques
 * @returns Statistiques sur les appels réseau
 */
export function analyzeNetworkLogs() {
  const logs = networkMonitor.getLogs();
  
  if (logs.length === 0) {
    return {
      totalCalls: 0,
      message: "Aucun appel réseau enregistré"
    };
  }
  
  // Calculer les statistiques
  const totalCalls = logs.length;
  const totalDuration = logs.reduce((sum, log) => sum + log.durationMs, 0);
  const avgDuration = totalDuration / totalCalls;
  const minDuration = Math.min(...logs.map(log => log.durationMs));
  const maxDuration = Math.max(...logs.map(log => log.durationMs));
  
  // Compter les appels par URL
  const callsByUrl = logs.reduce((acc, log) => {
    const url = log.url;
    acc[url] = (acc[url] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Compter les erreurs
  const errorCount = logs.filter(log => log.error).length;
  
  return {
    totalCalls,
    totalDuration,
    avgDuration,
    minDuration,
    maxDuration,
    callsByUrl,
    errorCount,
    errorRate: (errorCount / totalCalls) * 100
  };
}

/**
 * Affiche un résumé des logs réseau dans la console
 */
export function printNetworkSummary(): void {
  const stats = analyzeNetworkLogs();
  
  if ('message' in stats) {
    console.log(stats.message);
    return;
  }
  
  console.log('\n===== Résumé des appels réseau =====');
  console.log(`Nombre total d'appels: ${stats.totalCalls}`);
  console.log(`Durée totale: ${stats.totalDuration.toFixed(2)}ms`);
  console.log(`Durée moyenne: ${stats.avgDuration.toFixed(2)}ms`);
  console.log(`Durée min: ${stats.minDuration.toFixed(2)}ms`);
  console.log(`Durée max: ${stats.maxDuration.toFixed(2)}ms`);
  console.log(`Taux d'erreur: ${stats.errorRate.toFixed(2)}%`);
  
  console.log('\nAppels par URL:');
  Object.entries(stats.callsByUrl).forEach(([url, count]) => {
    console.log(`  ${url}: ${count} appel(s)`);
  });
  
  console.log('\n===================================');
}
