import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ContentItem } from "../types";
import { sanitizeForFilename } from "../utils";

export function useSlideshowDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const updateStatus = useMutation(api.content.updateStatus);

  const downloadCarousel = async (item: ContentItem) => {
    if (!item?.content?.slides) return;

    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const topic = item.inputParams?.topic || "carousel";
      const folderName = sanitizeForFilename(topic);

      // Add each slide to the zip
      for (let i = 0; i < item.content.slides.length; i++) {
        const slide = item.content.slides[i];
        if (slide.imageUrl) {
          const base64Data = slide.imageUrl.split(",")[1];
          if (base64Data) {
            zip.file(`${folderName}/slide-${i + 1}.png`, base64Data, { base64: true });
          }
        }
      }

      // Add slide texts as text file
      const slideTexts = item.content.slides
        .map((s, i) => `Slide ${i + 1}: ${s.text}`)
        .join("\n\n");
      zip.file(`${folderName}/slide-texts.txt`, slideTexts);

      // Generate and download zip
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${folderName}.zip`);

      // Update status
      await updateStatus({
        id: item._id,
        status: "downloaded",
      });
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download slides");
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    isDownloading,
    downloadCarousel,
  };
}
