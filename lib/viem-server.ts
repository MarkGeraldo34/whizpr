import { createPublicClient, http, parseAbi, type Hash, type PublicClient } from 'viem';
import { targetChain } from './wagmi';

// Constructed lazily, on first actual verification call, rather than at
// module load — Next.js imports route modules (without invoking their
// handlers) while collecting page data at build time, and createPublicClient
// throws immediately if the transport has no URL, which would otherwise fail
// the production build in any environment where the RPC URL isn't set (or is
// blank) at build time.
let client: PublicClient | null = null;

function getServerClient(): PublicClient {
  if (!client) {
    // `||`, not `??` — a var that's present but blank (SERVER_RPC_URL="")
    // should fall through to the next option the same way an unset one does.
    const rpcUrl = process.env.SERVER_RPC_URL || process.env.NEXT_PUBLIC_CHAIN_RPC_URL;
    if (!rpcUrl) {
      throw new Error(
        'SERVER_RPC_URL (or NEXT_PUBLIC_CHAIN_RPC_URL) is not set — deposit verification cannot connect to the chain.',
      );
    }
    client = createPublicClient({
      chain: targetChain,
      transport: http(rpcUrl),
    });
  }
  return client;
}

const erc20TransferAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

export interface DepositVerificationResult {
  verified: boolean;
  amount?: bigint;
  from?: `0x${string}`;
  confirmations?: number;
  reason?: string;
}

/**
 * Verifies a USDT ERC-20 Transfer event to the Whizpr deposit address,
 * requiring the configured minimum number of confirmations before the
 * deposit is considered final and creditable to the prepaid ledger.
 */
export async function verifyUsdtDeposit(txHash: Hash): Promise<DepositVerificationResult> {
  const tokenAddress = process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS as `0x${string}` | undefined;
  const depositAddress = process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS as `0x${string}` | undefined;
  const minConfirmations = Number(process.env.DEPOSIT_MIN_CONFIRMATIONS ?? 3);

  if (!tokenAddress || !depositAddress) {
    return { verified: false, reason: 'USDT token or deposit address not configured' };
  }

  const serverClient = getServerClient();
  const receipt = await serverClient.getTransactionReceipt({ hash: txHash });

  if (receipt.status !== 'success') {
    return { verified: false, reason: 'Transaction reverted' };
  }

  const latestBlock = await serverClient.getBlockNumber();
  const confirmations = Number(latestBlock - receipt.blockNumber);

  const transferLog = receipt.logs.find(
    (log) => log.address.toLowerCase() === tokenAddress.toLowerCase(),
  );

  if (!transferLog) {
    return { verified: false, reason: 'No USDT transfer log found in transaction' };
  }

  // Decode using viem's log parsing against the ERC-20 Transfer signature.
  const decoded = await serverClient
    .getLogs({
      address: tokenAddress,
      event: erc20TransferAbi[0],
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    })
    .then((logs) => logs.find((l) => l.transactionHash === txHash));

  if (!decoded) {
    return { verified: false, reason: 'Could not decode Transfer event' };
  }

  const { to, from, value } = decoded.args as {
    to: `0x${string}`;
    from: `0x${string}`;
    value: bigint;
  };

  if (to.toLowerCase() !== depositAddress.toLowerCase()) {
    return { verified: false, reason: 'Transfer recipient is not the Whizpr deposit address' };
  }

  if (confirmations < minConfirmations) {
    return {
      verified: false,
      confirmations,
      reason: `Waiting for confirmations (${confirmations}/${minConfirmations})`,
    };
  }

  return { verified: true, amount: value, from, confirmations };
}
