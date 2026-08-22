import {
  Container,
  ProgramHeader,
  WalletGate,
  PendingWiring,
  TokenIcon,
} from "@/components/ui";
import { PROGRAM_IDS } from "@/lib/constants";

export default function TokenPage() {
  return (
    <Container>
      <ProgramHeader
        title="Token System"
        programId={PROGRAM_IDS.tokenSystem.toBase58()}
        instructions={[
          "create_token",
          "mint_tokens",
          "transfer_tokens",
          "burn_tokens",
          "update_metadata",
        ]}
        icon={<TokenIcon />}
      />
      <WalletGate>
        <PendingWiring program="token-system" />
      </WalletGate>
    </Container>
  );
}
