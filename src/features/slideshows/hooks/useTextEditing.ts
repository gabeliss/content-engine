import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { TextElement } from "../types";

export function useTextEditing() {
  // Currently editing state
  const [isEditingText, setIsEditingText] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedFontSize, setEditedFontSize] = useState(48);

  const updateTextElement = useMutation(api.content.updateTextElement);
  const deleteTextElement = useMutation(api.content.deleteTextElement);

  const startEditing = (element: TextElement) => {
    setSelectedElementId(element.id);
    setEditedText(element.content);
    setEditedFontSize(element.fontSize);
    setIsEditingText(true);
  };

  const cancelEditing = () => {
    setIsEditingText(false);
    setSelectedElementId(null);
    setEditedText("");
  };

  const saveText = async (
    contentId: Id<"content">,
    slideIndex: number
  ) => {
    if (!selectedElementId) return;

    try {
      await updateTextElement({
        id: contentId,
        slideIndex,
        elementId: selectedElementId,
        updates: {
          content: editedText,
          fontSize: editedFontSize,
        },
      });

      setIsEditingText(false);
      setSelectedElementId(null);
      setEditedText("");
    } catch (error) {
      console.error("Failed to save text:", error);
      alert("Failed to save text changes");
    }
  };

  const deleteElement = async (
    contentId: Id<"content">,
    slideIndex: number
  ) => {
    if (!selectedElementId) return;

    try {
      await deleteTextElement({
        id: contentId,
        slideIndex,
        elementId: selectedElementId,
      });

      setIsEditingText(false);
      setSelectedElementId(null);
      setEditedText("");
    } catch (error) {
      console.error("Failed to delete text element:", error);
      alert("Failed to delete text element");
    }
  };

  const incrementFontSize = () => {
    setEditedFontSize((prev) => Math.min(120, prev + 4));
  };

  const decrementFontSize = () => {
    setEditedFontSize((prev) => Math.max(16, prev - 4));
  };

  return {
    isEditingText,
    selectedElementId,
    editedText,
    editedFontSize,
    setEditedText,
    startEditing,
    cancelEditing,
    saveText,
    deleteElement,
    incrementFontSize,
    decrementFontSize,
  };
}
