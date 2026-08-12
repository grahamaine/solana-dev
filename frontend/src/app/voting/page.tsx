import {
  Container,
  ProgramHeader,
  WalletGate,
  PendingWiring,
} from "@/components/ui";
import { PROGRAM_IDS } from "@/lib/constants";

export default function VotingPage() {
  return (
    <Container>
      <ProgramHeader
        title="Voting"
        programId={PROGRAM_IDS.voting.toBase58()}
        instructions={[
          "create_poll",
          "add_candidate",
          "activate_poll",
          "vote",
          "close_poll",
        ]}
      />
      <WalletGate>
        <PendingWiring program="voting" />
      </WalletGate>
    </Container>
  );
}
