import type { WorkflowSelectOption } from "../../components/workflow/WorkflowSelect";
import type { WorkflowNodeType } from "./workflowGraph";
import type { ProviderModelDoc } from "./workflowModelCatalog";
import {
  providerModelCapabilityTags,
  providerModelSourceLabel,
  recommendationMapForNodeType,
} from "./workflowModelCatalog";

export const BULKAPIS_IMAGE_MODEL_FALLBACKS = [
  { modelId: "nano-banana-2", displayName: "Nano Banana 2" },
  { modelId: "nano-banana-pro", displayName: "Nano Banana Pro" },
  { modelId: "nano-banana-edit", displayName: "Nano Banana Edit" },
  { modelId: "seedream-4.5", displayName: "Seedream 4.5" },
  { modelId: "gpt-image-2", displayName: "GPT Image 2" },
  { modelId: "gpt-image-2-edit", displayName: "GPT Image 2 Edit" },
  { modelId: "gpt-image-1.5", displayName: "GPT Image 1.5" },
  { modelId: "flux-2-pro", displayName: "Flux-2 Pro" },
];

export type WorkflowModelOptionSource = {
  modelId: string;
  displayName: string;
};

export function modelOptionSourcesForNode(args: {
  nodeType?: WorkflowNodeType;
  providerModels?: ProviderModelDoc[];
}): WorkflowModelOptionSource[] {
  if (args.nodeType === "image_generation" && !args.providerModels?.length) {
    return BULKAPIS_IMAGE_MODEL_FALLBACKS;
  }

  return (args.providerModels ?? []).map((model) => ({
    modelId: model.modelId,
    displayName: model.displayName,
  }));
}

export function richModelPickerOptions(args: {
  modelOptions: WorkflowModelOptionSource[];
  nodeType?: WorkflowNodeType;
  providerModels?: ProviderModelDoc[];
  selectedModel?: string;
}): WorkflowSelectOption[] {
  const options = args.modelOptions.map((model) => {
    const modelDoc = args.providerModels?.find(
      (providerModel) => providerModel.modelId === model.modelId
    );
    const recommendation = args.nodeType
      ? recommendationMapForNodeType(args.nodeType)?.[model.modelId]
      : undefined;

    return {
      value: model.modelId,
      label: model.displayName,
      description: recommendation?.note ?? modelDoc?.description,
      meta: providerModelSourceLabel(modelDoc),
      recommendationTag: recommendation?.tag,
      tags: providerModelCapabilityTags(modelDoc, args.nodeType),
      rank: recommendation?.rank ?? 1000,
    };
  }).sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.label.localeCompare(b.label);
  });

  if (
    args.selectedModel &&
    !options.some((option) => option.value === args.selectedModel)
  ) {
    options.unshift({
      value: args.selectedModel,
      label: args.selectedModel,
      description: "This model is saved but is not in the current catalog.",
      tags: ["Saved model"],
      rank: 0,
    });
  }

  return options;
}
