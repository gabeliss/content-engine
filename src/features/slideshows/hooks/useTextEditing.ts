import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ContentItem } from "../types";

export function useTextEditing() {
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [editedFontSize, setEditedFontSize] = useState(48);

  const updateSlide = useMutation(api.content.updateSlide);
  const updateFontSize = useMutation(api.content.updateFontSize);

  const startEditing = (currentText: string, currentFontSize: number) => {
    setEditedText(currentText);
    setEditedFontSize(currentFontSize);
    setIsEditingText(true);
  };

  const cancelEditing = () => {
    setIsEditingText(false);
    setEditedText("");
  };

  const saveText = async (
    contentId: Id<"content">,
    slideIndex: number,
    currentSlide: { text: string; imageUrl: string; overlay?: boolean },
    currentFontSize: number
  ) => {
    try {
      const slideUpdate: { text: string; imageUrl: string; overlay?: boolean } = {
        text: editedText,
        imageUrl: currentSlide.imageUrl,
      };

      if (currentSlide.overlay !== undefined) {
        slideUpdate.overlay = currentSlide.overlay;
      }

      await updateSlide({
        id: contentId,
        slideIndex,
        slide: slideUpdate,
      });

      if (editedFontSize !== currentFontSize) {
        await updateFontSize({
          id: contentId,
          fontSize: editedFontSize,
        });
      }

      setIsEditingText(false);
      setEditedText("");
    } catch (error) {
      console.error("Failed to save text:", error);
      alert("Failed to save text changes");
    }
  };

  const deleteText = async (
    contentId: Id<"content">,
    slideIndex: number,
    currentSlide: { text: string; imageUrl: string; overlay?: boolean }
  ) => {
    await updateSlide({
      id: contentId,
      slideIndex,
      slide: {
        ...currentSlide,
        text: "",
      },
    });
    setIsEditingText(false);
  };

  const incrementFontSize = () => {
    setEditedFontSize((prev) => Math.min(72, prev + 4));
  };

  const decrementFontSize = () => {
    setEditedFontSize((prev) => Math.max(24, prev - 4));
  };

  return {
    isEditingText,
    editedText,
    editedFontSize,
    setEditedText,
    startEditing,
    cancelEditing,
    saveText,
    deleteText,
    incrementFontSize,
    decrementFontSize,
  };
}
