import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import type { WorkflowFlowNode } from "../../lib/workflow/workflowCanvasGraph";
import type { WorkflowProviderName } from "../../lib/workflow/workflowGraph";
import type { WorkflowNodeCatalogEntry } from "../../lib/workflow/workflowNodeCatalog";
import {
  imageModelUiContractFromModel,
  modelCategoryForNodeType,
} from "../../lib/workflow/workflowModelCatalog";
import { configFieldsForNode } from "../../lib/workflow/workflowConfigFields";
import {
  modelOptionSourcesForNode,
  richModelPickerOptions,
} from "../../lib/workflow/workflowModelPickerOptions";

type ProviderCatalogName = Exclude<WorkflowProviderName, "postiz" | "post_bridge">;

function isProviderCatalogName(value?: WorkflowProviderName): value is ProviderCatalogName {
  return value === "bulkapis" || value === "gemini" || value === "fal" || value === "openrouter" || value === "manual";
}

type UseWorkflowNodeModelControlsArgs = {
  selectedNode: WorkflowFlowNode | null;
  selectedNodeDefinition: WorkflowNodeCatalogEntry | null;
};

export function useWorkflowNodeModelControls({
  selectedNode,
  selectedNodeDefinition,
}: UseWorkflowNodeModelControlsArgs) {
  const selectedNodeModelCategory = selectedNode
    ? modelCategoryForNodeType(selectedNode.data.type)
    : undefined;
  const showProviderControl = Boolean(
    selectedNodeDefinition &&
      selectedNodeDefinition.providerRequirement !== "none" &&
      !selectedNodeModelCategory &&
      selectedNode?.data.type !== "auto_post"
  );
  const showModelControl = Boolean(selectedNodeModelCategory);
  const selectedProviderCatalogName = selectedNodeModelCategory
    ? "bulkapis"
    : isProviderCatalogName(selectedNode?.data.provider)
      ? selectedNode.data.provider
      : undefined;
  const selectedProviderModels = useQuery(
    api.providers.modelCatalog.list,
    selectedProviderCatalogName
      ? {
          provider: selectedProviderCatalogName,
          ...(selectedNodeModelCategory ? { category: selectedNodeModelCategory } : {}),
        }
      : "skip"
  );
  const selectedModelOptions = useMemo(() => {
    return modelOptionSourcesForNode({
      nodeType: selectedNode?.data.type,
      providerModels: selectedProviderModels,
    });
  }, [selectedNode?.data.type, selectedProviderModels]);
  const selectedProviderModel = useMemo(
    () =>
      selectedProviderModels?.find(
        (model) => model.modelId === selectedNode?.data.model
      ) ?? null,
    [selectedNode?.data.model, selectedProviderModels]
  );
  const selectedModelPickerOptions = useMemo(() => {
    return richModelPickerOptions({
      modelOptions: selectedModelOptions,
      nodeType: selectedNode?.data.type,
      providerModels: selectedProviderModels,
      selectedModel: selectedNode?.data.model,
    });
  }, [selectedModelOptions, selectedNode, selectedProviderModels]);
  const selectedImageModelUiContract = useMemo(
    () =>
      selectedNode?.data.type === "image_generation"
        ? imageModelUiContractFromModel(selectedProviderModel)
        : null,
    [selectedNode?.data.type, selectedProviderModel]
  );
  const selectedConfigFields = useMemo(
    () =>
      selectedNode
        ? configFieldsForNode(
            selectedNode.data.type,
            selectedNode.data.config,
            selectedProviderModel,
            selectedImageModelUiContract
          )
        : [],
    [selectedImageModelUiContract, selectedNode, selectedProviderModel]
  );

  return {
    selectedConfigFields,
    selectedImageModelUiContract,
    selectedModelOptions,
    selectedModelPickerOptions,
    selectedProviderCatalogName,
    selectedProviderModel,
    selectedProviderModels,
    showModelControl,
    showProviderControl,
  };
}
