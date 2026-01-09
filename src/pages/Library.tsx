import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SlideshowGrid, ContentItem, Product } from "../features/slideshows";

export default function Library() {
  const exported = useQuery(api.content.listExported);
  const products = useQuery(api.products.list);

  // Cast to correct types
  const exportedSlideshows = exported as ContentItem[] | undefined;
  const productsList = products as Product[] | undefined;

  return (
    <div>
      <div className="page-header">
        <h1>Content Library</h1>
        <p>View and manage your exported content</p>
      </div>

      <SlideshowGrid
        slideshows={exportedSlideshows}
        products={productsList}
        onSelectDraft={() => {}} // No-op since Library only shows exported
        showTabs={false}
        defaultTab="exported"
        title="Exported Slideshows"
      />
    </div>
  );
}
