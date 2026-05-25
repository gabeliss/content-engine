import { useMutation, useQuery } from "convex/react";
import { Plus, Workflow } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Field, FormPanel, Page, Select } from "../components/ui";
import { createStarterWorkflowGraph } from "../lib/workflowGraph";
import type { BrandId, ContentFormat, SocialAccountId } from "../types";

export function WorkflowsPage() {
  const brands = useQuery(api.accounts.brands.list);
  const accounts = useQuery(api.accounts.socialAccounts.list);
  const workflows = useQuery(api.workflows.definitions.list);
  const createWorkflow = useMutation(api.workflows.definitions.create);
  const [brandId, setBrandId] = useState("");
  const [socialAccountId, setSocialAccountId] = useState("");
  const [name, setName] = useState("");
  const [contentFormat, setContentFormat] = useState<ContentFormat>("slideshow");

  const brandAccounts = useMemo(
    () =>
      accounts?.filter((account) => !brandId || account.brandId === brandId) ?? [],
    [accounts, brandId]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!brandId || !name.trim()) return;

    await createWorkflow({
      brandId: brandId as BrandId,
      socialAccountId: socialAccountId ? (socialAccountId as SocialAccountId) : undefined,
      name: name.trim(),
      contentFormat,
      trigger: "manual",
      approvalPolicy: { mode: "always" },
      publishingPolicy: {
        provider: "postiz",
        autoPublish: false,
        defaultPlatforms: ["tiktok"],
      },
      graph: createStarterWorkflowGraph(),
    });
    setName("");
  };

  return (
    <Page title="Workflows" description="Repeatable agent pipelines for each brand/account.">
      <FormPanel title="Create Workflow" onSubmit={handleSubmit}>
        <Select label="Brand" value={brandId} onChange={setBrandId}>
          <option value="">Select brand</option>
          {brands?.map((brand) => (
            <option key={brand._id} value={brand._id}>
              {brand.name}
            </option>
          ))}
        </Select>
        <Select label="Account" value={socialAccountId} onChange={setSocialAccountId}>
          <option value="">No account yet</option>
          {brandAccounts.map((account) => (
            <option key={account._id} value={account._id}>
              {account.username}
            </option>
          ))}
        </Select>
        <Select
          label="Format"
          value={contentFormat}
          onChange={(value) => setContentFormat(value as ContentFormat)}
        >
          <option value="slideshow">Slideshow</option>
          <option value="hook_demo_video">Hook/demo video</option>
          <option value="ai_ugc_video">AI UGC video</option>
        </Select>
        <Field label="Name" value={name} onChange={setName} placeholder="Daily slideshow test" />
        <button className="primary-button" type="submit">
          <Plus size={16} />
          Create workflow
        </button>
      </FormPanel>

      {!workflows && <div className="empty-state">Loading...</div>}
      {workflows?.length === 0 && <div className="empty-state">No workflows yet.</div>}
      <div className="entity-grid">
        {workflows?.map((workflow) => (
          <Link className="entity-card workflow-card-link" key={workflow._id} to={`/workflows/${workflow._id}`}>
            <div className="entity-eyebrow">{workflow.contentFormat}</div>
            <h3>{workflow.name}</h3>
            <p>
              {workflow.description ||
                `${workflow.trigger} trigger with ${workflow.publishingPolicy.provider} publishing`}
            </p>
            <span>{workflow.isActive ? "Active" : "Paused"}</span>
            <span className="workflow-card-action">
              <Workflow size={15} />
              Open canvas
            </span>
          </Link>
        ))}
      </div>
    </Page>
  );
}
