import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { AlertTriangle, Camera, CheckCircle2, Clock3, ScanLine, Square, Upload } from 'lucide-react';

import styles from './QRScannerPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const API_BASE_URL = 'http://localhost:8081/api/bookings';
const SCAN_INTERVAL_MS = 300;
const CAMERA_READY_MESSAGE = 'Start the scanner to begin live QR detection.';
const SUCCESS_MESSAGE = 'Check-in successful';
const INVALID_QR_MESSAGE = 'Invalid QR \u274C';

function isJsonLike(value) {
  const trimmedValue = String(value ?? '').trim();
  return trimmedValue.startsWith('{') || trimmedValue.startsWith('[');
}

function formatCheckinTime(value) {
  if (!value) {
    return '--:--';
  }

  if (value.includes('T')) {
    const dateValue = new Date(value);
    if (!Number.isNaN(dateValue.getTime())) {
      return dateValue.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    return value.split('T')[1]?.slice(0, 5) ?? value;
  }

  return value.slice(0, 5);
}

export default function QRScannerPage({ onCheckinSuccess = () => {} }) {
  const [scannedCode, setScannedCode] = useState('');
  const [scannerState, setScannerState] = useState(null);
  const [bookingInfo, setBookingInfo] = useState(null);
  const [checkinResult, setCheckinResult] = useState(null);
  const [verifiedBookingCandidates, setVerifiedBookingCandidates] = useState([]);
  const [resultMessage, setResultMessage] = useState('');
  const [checkinStats, setCheckinStats] = useState({ total: 0, valid: 0, invalid: 0 });
  const [manualCode, setManualCode] = useState('');
  const [cameraState, setCameraState] = useState('idle');
  const [cameraMessage, setCameraMessage] = useState(CAMERA_READY_MESSAGE);
  const [scanError, setScanError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameCanvasRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const detectorRef = useRef(null);
  const isVerifyingRef = useRef(false);
  const lastProcessedValueRef = useRef('');

  const stopDetectionLoop = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  const stopCamera = () => {
    stopDetectionLoop();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraState('stopped');
    setCameraMessage('Scanner stopped. Start again when you are ready to scan another code.');
  };

  const resetScannerResult = () => {
    setScannerState(null);
    setBookingInfo(null);
    setCheckinResult(null);
    setVerifiedBookingCandidates([]);
    setResultMessage('');
    setScanError('');
    setScannedCode('');
  };

  const incrementInvalidScan = () => {
    setCheckinStats((current) => ({
      total: current.total + 1,
      valid: current.valid,
      invalid: current.invalid + 1,
    }));
  };

  const resetForRescan = () => {
    lastProcessedValueRef.current = '';
    isVerifyingRef.current = false;
    setIsVerifying(false);
    resetScannerResult();
    setCameraMessage(streamRef.current ? 'Scanner resumed. Point the camera at a QR code.' : CAMERA_READY_MESSAGE);
  };

  const resolveBookingCandidates = (rawValue) => {
    const trimmedValue = String(rawValue ?? '').trim();
    if (!trimmedValue) {
      throw new Error(INVALID_QR_MESSAGE);
    }

    if (isJsonLike(trimmedValue)) {
      let parsedValue;

      try {
        parsedValue = JSON.parse(trimmedValue);
      } catch {
        throw new Error(INVALID_QR_MESSAGE);
      }

      const bookingId = parsedValue?.bookingId;
      if (bookingId === undefined || bookingId === null || String(bookingId).trim() === '') {
        throw new Error(INVALID_QR_MESSAGE);
      }

      const normalizedBookingId = String(bookingId).trim();
      return [...new Set([normalizedBookingId, normalizedBookingId.replace(/^bk-/, '')].filter(Boolean))];
    }

    return [...new Set([trimmedValue, trimmedValue.replace(/^bk-/, '')].filter(Boolean))];
  };

  const loadCheckinStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/checkin-stats`);
      if (!response.ok) {
        throw new Error('Could not load check-in stats.');
      }

      const stats = await response.json();
      setCheckinStats({
        total: Number(stats.total ?? 0),
        valid: Number(stats.valid ?? 0),
        invalid: Number(stats.invalid ?? 0),
      });
    } catch {
      setCheckinStats({ total: 0, valid: 0, invalid: 0 });
    }
  };

  const fetchBookingDetails = async (candidateIds) => {
    for (const bookingId of candidateIds) {
      try {
        const response = await fetch(`${API_BASE_URL}/${bookingId}/scanner-details`);
        if (!response.ok) {
          continue;
        }

        return await response.json();
      } catch {
        // Try the next candidate.
      }
    }

    return null;
  };

  const validateCheckin = async (candidateIds) => {
    let lastPayload = { message: INVALID_QR_MESSAGE };

    for (const bookingId of candidateIds) {
      const response = await fetch(`${API_BASE_URL}/checkin/${bookingId}`, {
        method: 'POST',
      });

      const payload = await response.json();
      lastPayload = payload;

      if ((payload?.message ?? '') !== INVALID_QR_MESSAGE) {
        return { bookingId, payload };
      }
    }

    return { bookingId: candidateIds[0] ?? '', payload: lastPayload };
  };

  const drawSourceToCanvas = (source, width, height) => {
    const canvas = frameCanvasRef.current ?? document.createElement('canvas');
    frameCanvasRef.current = canvas;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || !canvas.width || !canvas.height) {
      throw new Error('Could not prepare an image frame for QR scanning.');
    }

    context.drawImage(source, 0, 0, width, height);
    return canvas;
  };

  const decodeWithJsQr = (canvas) => {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const decodedValue = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });

    return decodedValue?.data ?? null;
  };

  const decodeFromVideoFrame = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return null;
    }

    if (detectorRef.current) {
      const codes = await detectorRef.current.detect(video);
      if (codes[0]?.rawValue) {
        return codes[0].rawValue;
      }
    }

    const canvas = drawSourceToCanvas(video, video.videoWidth, video.videoHeight);
    return decodeWithJsQr(canvas);
  };

  const decodeFromUploadedFile = async (file) => {
    if (detectorRef.current && typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);

      try {
        const codes = await detectorRef.current.detect(bitmap);
        if (codes[0]?.rawValue) {
          return codes[0].rawValue;
        }
      } finally {
        bitmap.close?.();
      }
    }

    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error('Could not read the uploaded image.'));
        nextImage.src = imageUrl;
      });

      const canvas = drawSourceToCanvas(
        image,
        image.naturalWidth || image.width,
        image.naturalHeight || image.height,
      );
      return decodeWithJsQr(canvas);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const verifyScannedValue = async (rawValue) => {
    console.log('Scanned QR raw value:', rawValue);
    setScanError('');
    setResultMessage('');
    setBookingInfo(null);
    setCheckinResult(null);
    setVerifiedBookingCandidates([]);
    setIsVerifying(true);
    isVerifyingRef.current = true;

    try {
      const bookingCandidates = resolveBookingCandidates(rawValue);
      const primaryCandidate = bookingCandidates[0]?.replace(/^bk-/, '') ?? 'Unknown';
      setScannedCode(`Booking ID: ${primaryCandidate}`);
      const details = await fetchBookingDetails(bookingCandidates);

      if (details?.valid) {
        setScannerState('valid');
        setBookingInfo(details);
        setVerifiedBookingCandidates(bookingCandidates);
        setResultMessage('QR verified. Click Check In to continue.');
        setCameraMessage('QR verified. Click Check In to continue.');
        stopDetectionLoop();
        return;
      }

      const message = details ? 'Booking not approved \u274C' : INVALID_QR_MESSAGE;
      setScannerState('invalid');
      setBookingInfo(details);
      setScanError(message);
      setResultMessage(message);
      setCameraMessage(message);
      lastProcessedValueRef.current = '';
      incrementInvalidScan();
    } catch (error) {
      const nextMessage = error.message || INVALID_QR_MESSAGE;
      setScannerState('invalid');
      setScanError(nextMessage);
      setResultMessage(nextMessage);
      setCameraMessage(nextMessage);
      setCheckinResult(null);
      lastProcessedValueRef.current = '';
      incrementInvalidScan();
    } finally {
      setIsVerifying(false);
      isVerifyingRef.current = false;
    }
  };

  const handleCheckIn = async () => {
    if (!verifiedBookingCandidates.length || isCheckingIn) {
      return;
    }

    setIsCheckingIn(true);
    setScanError('');
    setResultMessage('');

    try {
      const { bookingId, payload } = await validateCheckin(verifiedBookingCandidates);
      const message = payload?.message || INVALID_QR_MESSAGE;

      setCheckinResult(payload);
      setResultMessage(message);
      setCameraMessage(message);

      if (message === SUCCESS_MESSAGE) {
        const details = await fetchBookingDetails([bookingId, ...verifiedBookingCandidates]);
        setScannerState('valid');
        setBookingInfo(details);
        await loadCheckinStats();
        onCheckinSuccess();
        return;
      }

      setScannerState('invalid');
      setScanError(message);
      lastProcessedValueRef.current = '';
      incrementInvalidScan();
    } catch (error) {
      const nextMessage = error.message || 'Could not complete check-in.';
      setScannerState('invalid');
      setScanError(nextMessage);
      setResultMessage(nextMessage);
      setCameraMessage(nextMessage);
      lastProcessedValueRef.current = '';
      incrementInvalidScan();
    } finally {
      setIsCheckingIn(false);
    }
  };

  const processDetectedValue = async (rawValue) => {
    const trimmedValue = String(rawValue ?? '').trim();
    if (!trimmedValue || isVerifyingRef.current || trimmedValue === lastProcessedValueRef.current) {
      return;
    }

    lastProcessedValueRef.current = trimmedValue;
    await verifyScannedValue(trimmedValue);
  };

  const startDetectionLoop = () => {
    stopDetectionLoop();

    scanIntervalRef.current = window.setInterval(async () => {
      if (isVerifyingRef.current) {
        return;
      }

      try {
        const rawValue = await decodeFromVideoFrame();
        if (rawValue) {
          await processDetectedValue(rawValue);
        }
      } catch {
        setCameraMessage('Camera is live, but the current frame could not be decoded.');
      }
    }, SCAN_INTERVAL_MS);
  };

  const startScanner = async () => {
    resetForRescan();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setCameraMessage('This browser does not support camera access. Use image upload instead.');
      return;
    }

    setCameraState('requesting');
    setCameraMessage('Requesting camera access...');

    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
      }

      setCameraState('live');
      setCameraMessage(
        detectorRef.current
          ? 'Camera is live. Native QR detection is active.'
          : 'Camera is live. QR detection is running with the jsQR fallback.',
      );
      startDetectionLoop();
    } catch (error) {
      setCameraState('blocked');
      setCameraMessage(
        error?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow access and try again.'
          : 'Unable to start the camera. Check if another app is using it, then try again.',
      );
    }
  };

  const handleUploadQr = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    resetForRescan();
    setCameraMessage('Scanning uploaded image...');

    try {
      const rawValue = await decodeFromUploadedFile(file);
      if (!rawValue) {
        throw new Error('No QR code was detected in the uploaded image.');
      }

      await processDetectedValue(rawValue);
    } catch (error) {
      const nextMessage = error.message || 'Could not read the uploaded QR image.';
      setScannerState('invalid');
      setBookingInfo(null);
      setCheckinResult(null);
      setScanError(nextMessage);
      setResultMessage(nextMessage);
      setCameraMessage(nextMessage);
      incrementInvalidScan();
    }
  };

  const handleManualVerify = async () => {
    const trimmedValue = manualCode.trim();
    if (!trimmedValue) {
      setScannerState('invalid');
      setBookingInfo(null);
      setCheckinResult(null);
      setScanError('Enter a QR payload or booking JSON before verifying.');
      setResultMessage('Enter a QR payload or booking JSON before verifying.');
      return;
    }

    await processDetectedValue(trimmedValue);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
    }

    loadCheckinStats();

    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>QR Scanner</h1>
        <p>Validate approved campus bookings through live camera scan or uploaded QR images.</p>
      </header>

      <section className={styles.layout}>
        <div className={styles.column}>
          <Card className={styles.panel}>
            <div className={styles.centered}>
              <Camera className={styles.heroIcon} />
              <h3>Camera Scanner</h3>
              <p>Start the scanner and point your device at a booking QR code.</p>
            </div>

            <div className={styles.cameraFeed}>
              <div className={styles.cameraInner}>
                {cameraState === 'live' || streamRef.current ? (
                  <div className={styles.videoShell}>
                    <video ref={videoRef} className={styles.cameraVideo} autoPlay muted playsInline />
                    <div className={styles.scanFrame}>
                      <div className={styles.scanLine} />
                    </div>
                  </div>
                ) : (
                  <>
                    <Camera size={42} />
                    <p>Camera Preview</p>
                    <span>{cameraMessage}</span>
                    <div className={styles.scanFrame}>
                      <div className={styles.scanLine} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={styles.cameraFooter}>
              <p className={styles.helper}>{cameraMessage}</p>
              <div className={styles.actionStack}>
                <Button icon={ScanLine} onClick={startScanner} disabled={cameraState === 'requesting' || isVerifying}>
                  {cameraState === 'requesting' ? 'Starting...' : 'Start Scanner'}
                </Button>
                <Button variant="secondary" icon={Square} onClick={stopCamera}>
                  Stop Scanner
                </Button>
                <Button variant="secondary" onClick={resetForRescan}>
                  Scan Again
                </Button>
              </div>
            </div>
          </Card>

          <Card className={styles.panel}>
            <h4>Alternative Check-In Methods</h4>
            <div className={styles.actionStack}>
              <label className={styles.uploadLabel}>
                <input type="file" accept="image/png,image/jpeg,image/jpg" className={styles.hiddenInput} onChange={handleUploadQr} />
                <span className={styles.uploadButton}>
                  <Upload size={16} />
                  Upload QR Code Image
                </span>
              </label>

              <div className={styles.manualEntry}>
                <input
                  type="text"
                  className={styles.manualInput}
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  placeholder='Paste QR JSON like {"bookingId":"123456"}'
                />
                <Button variant="secondary" icon={Camera} onClick={handleManualVerify} disabled={isVerifying}>
                  Verify QR
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className={styles.column}>
          {isVerifying || isCheckingIn ? (
            <Card className={styles.waitingCard}>
              <ScanLine className={styles.heroIcon} />
              <h3>{isCheckingIn ? 'Checking In' : 'Verifying QR'}</h3>
              <p>{isCheckingIn ? 'Completing check-in with the backend...' : 'Checking booking details with the backend...'}</p>
            </Card>
          ) : null}

          {!isVerifying && !isCheckingIn && scannerState === null ? (
            <Card className={styles.waitingCard}>
              <Camera className={styles.heroIcon} />
              <h3>Waiting for Scan</h3>
              <p>Start the scanner or upload a QR image to validate a booking.</p>
            </Card>
          ) : null}

          {!isVerifying && !isCheckingIn && scannerState === 'valid' && bookingInfo ? (
            <>
              <div className={styles.validAlert}>
                <CheckCircle2 size={18} />
                <span>{checkinResult?.message === SUCCESS_MESSAGE ? 'Checked in successfully' : 'Valid Booking Detected'}</span>
              </div>

              <Card className={styles.panel}>
                <div className={styles.validBadgeWrap}>
                  <div className={styles.validBadgeCircle}>
                    <CheckCircle2 size={24} />
                  </div>
                </div>

                <div className={styles.infoStack}>
                  <div>
                    <p>Booking ID</p>
                    <strong>{bookingInfo.id}</strong>
                  </div>
                  <div>
                    <p>Student</p>
                    <strong>{bookingInfo.student}</strong>
                  </div>
                  <div>
                    <p>Resource</p>
                    <strong>{bookingInfo.resource}</strong>
                  </div>
                </div>

                <div className={styles.infoGrid}>
                  <div>
                    <p>Booking Start Time</p>
                    <strong>{checkinResult?.startTime ?? bookingInfo.startTime ?? '--:--'}</strong>
                  </div>
                  <div>
                    <p>Booking End Time</p>
                    <strong>{checkinResult?.endTime ?? bookingInfo.endTime ?? '--:--'}</strong>
                  </div>
                </div>

                <div className={styles.infoGrid}>
                  <div>
                    <p>Checked In At</p>
                    <strong>{checkinResult?.checkedInAt ? formatCheckinTime(checkinResult.checkedInAt) : '--:--'}</strong>
                  </div>
                  <div>
                    <p>Status</p>
                    <strong>{checkinResult?.message === SUCCESS_MESSAGE ? 'CHECKED-IN' : bookingInfo.status}</strong>
                  </div>
                </div>

                <p className={styles.successCopy}>
                  {checkinResult?.message === SUCCESS_MESSAGE
                    ? `${resultMessage}. Checkout before: ${checkinResult.endTime}`
                    : resultMessage}
                </p>

                {checkinResult?.late ? (
                  <div className={styles.invalidAlert}>
                    <Clock3 size={18} />
                    <span>You checked in late. Your booking time is NOT extended.</span>
                  </div>
                ) : null}

                <div className={styles.actionStack}>
                  {checkinResult?.message === SUCCESS_MESSAGE ? null : (
                    <Button onClick={handleCheckIn} disabled={isCheckingIn}>
                      {isCheckingIn ? 'Checking In...' : 'Check In'}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={resetForRescan}>
                    Scan Again
                  </Button>
                </div>
              </Card>
            </>
          ) : null}

          {!isVerifying && !isCheckingIn && scannerState === 'invalid' ? (
            <>
              <div className={styles.invalidAlert}>
                <AlertTriangle size={18} />
                <span>{scanError || INVALID_QR_MESSAGE}</span>
              </div>

              <Card className={styles.invalidPanel}>
                <h4>QR could not be accepted</h4>
                <p className={styles.errorCopy}>{scanError || resultMessage || INVALID_QR_MESSAGE}</p>
                <ul className={styles.invalidList}>
                  <li>QR JSON may be invalid or missing a booking ID</li>
                  <li>The booking may not be approved for entry</li>
                  <li>The QR may already be used, too early, or expired</li>
                </ul>
                <Button variant="secondary" onClick={resetForRescan}>
                  Scan Again
                </Button>
              </Card>
            </>
          ) : null}

          <Card className={styles.panel}>
            <h4>Today&apos;s Check-Ins</h4>
            <div className={styles.infoStack}>
              <div className={styles.statRow}>
                <span>Total Check-Ins</span>
                <strong>{checkinStats.total}</strong>
              </div>
              <div className={styles.statRow}>
                <span>Valid</span>
                <strong className={styles.statValid}>{checkinStats.valid}</strong>
              </div>
              <div className={styles.statRow}>
                <span>Invalid</span>
                <strong className={styles.statInvalid}>{checkinStats.invalid}</strong>
              </div>
            </div>
            {scannedCode ? <small className={styles.lastScanned}>{scannedCode}</small> : null}
          </Card>
        </div>
      </section>
    </div>
  );
}
