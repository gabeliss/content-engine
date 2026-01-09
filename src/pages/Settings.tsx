import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Plus, Edit2, Trash2, X, Check, Package } from "lucide-react";

type Tab = "general" | "products" | "account" | "billing";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("products");

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account and application settings</p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === "general" ? "active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          General
        </button>
        <button
          className={`tab ${activeTab === "products" ? "active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          Products
        </button>
        <button
          className={`tab ${activeTab === "account" ? "active" : ""}`}
          onClick={() => setActiveTab("account")}
        >
          Account
        </button>
        <button
          className={`tab ${activeTab === "billing" ? "active" : ""}`}
          onClick={() => setActiveTab("billing")}
        >
          Billing
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "general" && <GeneralTab />}
      {activeTab === "products" && <ProductsTab />}
      {activeTab === "account" && <AccountTab />}
      {activeTab === "billing" && <BillingTab />}
    </div>
  );
}

function GeneralTab() {
  return (
    <div className="card">
      <h2>General Settings</h2>
      <div className="empty-state" style={{ padding: "3rem" }}>
        <p style={{ fontSize: "1rem", color: "#9ca3af" }}>Coming soon...</p>
      </div>
    </div>
  );
}

function ProductsTab() {
  const products = useQuery(api.products.list);
  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);
  const removeProduct = useMutation(api.products.remove);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Id<"products"> | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenModal = (productId?: Id<"products">) => {
    if (productId) {
      const product = products?.find((p) => p._id === productId);
      if (product) {
        setEditingProduct(productId);
        setFormData({
          name: product.name,
          description: product.description || "",
        });
      }
    } else {
      setEditingProduct(null);
      setFormData({ name: "", description: "" });
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({ name: "", description: "" });
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError("Product name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (editingProduct) {
        await updateProduct({
          id: editingProduct,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
      } else {
        await createProduct({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
      }
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (productId: Id<"products">) => {
    if (confirm("Are you sure you want to delete this product? This cannot be undone.")) {
      try {
        await removeProduct({ id: productId });
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete product");
      }
    }
  };

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ margin: 0 }}>Products</h2>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={16} />
            Add Product
          </button>
        </div>

        {!products || products.length === 0 ? (
          <div className="empty-state">
            <Package size={32} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
            <h3>No products yet</h3>
            <p>Products help organize your content by brand or business</p>
            <button className="btn btn-primary btn-sm" onClick={() => handleOpenModal()}>
              <Plus size={14} />
              Create First Product
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {products.map((product) => (
              <div
                key={product._id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  background: "#f9fafb",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    {product.name}
                  </div>
                  {product.description && (
                    <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                      {product.description}
                    </div>
                  )}
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                    {product.isActive ? (
                      <span className="badge badge-ready">Active</span>
                    ) : (
                      <span className="badge badge-pending">Inactive</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleOpenModal(product._id)}
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(product._id)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? "Edit Product" : "Add Product"}</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., My App, My Brand"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="textarea"
                placeholder="Brief description of your product..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseModal} disabled={isSaving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    {editingProduct ? "Update" : "Create"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AccountTab() {
  return (
    <div className="card">
      <h2>Account Settings</h2>
      <div className="empty-state" style={{ padding: "3rem" }}>
        <p style={{ fontSize: "1rem", color: "#9ca3af" }}>Coming soon...</p>
      </div>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="card">
      <h2>Billing & Subscription</h2>
      <div className="empty-state" style={{ padding: "3rem" }}>
        <p style={{ fontSize: "1rem", color: "#9ca3af" }}>Coming soon...</p>
      </div>
    </div>
  );
}
