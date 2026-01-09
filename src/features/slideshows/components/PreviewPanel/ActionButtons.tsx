import { Package } from "lucide-react";

interface ActionButtonsProps {
  onDownload: () => void;
  isDownloading: boolean;
}

export function ActionButtons({
  onDownload,
  isDownloading,
}: ActionButtonsProps) {
  return (
    <button
      className="btn btn-primary"
      onClick={onDownload}
      disabled={isDownloading}
      style={{ width: "100%" }}
    >
      {isDownloading ? (
        <>
          <span className="spinner" style={{ width: 16, height: 16 }} />
          Downloading...
        </>
      ) : (
        <>
          <Package size={16} /> Download as ZIP
        </>
      )}
    </button>
  );
}
