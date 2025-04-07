import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

// Interface pour les données de réseau
export interface NetworkData {
  timestamp: string;
  url: string;
  method: string;
  requestPayload?: any;
  responseStatus?: number;
  responseData?: any;
  durationMs: number;
  error?: string;
}

// Configuration du moniteur réseau
export interface NetworkMonitorConfig {
  enabled: boolean;
  logToConsole: boolean;
  logToFile: boolean;
  logFilePath: string;
  includeRequestPayload: boolean;
  includeResponseData: boolean;
}

// Configuration par défaut
const defaultConfig: NetworkMonitorConfig = {
  enabled: true,
  logToConsole: false, // Désactivé par défaut pour réduire les logs
  logToFile: true,
  logFilePath: './network_logs.json',
  includeRequestPayload: true,
  includeResponseData: false, // Peut être volumineux, désactivé par défaut
};

// Classe pour surveiller les appels réseau
export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private config: NetworkMonitorConfig;
  private logs: NetworkData[] = [];

  private constructor(config: Partial<NetworkMonitorConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    // Créer le répertoire du fichier de log si nécessaire
    if (this.config.logToFile) {
      const dir = path.dirname(this.config.logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  // Obtenir l'instance singleton
  public static getInstance(config?: Partial<NetworkMonitorConfig>): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor(config);
    }
    return NetworkMonitor.instance;
  }

  // Configurer le moniteur
  public configure(config: Partial<NetworkMonitorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Enregistrer un appel réseau
  public async logNetworkCall<T>(
    url: string,
    method: string,
    requestFn: () => Promise<T>,
    requestPayload?: any
  ): Promise<T> {
    if (!this.config.enabled) {
      return requestFn();
    }

    const startTime = performance.now();
    const timestamp = new Date().toISOString();
    let responseStatus: number | undefined;
    let responseData: any;
    let error: string | undefined;
    let result: T;

    try {
      // Exécuter la requête
      result = await requestFn();

      // Extraire le statut et les données si possible
      if (result && typeof result === 'object') {
        responseData = result;
        if ('status' in result) {
          responseStatus = (result as any).status;
        }
      }

      return result;
    } catch (err: any) {
      error = err.message || 'Unknown error';
      throw err;
    } finally {
      const endTime = performance.now();
      const durationMs = endTime - startTime;

      // Créer l'entrée de log
      const logEntry: NetworkData = {
        timestamp,
        url,
        method,
        durationMs,
        responseStatus,
        error,
      };

      // Ajouter les données de requête et réponse si configuré
      if (this.config.includeRequestPayload && requestPayload) {
        logEntry.requestPayload = requestPayload;
      }

      if (this.config.includeResponseData && responseData) {
        logEntry.responseData = responseData;
      }

      // Ajouter au tableau de logs
      this.logs.push(logEntry);

      // Afficher dans la console si configuré
      if (this.config.logToConsole) {
        console.log(`[Network] ${method} ${url} - ${durationMs.toFixed(2)}ms ${error ? `- Error: ${error}` : ''}`);
        if (this.config.includeRequestPayload && requestPayload) {
          console.log(`[Network] Request:`, requestPayload);
        }
        if (this.config.includeResponseData && responseData) {
          console.log(`[Network] Response:`, responseData);
        }
      }

      // Enregistrer dans un fichier si configuré
      if (this.config.logToFile) {
        try {
          fs.writeFileSync(
            this.config.logFilePath,
            JSON.stringify(this.logs, null, 2),
            'utf8'
          );
        } catch (fileErr) {
          console.error(`Failed to write network logs to file: ${fileErr}`);
        }
      }
    }
  }

  // Obtenir tous les logs
  public getLogs(): NetworkData[] {
    return [...this.logs];
  }

  // Effacer tous les logs
  public clearLogs(): void {
    this.logs = [];
    if (this.config.logToFile && fs.existsSync(this.config.logFilePath)) {
      fs.writeFileSync(this.config.logFilePath, JSON.stringify([]), 'utf8');
    }
  }
}

// Exporter une instance par défaut pour faciliter l'utilisation
export const networkMonitor = NetworkMonitor.getInstance();

// Fonction utilitaire pour wrapper une fonction d'API
export function withNetworkMonitoring<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  urlFn: (...args: Parameters<T>) => string,
  method: string = 'POST'
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const url = urlFn(...args);
    const requestPayload = args.length > 0 ? args[0] : undefined;

    // Utiliser directement la fonction originale sans ajouter la clé API
    // car SwapKit gère déjà l'ajout de la clé API dans les en-têtes
    const wrappedFn = async () => {
      // Appeler la fonction originale avec les arguments d'origine
      return fn(...args);
    };

    return networkMonitor.logNetworkCall(
      url,
      method,
      wrappedFn,
      requestPayload
    );
  };
}
