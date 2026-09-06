// Server wrapper: hands the corpus client ids and the pursuit criteria to the
// client orchestrator. All pipeline logic and rendering live in app/agent.tsx.

import Agent from "@/app/agent";
import { clientIds, criteria } from "@/lib/data";

export default function Page() {
  return <Agent clientIds={clientIds} criteria={criteria} />;
}
