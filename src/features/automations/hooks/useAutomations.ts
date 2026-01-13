import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export function useAutomations() {
  const automations = useQuery(api.automations.index.list);
  const stats = useQuery(api.automations.index.getStats);

  const createAutomation = useMutation(api.automations.index.create);
  const updateAutomation = useMutation(api.automations.index.update);
  const removeAutomation = useMutation(api.automations.index.remove);
  const activateAutomation = useMutation(api.automations.index.activate);
  const pauseAutomation = useMutation(api.automations.index.pause);

  return {
    automations,
    stats,
    isLoading: automations === undefined,
    createAutomation,
    updateAutomation,
    removeAutomation,
    activateAutomation,
    pauseAutomation,
  };
}

export function useAutomation(id: Id<"automations"> | null) {
  const automation = useQuery(
    api.automations.index.get,
    id ? { id } : "skip"
  );

  const runHistory = useQuery(
    api.automations.index.getRunHistory,
    id ? { automationId: id } : "skip"
  );

  return {
    automation,
    runHistory,
    isLoading: automation === undefined,
  };
}
