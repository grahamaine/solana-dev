import {
  Container,
  ProgramHeader,
  WalletGate,
  PendingWiring,
} from "@/components/ui";
import { PROGRAM_IDS } from "@/lib/constants";

export default function CounterPage() {
  return (
    <Container>
      <ProgramHeader
        title="Counter"
        programId={PROGRAM_IDS.counter.toBase58()}
        instructions={["initialize", "increment", "decrement", "reset"]}
      />
      <WalletGate>
        <PendingWiring program="counter" />
      </WalletGate>
    </Container>
  );
}
