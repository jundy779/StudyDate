"use client";

import {
  checkInCampusEventTicketAction,
  manualCheckInCampusEventRegistrationAction,
} from "@/app/app/events/actions";
import type { EventCheckinStatus } from "@/lib/events/constants";
import type { CampusEventAttendee } from "@/lib/events/service";
import {
  BrowserQRCodeReader,
  type IScannerControls,
} from "@zxing/browser";
import { Camera, CameraOff, RefreshCw, SwitchCamera } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CameraState =
  | "starting"
  | "ready"
  | "paused"
  | "permission_denied"
  | "no_camera"
  | "error";

type Feedback = {
  status: EventCheckinStatus;
  message: string;
};

function scanMessage(
  status: EventCheckinStatus,
  attendeeAlias: string | null,
) {
  const alias = attendeeAlias ? ` ${attendeeAlias}` : "";
  switch (status) {
    case "checked_in":
      return `Kehadiran berhasil dicatat.${alias}`;
    case "duplicate":
      return `Tiket sudah pernah digunakan.${alias}`;
    case "wrong_event":
      return "QR ini diterbitkan untuk acara lain.";
    case "invalid":
      return "QR bukan tiket StudyDate yang valid.";
    case "revoked":
      return "Tiket ini sudah dicabut dan tidak berlaku.";
    case "not_eligible":
      return "Peserta tidak memiliki pendaftaran aktif, sehingga kehadirannya belum dapat dicatat.";
    case "outside_window":
      return "Pencatatan kehadiran belum dibuka atau waktunya sudah berakhir.";
    case "rate_limited":
      return "Pemindaian terlalu cepat. Tunggu sebentar lalu coba lagi.";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function cameraMessage(state: CameraState) {
  switch (state) {
    case "starting":
      return "Menyiapkan kamera…";
    case "ready":
      return "Kamera aktif. Arahkan ke QR tiket peserta.";
    case "paused":
      return "Kamera dijeda saat hasil diproses.";
    case "permission_denied":
      return "Akses kamera ditolak. Izinkan kamera di pengaturan browser lalu coba lagi.";
    case "no_camera":
      return "Kamera tidak ditemukan pada perangkat ini. Catat kehadiran dari daftar peserta.";
    case "error":
      return "Kamera belum dapat digunakan. Tutup aplikasi kamera lain lalu coba lagi.";
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

export function EventQrScanner({
  publicSlug,
  attendees,
}: {
  publicSlug: string;
  attendees: CampusEventAttendee[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedDeviceRef = useRef("");
  const restartScannerRef = useRef<() => void>(() => undefined);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [manualPending, setManualPending] = useState(false);

  function stopScanner() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const video = videoRef.current;
    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
  }

  async function handleScan(rawValue: string, controls: IScannerControls) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    controlsRef.current = controls;
    stopScanner();
    setCameraState("paused");

    const formData = new FormData();
    formData.set("publicSlug", publicSlug);
    formData.set("ticketToken", rawValue);
    try {
      const result = await checkInCampusEventTicketAction(formData);
      if (!mountedRef.current) return;
      setFeedback({
        status: result.status,
        message:
          result.message ?? scanMessage(result.status, result.attendeeAlias),
      });
    } catch {
      if (!mountedRef.current) return;
      setFeedback({
        status: "invalid",
        message: "Kehadiran belum dapat dicatat. Coba lagi.",
      });
    } finally {
      cooldownRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        inFlightRef.current = false;
        restartScannerRef.current();
      }, 1200);
    }
  }

  async function startScanner(deviceId?: string) {
    if (!mountedRef.current || !videoRef.current) return;
    if (cooldownRef.current) {
      clearTimeout(cooldownRef.current);
      cooldownRef.current = null;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("no_camera");
      return;
    }
    stopScanner();
    setCameraState("starting");
    const reader = readerRef.current ?? new BrowserQRCodeReader();
    readerRef.current = reader;
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: "environment" } },
    };

    try {
      const controls = await reader.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, _error, callbackControls) => {
          if (result) void handleScan(result.getText(), callbackControls);
        },
      );
      if (!mountedRef.current || inFlightRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setCameraState("ready");
      const cameras = await BrowserQRCodeReader.listVideoInputDevices();
      if (mountedRef.current) {
        setDevices(cameras);
        const activeId =
          deviceId ||
          (videoRef.current?.srcObject instanceof MediaStream
            ? videoRef.current.srcObject.getVideoTracks()[0]?.getSettings().deviceId
            : "") ||
          "";
        selectedDeviceRef.current = activeId;
        setSelectedDevice(activeId);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraState("permission_denied");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCameraState("no_camera");
      } else {
        setCameraState("error");
      }
    }
  }
  useEffect(() => {
    mountedRef.current = true;
    void startScanner();
    restartScannerRef.current = () => {
      void startScanner(selectedDeviceRef.current || undefined);
    };
    return () => {
      mountedRef.current = false;
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
      stopScanner();
    };
    // Scanner ownership and restart callback are intentionally bound to mount/unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleManualCheckIn(formData: FormData) {
    if (manualPending) return;
    setManualPending(true);
    try {
      const result = await manualCheckInCampusEventRegistrationAction(formData);
      setFeedback({
        status: result.status,
        message:
          result.message ?? scanMessage(result.status, result.attendeeAlias),
      });
    } finally {
      setManualPending(false);
    }
  }

  const isSuccess = feedback?.status === "checked_in";
  const availableManualAttendees = attendees.filter(
    (attendee) =>
      attendee.registration_status === "going" && !attendee.checked_in_at,
  );

  return (
    <div className="space-y-5">
      <section aria-labelledby="camera-preview-title">
        <div className="overflow-hidden rounded-[22px] border border-brand-border bg-brand-navy">
          <div className="relative aspect-[3/4] max-h-[68svh] min-h-80 bg-black sm:aspect-[4/3]">
            <video
              ref={videoRef}
              muted
              playsInline
              aria-labelledby="camera-preview-title"
              aria-describedby="camera-instructions"
              className="h-full w-full object-cover"
            />
            {cameraState !== "ready" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand-navy px-6 text-center text-white">
                {cameraState === "starting" || cameraState === "paused" ? (
                  <Camera className="h-9 w-9" aria-hidden="true" />
                ) : (
                  <CameraOff className="h-9 w-9" aria-hidden="true" />
                )}
                <p className="mt-4 max-w-sm text-sm leading-6">
                  {cameraMessage(cameraState)}
                </p>
              </div>
            ) : null}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-2 border-white shadow-[0_0_0_999px_rgba(15,27,51,0.34)]"
            />
          </div>
          <div className="px-5 py-4 text-white">
            <h2 id="camera-preview-title" className="font-heading text-lg font-semibold">
              Kamera pemindai QR
            </h2>
            <p
              id="camera-instructions"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="mt-1 text-sm leading-6 text-blue-100"
            >
              {cameraMessage(cameraState)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {devices.length > 1 ? (
            <label className="text-sm font-semibold text-brand-navy">
              Kamera
              <span className="relative mt-2 block">
                <SwitchCamera
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
                  aria-hidden="true"
                />
                <select
                  value={selectedDevice}
                  onChange={(event) => {
                    const deviceId = event.target.value;
                    selectedDeviceRef.current = deviceId;
                    setSelectedDevice(deviceId);
                    inFlightRef.current = false;
                    void startScanner(deviceId);
                  }}
                  className="focus-ring min-h-12 w-full rounded-xl border border-brand-border bg-white pl-12 pr-4 text-sm"
                >
                  {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Kamera ${index + 1}`}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          ) : null}
          {cameraState !== "ready" && cameraState !== "paused" ? (
            <button
              type="button"
              onClick={() =>
                void startScanner(selectedDeviceRef.current || undefined)
              }
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-navy px-5 text-sm font-semibold text-brand-navy sm:self-end"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Coba kamera lagi
            </button>
          ) : null}
        </div>
      </section>

      <div
        aria-live={isSuccess ? "assertive" : "polite"}
        aria-atomic="true"
        className={`min-h-16 rounded-xl border px-4 py-3 text-sm font-semibold leading-6 ${
          feedback
            ? isSuccess
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-amber-300 bg-amber-50 text-amber-950"
            : "border-brand-border bg-white text-brand-muted"
        }`}
      >
        {feedback?.message ?? "Hasil pemindaian akan diumumkan di sini."}
      </div>

      <details className="rounded-xl border border-brand-border bg-white p-4">
        <summary className="focus-ring cursor-pointer rounded-lg text-sm font-semibold text-brand-navy">
          Catat kehadiran tanpa kamera
        </summary>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          Gunakan alias peserta hanya jika QR tidak dapat dipindai.
        </p>
        {availableManualAttendees.length ? (
          <form action={handleManualCheckIn} className="mt-4">
            <input type="hidden" name="publicSlug" value={publicSlug} />
            <label className="text-sm font-semibold text-brand-navy">
              Peserta terdaftar
              <select
                name="registrationPublicId"
                required
                className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm"
              >
                <option value="">Pilih alias peserta</option>
                {availableManualAttendees.map((attendee) => (
                  <option
                    key={attendee.registration_public_id}
                    value={attendee.registration_public_id}
                  >
                    {attendee.public_alias}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={manualPending}
              className="focus-ring mt-3 min-h-12 w-full rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {manualPending ? "Memproses…" : "Catat kehadiran"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-brand-muted">
            Semua peserta aktif yang tampil sudah tercatat hadir.
          </p>
        )}
      </details>
    </div>
  );
}
