import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SlideshowGrid, ContentItem, Product } from "../features/slideshows";

interface LibraryProps {
  onNavigate: (path: string) => void;
}

export default function Library({ onNavigate }: LibraryProps) {
  const content = useQuery(api.content.list);
  const products = useQuery(api.products.list);

  // Cast to correct types
  const slideshows = content as ContentItem[] | undefined;
  const productsList = products as Product[] | undefined;

  const handleSelectSlideshow = () => {
    // Navigate to slideshows page when clicking a slideshow
    onNavigate("/slideshows");
  };

  return (
    <div>
      <div className="page-header">
        <h1>Content Library</h1>
        <p>Browse all your generated slideshows</p>
      </div>

      <SlideshowGrid
        slideshows={slideshows}
        products={productsList}
        onSelectSlideshow={handleSelectSlideshow}
        title="All Slideshows"
      />
    </div>
  );
}
