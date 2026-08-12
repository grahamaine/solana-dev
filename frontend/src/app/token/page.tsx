import {
  Container,
  ProgramHeader,
  WalletGate,
  PendingWiring,
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
      />
      <WalletGate>
        <PendingWiring program="token-system" />
      </WalletGate>
    </Container>
  );
}
