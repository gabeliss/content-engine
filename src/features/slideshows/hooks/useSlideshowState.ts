import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ContentItem, Product, AspectRatio } from "../types";

export function useSlideshowState() {
  const [selectedProduct, setSelectedProduct] = useState<Id<"products"> | "">("");
  const [selectedCarousel, setSelectedCarousel] = useState<Id<"content"> | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [showRatioMenu, setShowRatioMenu] = useState(false);

  // Queries
  const products = useQuery(api.products.listActive);
  const content = useQuery(api.content.list);
  const carouselsByProduct = useQuery(
    api.content.listByProduct,
    selectedProduct ? { productId: selectedProduct as Id<"products"> } : "skip"
  );

  // Mutations
  const toggleSlideOverlay = useMutation(api.content.toggleSlideOverlay);
  const updateAspectRatio = useMutation(api.content.updateAspectRatio);

  // Derived state
  const allCarousels = content
    ?.filter((item) => item.content?.type === "carousel")
    ?.sort((a, b) => b.createdAt - a.createdAt) as ContentItem[] | undefined;

  const filteredCarousels = selectedProduct
    ? (carouselsByProduct
        ?.filter((item) => item.content?.type === "carousel")
        ?.sort((a, b) => b.createdAt - a.createdAt) as ContentItem[] | undefined)
    : allCarousels;

  const selectedCarouselItem = selectedCarousel
    ? filteredCarousels?.find((c) => c._id === selectedCarousel)
    : filteredCarousels?.[0];

  // Auto-select most recent carousel when data changes
  useEffect(() => {
    if (filteredCarousels?.[0]) {
      setSelectedCarousel(filteredCarousels[0]._id);
      setSelectedSlideIndex(0);
    } else {
      setSelectedCarousel(null);
      setSelectedSlideIndex(0);
    }
  }, [selectedProduct, filteredCarousels?.[0]?._id]);

  // Actions
  const handleToggleOverlay = async () => {
    if (selectedCarousel) {
      await toggleSlideOverlay({
        id: selectedCarousel,
        slideIndex: selectedSlideIndex,
      });
    }
  };

  const handleChangeRatio = async (ratio: AspectRatio) => {
    if (selectedCarousel) {
      await updateAspectRatio({
        id: selectedCarousel,
        aspectRatio: ratio,
      });
      setShowRatioMenu(false);
    }
  };

  return {
    // State
    selectedProduct,
    setSelectedProduct,
    selectedCarousel,
    setSelectedCarousel,
    selectedSlideIndex,
    setSelectedSlideIndex,
    showRatioMenu,
    setShowRatioMenu,

    // Data
    products: products as Product[] | undefined,
    allCarousels,
    filteredCarousels,
    selectedCarouselItem,

    // Actions
    handleToggleOverlay,
    handleChangeRatio,
  };
}
