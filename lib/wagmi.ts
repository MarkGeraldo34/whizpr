import { http, createConfig } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { defineChain } from 'viem';

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 196);
const rpcUrl = process.env.NEXT_PUBLIC_CHAIN_RPC_URL ?? 'https://your-rpc-endpoint';

export const targetChain = defineChain({
  id: chainId,
  name: 'Whizpr Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
});

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [targetChain],
  connectors: [
    injected(),
    ...(walletConnectProjectId
      ? [walletConnect({ projectId: walletConnectProjectId })]
      : []),
  ],
  transports: {
    [targetChain.id]: http(rpcUrl),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
