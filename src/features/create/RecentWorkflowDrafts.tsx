import { Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel } from "../../components/ui";
import type { WorkflowDoc } from "../../types";

export function RecentWorkflowDrafts({ workflows }: { workflows: WorkflowDoc[] }) {
  return (
    <Panel title="Recent Workflow Drafts">
      {workflows.length === 0 ? (
        <div className="empty-state">No workflow drafts from Create yet.</div>
      ) : (
        <div className="entity-grid">
          {workflows.map((workflow) => (
            <Link
              className="entity-card workflow-card-link"
              key={workflow._id}
              to={`/workflows/${workflow._id}`}
            >
              <div className="entity-eyebrow">{workflow.isActive ? "Active" : "Draft"}</div>
              <h3>{workflow.name}</h3>
              <p>{workflow.description}</p>
              <span>{workflow.isActive ? "Active" : "Draft"}</span>
              <span className="workflow-card-action">
                <Workflow size={15} />
                Open canvas
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}
