import {
  GenerationForm,
  PreviewPanel,
  RecentSlideshows,
  useSlideshowGeneration,
  useSlideshowDownload,
  useTextEditing,
  useSlideshowState,
} from "../features/slideshows";

export default function Slideshows() {
  // State management
  const state = useSlideshowState();
  const generation = useSlideshowGeneration();
  const download = useSlideshowDownload();
  const textEditing = useTextEditing();

  // Handle generation
  const handleGenerate = () => {
    generation.generate(state.selectedProduct || undefined);
  };

  // Handle text editing
  const handleStartTextEdit = () => {
    if (!state.selectedCarouselItem?.content?.slides?.[state.selectedSlideIndex]) return;
    const currentSlide = state.selectedCarouselItem.content.slides[state.selectedSlideIndex];
    const currentFontSize = state.selectedCarouselItem.content.config?.fontSize || 48;
    textEditing.startEditing(currentSlide.text || "", currentFontSize);
  };

  const handleSaveTextEdit = async () => {
    if (!state.selectedCarousel || !state.selectedCarouselItem?.content?.slides?.[state.selectedSlideIndex]) return;
    const currentSlide = state.selectedCarouselItem.content.slides[state.selectedSlideIndex];
    const currentFontSize = state.selectedCarouselItem.content.config?.fontSize || 48;
    await textEditing.saveText(
      state.selectedCarousel,
      state.selectedSlideIndex,
      currentSlide,
      currentFontSize
    );
  };

  const handleDeleteText = async () => {
    if (!state.selectedCarousel || !state.selectedCarouselItem?.content?.slides?.[state.selectedSlideIndex]) return;
    const currentSlide = state.selectedCarouselItem.content.slides[state.selectedSlideIndex];
    await textEditing.deleteText(state.selectedCarousel, state.selectedSlideIndex, currentSlide);
  };

  // Handle download
  const handleDownload = () => {
    if (state.selectedCarouselItem) {
      download.downloadCarousel(state.selectedCarouselItem);
    }
  };

  return (
    <div>
      {/* Top Section: Grid with Generation Form + Preview Panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "400px 1fr",
          gap: "1.5rem",
          marginBottom: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Generation Form */}
        <GenerationForm
          products={state.products}
          selectedProduct={state.selectedProduct}
          onProductChange={state.setSelectedProduct}
          prompt={generation.prompt}
          onPromptChange={generation.setPrompt}
          isGenerating={generation.isGenerating}
          error={generation.error}
          onGenerate={handleGenerate}
        />

        {/* Right Column: Preview Panel */}
        <PreviewPanel
          selectedCarouselItem={state.selectedCarouselItem}
          selectedSlideIndex={state.selectedSlideIndex}
          onSelectSlide={state.setSelectedSlideIndex}
          isEditingText={textEditing.isEditingText}
          editedText={textEditing.editedText}
          editedFontSize={textEditing.editedFontSize}
          onTextChange={textEditing.setEditedText}
          onStartTextEdit={handleStartTextEdit}
          onCancelTextEdit={textEditing.cancelEditing}
          onSaveTextEdit={handleSaveTextEdit}
          onDeleteText={handleDeleteText}
          onIncrementFontSize={textEditing.incrementFontSize}
          onDecrementFontSize={textEditing.decrementFontSize}
          onToggleOverlay={state.handleToggleOverlay}
          showRatioMenu={state.showRatioMenu}
          onToggleRatioMenu={() => state.setShowRatioMenu(!state.showRatioMenu)}
          onChangeRatio={state.handleChangeRatio}
          onDownload={handleDownload}
          isDownloading={download.isDownloading}
        />
      </div>

      {/* Bottom Section: Recent Slideshows */}
      <RecentSlideshows carousels={state.recentCarousels} products={state.products} />
    </div>
  );
}
