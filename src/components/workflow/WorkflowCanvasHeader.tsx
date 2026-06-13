import { Activity, ArrowLeft, Clock, Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { Doc } from "../../../convex/_generated/dataModel";
import { LoadingSignal } from "../ui";

type WorkflowCanvasHeaderProps = {
  canRun: boolean;
  isCreatingRun: boolean;
  isSaving: boolean;
  isUpdatingActiveState: boolean;
  onCreateManualRun: () => void;
  onToggleActive: () => void;
  onToggleExecutions: () => void;
  saveStatus: string;
  showExecutions: boolean;
  workflow: Doc<"workflows">;
};

export function WorkflowCanvasHeader({
  canRun,
  isCreatingRun,
  isSaving,
  isUpdatingActiveState,
  onCreateManualRun,
  onToggleActive,
  onToggleExecutions,
  saveStatus,
  showExecutions,
  workflow,
}: WorkflowCanvasHeaderProps) {
  return (
    <header className="workflow-canvas-header">
      <div className="workflow-canvas-title">
        <Link className="workflow-back-link" to="/workflows">
          <ArrowLeft size={16} />
          Workflows
        </Link>
        <div>
          <h1>{workflow.name}</h1>
        </div>
      </div>
      <div className="workflow-canvas-stats">
        <span>{workflow.isActive ? "Active" : "Paused"}</span>
        {workflow.nextRunAt ? (
          <span>Next {new Date(workflow.nextRunAt).toLocaleString()}</span>
        ) : null}
      </div>
      <div className="workflow-canvas-actions">
        {isSaving ? (
          <span>
            <LoadingSignal label="Autosaving" size="sm" />
            Autosaving
          </span>
        ) : saveStatus ? (
          <span>{saveStatus}</span>
        ) : null}
        <button
          className={`secondary-button${showExecutions ? " workflow-toolbar-button-active" : ""}`}
          onClick={onToggleExecutions}
          type="button"
        >
          <Activity size={16} />
          Executions
        </button>
        <button
          className="secondary-button"
          disabled={isCreatingRun || isSaving || !canRun}
          onClick={onCreateManualRun}
          type="button"
        >
          {isCreatingRun ? <LoadingSignal label="Queueing" size="sm" /> : <Play size={16} />}
          {isCreatingRun ? "Queueing" : "Run once"}
        </button>
        <button
          className="secondary-button"
          disabled={isUpdatingActiveState || isSaving}
          onClick={onToggleActive}
          type="button"
        >
          <Clock size={16} />
          {workflow.isActive ? "Pause" : "Activate"}
        </button>
      </div>
    </header>
  );
}
