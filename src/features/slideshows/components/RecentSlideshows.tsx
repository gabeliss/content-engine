import { Clock, Play } from "lucide-react";
import { ContentItem, Product } from "../types";
import { formatDate } from "../utils";

interface RecentSlideshowsProps {
  carousels: ContentItem[] | undefined;
  products: Product[] | undefined;
}

export function RecentSlideshows({ carousels, products }: RecentSlideshowsProps) {
  return (
    <div className="card">
      <h2>Recent Slideshows</h2>

      {!carousels || carousels.length === 0 ? (
        <div className="empty-state">
          <Clock size={32} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
          <p>No slideshows generated yet</p>
          <p style={{ fontSize: "0.875rem" }}>
            Generate your first slideshow using the form above
          </p>
        </div>
      ) : (
        <div className="content-list">
          {carousels.map((item) => {
            const product = products?.find((p) => p._id === item.productId);
            return (
              <div key={item._id} className="content-item">
                <div className="content-preview">
                  {item.content?.slides?.[0]?.imageUrl ? (
                    <img src={item.content.slides[0].imageUrl} alt="Preview" />
                  ) : (
                    <Play size={24} style={{ opacity: 0.3 }} />
                  )}
                </div>
                <div className="content-details">
                  <h4>{item.inputParams?.topic || "Untitled Slideshow"}</h4>
                  <div className="content-meta">
                    {product?.name} •{" "}
                    {item.content?.slides?.length || item.inputParams?.slideCount || 0} slides •{" "}
                    {formatDate(item.createdAt)}
                  </div>
                  <span className={`badge badge-${item.status}`}>{item.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
