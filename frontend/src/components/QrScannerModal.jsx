import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "./index";
import { useI18n } from "../context/I18nContext";

const VIDEO_ELEMENT_ID = "qr-scanner-video";

const QrScannerModal = ({ title = "Scan QR Code", statusText, onScan, onClose }) => {
  const { t } = useI18n();
  const scannerRef = useRef(null);
  const mountedRef = useRef(true);
  const lastScannedRef = useRef({ text: null, at: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [cameraError, setCameraError] = useState(null);
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    mountedRef.current = true;

    let scanner = null;

    const startCamera = async () => {
      try {
        // html5-qrcode requires the id of a DOM element to render into, not the
        // element itself — passing a ref here makes the constructor throw
        // "HTML Element with id=... not found".
        if (!document.getElementById(VIDEO_ELEMENT_ID)) return;
        scanner = new Html5Qrcode(VIDEO_ELEMENT_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (!mountedRef.current) return;
            const now = Date.now();
            const last = lastScannedRef.current;
            if (last.text === decodedText && now - last.at < 1500) return;
            lastScannedRef.current = { text: decodedText, at: now };
            if (onScanRef.current) onScanRef.current(decodedText);
          },
          () => {}
        );
        setIsStarting(false);
      } catch (err) {
        console.error("QR camera failed to start:", err);
        setCameraError(
          err && err.name
            ? t("scanner.permissionError", { error: err.name })
            : t("scanner.permissionGeneric")
        );
        setIsStarting(false);
      }
    };

    startCamera();

    return () => {
      mountedRef.current = false;
      if (scanner) {
        try {
          scanner
            .stop()
            .catch(() => {})
            .finally(() => {
              try {
                scanner.clear();
              } catch (err) {
                /* ignore cleanup errors */
              }
            });
        } catch (err) {
          try {
            scanner.clear();
          } catch (err2) {
            /* ignore cleanup errors */
          }
        }
      }
      scannerRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            title={t("scanner.close")}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none focus:outline-none"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          {cameraError ? (
            <div
              role="alert"
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md"
            >
              <span className="font-medium">{cameraError}</span>
              <p className="text-xs mt-1">
                {t("scanner.permissionHint")}
              </p>
            </div>
          ) : (
            <>
              <div className="w-full h-64 bg-black rounded-md overflow-hidden">
                <div id={VIDEO_ELEMENT_ID} className="w-full h-full" />
              </div>
              {isStarting && (
                <p className="text-sm text-gray-500 mt-2">
                  {t("scanner.starting")}
                </p>
              )}
            </>
          )}

          {statusText && (
            <div
              role="alert"
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mt-3 text-sm"
            >
              <span className="font-medium">{statusText}</span>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3">{t("scanner.formatHint")}</p>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <Button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QrScannerModal;