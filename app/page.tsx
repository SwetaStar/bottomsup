// Server wrapper: passes the corpus client ids to the client orchestrator.
// All pipeline logic and rendering live in app/agent.tsx.

import Agent from "@/app/agent";
import { clientIds } from "@/lib/data";

export default function Page() {
  return <Agent clientIds={clientIds} />;
}
