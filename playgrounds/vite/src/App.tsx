import { AssetValue, Chain, type FullWallet } from "@swapkit/core";
import { useCallback, useEffect, useMemo, useState } from "react";

import { WalletWidget } from "@swapkit/wallet-exodus";
import Liquidity from "./Liquidity";
import Loan from "./Loan";
import Multisig from "./Multisig";
import Send from "./Send";
import Swap from "./Swap";
import TNS from "./TNS";
import { Wallet } from "./Wallet";
import { WalletPicker } from "./WalletPicker";
import { getSwapKitClient } from "./swapKitClient";

const apiKeys = ["walletConnectProjectId"] as const;

type WalletDataType = FullWallet[Chain] | FullWallet[Chain][] | null;

// Composant de débogage pour afficher les erreurs
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Erreur capturée par ErrorBoundary:', event.error);
      setHasError(true);
      setError(event.error);
      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div style={{ padding: '20px', color: 'red', border: '1px solid red', margin: '20px' }}>
        <h2>Une erreur s'est produite</h2>
        <p>{error?.message || 'Erreur inconnue'}</p>
        <pre>{error?.stack}</pre>
        <button onClick={() => window.location.reload()}>Recharger la page</button>
      </div>
    );
  }

  return <>{children}</>;
};

const App = () => {
  console.log('Rendu du composant App');

  const [widgetType, setWidgetType] = useState<"swap" | "loan" | "earn">("swap");
  const [wallet, setWallet] = useState<WalletDataType>(null);
  const [phrase, setPhrase] = useState("");
  const [stagenet, setStagenet] = useState(false);
  const [assetListLoaded, setAssetListLoaded] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ [key: string]: any }>({});

  /**
   * NOTE: Test API keys - please use your own API keys in app as those will timeout, reach limits, etc.
   */
  const [keys, setKeys] = useState({
    blockchairApiKey: import.meta.env.VITE_BLOCKCHAIR_API_KEY || "A___Tcn5B16iC3mMj7QrzZCb2Ho1QBUf",
    covalentApiKey: import.meta.env.VITE_COVALENT_API_KEY || "cqt_rQ6333MVWCVJFVX3DbCCGMVqRH4q",
    alchemyApiKey: import.meta.env.VITE_ALCHEMY_API_KEY || import.meta.env.ALCHEMY_API_KEY || "",
    ethplorerApiKey: import.meta.env.VITE_ETHPLORER_API_KEY || "freekey",
    swapkitApiKey: import.meta.env.VITE_SWAPKIT_API_KEY || "freekey",
    walletConnectProjectId: "",
    brokerEndpoint: "https://dev-api.swapkit.dev/channel",
  });

  const [{ inputAsset, outputAsset }, setSwapAssets] = useState<{
    inputAsset?: AssetValue;
    outputAsset?: AssetValue;
  }>({});

  const skClient = getSwapKitClient({ ...keys, stagenet });

  useEffect(() => {
    AssetValue.loadStaticAssets().then(({ ok }) => {
      setAssetListLoaded(ok);

      // Afficher la balance de THOR.RUNE dans la console
      const checkThorRuneBalance = async () => {
        try {
          // Créer un AssetValue pour THOR.RUNE
          const thorRuneAsset = AssetValue.from({
            asset: "THOR.RUNE",
            value: 0,
          });

          console.log("Asset THOR.RUNE créé:", thorRuneAsset);

          // Vérifier si un portefeuille THORChain est connecté
          const thorWallet = skClient.getWallet(Chain.THORChain);

          if (thorWallet) {
            console.log("Portefeuille THORChain connecté:", thorWallet.address);

            // Obtenir la balance
            const balance = await skClient.getBalance(Chain.THORChain, true);
            console.log("Balance complète:", balance);

            // Filtrer pour trouver THOR.RUNE
            const runeBalance = balance.find(asset => asset.ticker === "RUNE" && asset.chain === Chain.THORChain);

            if (runeBalance) {
              console.log("Balance THOR.RUNE:", runeBalance.toString());
              console.log("Valeur numérique:", runeBalance.getValue("number"));
            } else {
              console.log("Aucune balance THOR.RUNE trouvée");
            }
          } else {
            console.log("Aucun portefeuille THORChain connecté. Veuillez d'abord connecter un portefeuille.");
          }
        } catch (error) {
          console.error("Erreur lors de la vérification de la balance THOR.RUNE:", error);
        }
      };

      // Exécuter la vérification après le chargement des assets
      if (ok && skClient) {
        checkThorRuneBalance();
      }
    });
  }, [skClient]);

  const setAsset = useCallback(
    (asset: AssetValue) => {
      if (!inputAsset) {
        setSwapAssets({ inputAsset: asset });
      }

      if (outputAsset) {
        setSwapAssets({ inputAsset: asset, outputAsset: undefined });
      } else {
        setSwapAssets({ inputAsset, outputAsset: asset });
      }
    },
    [inputAsset, outputAsset],
  );

  const disconnectChain = (chain: Chain) => {
    if (!skClient) return;
    skClient.disconnectChain(chain);
    setWallet(Object.values(skClient.getAllWallets()));
  };

  const disconnectAll = () => {
    if (!skClient) return;
    skClient.disconnectAll();
    setWallet([]);
  };

  const checkThorRuneBalance = async () => {
    try {
      if (!skClient) {
        console.log("Client SwapKit non initialisé");
        return;
      }

      // Vérifier si un portefeuille THORChain est connecté
      const thorWallet = skClient.getWallet(Chain.THORChain);

      if (thorWallet) {
        console.log("Portefeuille THORChain connecté:", thorWallet.address);

        // Obtenir la balance avec refresh=true pour forcer une mise à jour
        const balance = await skClient.getBalance(Chain.THORChain, true);
        console.log("Balance complète:", balance);

        // Filtrer pour trouver THOR.RUNE
        const runeBalance = balance.find(asset => asset.ticker === "RUNE" && asset.chain === Chain.THORChain);

        if (runeBalance) {
          console.log("Balance THOR.RUNE:", runeBalance.toString());
          console.log("Valeur numérique:", runeBalance.getValue("number"));
          return runeBalance;
        } else {
          console.log("Aucune balance THOR.RUNE trouvée");
          return null;
        }
      } else {
        console.log("Aucun portefeuille THORChain connecté. Veuillez d'abord connecter un portefeuille.");
        return null;
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de la balance THOR.RUNE:", error);
      return null;
    }
  };

  const Widgets = useMemo(
    () => ({
      swap: skClient ? (
        <Swap inputAsset={inputAsset} outputAsset={outputAsset} skClient={skClient} />
      ) : null,
      tns: skClient ? <TNS skClient={skClient} /> : null,
      loan: skClient ? (
        <Loan inputAsset={inputAsset} outputAsset={outputAsset} skClient={skClient} />
      ) : null,
      send: skClient ? <Send inputAsset={inputAsset} skClient={skClient} /> : null,
      earn: <div>Earn</div>,
      multisig: skClient ? (
        <Multisig inputAsset={inputAsset} phrase={phrase} skClient={skClient} stagenet={stagenet} />
      ) : null,
      liquidity: skClient ? (
        <Liquidity otherAsset={outputAsset} nativeAsset={inputAsset} skClient={skClient} />
      ) : null,
    }),
    [skClient, inputAsset, outputAsset, phrase, stagenet],
  );

  // Collecter des informations de débogage
  useEffect(() => {
    try {
      // Vérifier si SwapKit est correctement initialisé
      setDebugInfo(prev => ({
        ...prev,
        skClientInitialized: !!skClient,
        skClientKeys: skClient ? Object.keys(skClient) : [],
        assetListLoaded,
        windowGlobal: !!window.global,
        windowBuffer: !!window.Buffer,
        globalThisBuffer: !!globalThis.Buffer,
        userAgent: navigator.userAgent,
      }));
    } catch (error) {
      console.error('Erreur lors de la collecte des informations de débogage:', error);
    }
  }, [skClient, assetListLoaded]);

  return (
    <ErrorBoundary>
      <div>
        <h3>
          SwapKit Playground -{" "}
          {assetListLoaded ? "🚀 Asset List Loaded 🚀" : "🔄 Loading Asset List..."}
          <div>
            {apiKeys.map((key) => (
              <input
                key={key}
                onChange={(e) => setKeys((k) => ({ ...k, [key]: e.target.value }))}
                placeholder={key}
                value={keys[key]}
              />
            ))}
          </div>
          <button onClick={() => setStagenet((v) => !v)} type="button">
            Toggle Stagenet - Currently = {`${stagenet}`.toUpperCase()}
          </button>
          <button
            onClick={async () => {
              const balance = await checkThorRuneBalance();
              if (balance) {
                alert(`Balance THOR.RUNE: ${balance.toString()}`);
              } else {
                alert("Aucune balance THOR.RUNE disponible. Connectez d'abord un portefeuille THORChain.");
              }
            }}
            type="button"
            style={{ marginLeft: '10px' }}
          >
            Vérifier Balance THOR.RUNE
          </button>
        </h3>

        {/* Section de débogage */}
        <div style={{ margin: '20px 0', padding: '10px', border: '1px dashed #ccc', backgroundColor: '#f5f5f5' }}>
          <h4>Informations de débogage</h4>
          <pre style={{ overflow: 'auto', maxHeight: '200px' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
          <button
            onClick={() => {
              console.log('SwapKit Client:', skClient);
              console.log('Debug Info:', debugInfo);
              alert('Informations de débogage envoyées à la console');
            }}
            type="button"
          >
            Log Debug Info
          </button>
        </div>

        <div style={{ cursor: skClient ? "default" : "not-allowed" }}>
          <div
            style={{
              pointerEvents: skClient ? "all" : "none",
              opacity: skClient ? 1 : 0.5,
            }}
          >
            <div style={{ display: "flex", flex: 1, flexDirection: "row" }}>
              {skClient && (
                <WalletPicker setPhrase={setPhrase} setWallet={setWallet} skClient={skClient} />
              )}

              <div>
                <select
                  onChange={(e) => setWidgetType(e.target.value as "loan")}
                  style={{ marginBottom: 10 }}
                >
                  {Object.keys(Widgets).map((widget) => (
                    <option key={widget} value={widget}>
                      {widget}
                    </option>
                  ))}
                </select>

                {Widgets[widgetType]}
              </div>
            </div>

            {skClient && (
              <>
                <button onClick={disconnectAll} type="button">
                  Disconnect All
                </button>
                {Array.isArray(wallet) ? (
                  wallet.map((walletData) => (
                    <Wallet
                      key={`${walletData?.address}-${walletData?.balance?.[0]?.chain}`}
                      setAsset={setAsset}
                      walletData={walletData}
                      disconnect={() => disconnectChain(walletData?.balance?.[0]?.chain as Chain)}
                    />
                  ))
                ) : (
                  <Wallet
                    key={`${wallet?.address}-${wallet?.balance?.[0]?.chain}`}
                    setAsset={setAsset}
                    walletData={wallet as FullWallet[Chain]}
                    disconnect={() => disconnectChain(wallet?.balance?.[0]?.chain as Chain)}
                  />
                )}
              </>
            )}
            <WalletWidget />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
