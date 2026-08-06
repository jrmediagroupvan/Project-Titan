"use client";

import { useEffect, useMemo, useState } from "react";
import { Expand, RefreshCw, X } from "lucide-react";

type BambuCameraViewerProps = {
  src: string;
  printerName: string;
};

export default function BambuCameraViewer({ src, printerName }: BambuCameraViewerProps) {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [failed, setFailed] = useState(false);

  const cameraSrc = useMemo(() => {
    if (!refreshKey) return src;
    const joiner = src.includes("?") ? "&" : "?";
    return `${src}${joiner}titanRefresh=${Date.now()}`;
  }, [src, refreshKey]);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const refresh = () => {
    setFailed(false);
    setRefreshKey((value) => value + 1);
  };

  const openViewer = () => {
    setFailed(false);
    setOpen(true);
  };

  return (
    <>
      <div className="bambuCameraFrame">
        <button
          type="button"
          className="bambuCameraButton"
          onClick={openViewer}
          aria-label={`Open ${printerName} live camera`}
        >
          <img
            key={`thumbnail-${refreshKey}`}
            src={cameraSrc}
            alt={`${printerName} live camera`}
            className="bambuCameraImage"
            onError={() => setFailed(true)}
            onLoad={() => setFailed(false)}
          />

          <span className="bambuCameraOverlay">
            <Expand size={16} aria-hidden="true" />
            Click to enlarge
          </span>
        </button>

        {failed && (
          <div className="bambuCameraError" role="status">
            <strong>Camera unavailable</strong>
            <span>Confirm the Bambu Buddy stream token and camera URL.</span>
            <button type="button" className="secondary small" onClick={refresh}>
              <RefreshCw size={14} aria-hidden="true" />
              Retry
            </button>
          </div>
        )}
      </div>

      {open && (
        <div
          className="bambuCameraModalBackdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${printerName} live camera viewer`}
          onClick={() => setOpen(false)}
        >
          <div className="bambuCameraModal" onClick={(event) => event.stopPropagation()}>
            <header className="bambuCameraModalHeader">
              <div>
                <strong>{printerName}</strong>
                <span>Live Bambu Buddy camera</span>
              </div>

              <div className="actions">
                <button type="button" className="secondary small" onClick={refresh}>
                  <RefreshCw size={15} aria-hidden="true" />
                  Refresh
                </button>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setOpen(false)}
                  aria-label="Close camera viewer"
                >
                  <X size={16} aria-hidden="true" />
                  Close
                </button>
              </div>
            </header>

            <div className="bambuCameraModalBody">
              <img
                key={`modal-${refreshKey}`}
                src={cameraSrc}
                alt={`${printerName} enlarged live camera`}
                className="bambuCameraModalImage"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
