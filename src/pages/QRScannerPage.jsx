import { useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Upload } from 'lucide-react';

import styles from './QRScannerPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function QRScannerPage() {
  const [scannedCode, setScannedCode] = useState(null);
  const [scannerState, setScannerState] = useState(null);
  const [bookingInfo, setBookingInfo] = useState(null);

  const handleScanCode = (code) => {
    setScannedCode(code);
    const valid = /^[0-9]{8}$/.test(code);
    setScannerState(valid ? 'valid' : 'invalid');

    if (valid) {
      setBookingInfo({
        id: code,
        resource: 'Lab A - Computer Lab',
        date: 'March 15, 2024',
        time: '2:00 PM - 4:00 PM',
        location: 'Building A, Floor 3',
        student: 'Sarah Anderson',
        status: 'Valid',
      });
      return;
    }

    setBookingInfo(null);
  };

  const handleUploadQr = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleScanCode('12345678');
    }
  };

  const resetScanner = () => {
    setScannedCode(null);
    setScannerState(null);
    setBookingInfo(null);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>QR Check-In System</h1>
        <p>Scan QR codes to verify student check-ins</p>
      </header>

      <section className={styles.layout}>
        <div className={styles.column}>
          <Card className={styles.panel}>
            <div className={styles.centered}>
              <Camera className={styles.heroIcon} />
              <h3>Camera Scanner</h3>
              <p>Point your device's camera at the QR code.</p>
            </div>

            <div className={styles.cameraFeed}>
              <div className={styles.cameraInner}>
                <Camera size={42} />
                <p>Camera Feed</p>
                <span>Enable camera access</span>
                <div className={styles.scanFrame}>
                  <div className={styles.scanLine} />
                </div>
              </div>
            </div>

            <p className={styles.helper}>Point the camera at the QR code to scan automatically.</p>
          </Card>

          <Card className={styles.panel}>
            <h4>Alternative Check-In Methods</h4>
            <div className={styles.actionStack}>
              <label className={styles.uploadLabel}>
                <input type="file" accept="image/*" className={styles.hiddenInput} onChange={handleUploadQr} />
                <span className={styles.uploadButton}>
                  <Upload size={16} />
                  Upload QR Code Image
                </span>
              </label>
              <Button variant="secondary" onClick={() => handleScanCode('12345678')}>
                <Camera size={16} />
                Enter Booking ID Manually
              </Button>
            </div>
          </Card>

          <Card className={styles.testPanel}>
            <h4>Test Scanner</h4>
            <div className={styles.actionStack}>
              <Button variant="secondary" size="sm" onClick={() => handleScanCode('12345678')}>
                Scan Valid QR
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleScanCode('invalid')}>
                Scan Invalid QR
              </Button>
            </div>
          </Card>
        </div>

        <div className={styles.column}>
          {scannerState === null ? (
            <Card className={styles.waitingCard}>
              <Camera className={styles.heroIcon} />
              <h3>Waiting for Scan</h3>
              <p>Scan a QR code to verify the check-in.</p>
            </Card>
          ) : null}

          {scannerState === 'valid' && bookingInfo ? (
            <>
              <div className={styles.validAlert}>
                <CheckCircle2 size={18} />
                <span>Valid Booking</span>
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
                    <p>Date</p>
                    <strong>{bookingInfo.date}</strong>
                  </div>
                  <div>
                    <p>Time</p>
                    <strong>{bookingInfo.time}</strong>
                  </div>
                </div>

                <div className={styles.infoStack}>
                  <div>
                    <p>Location</p>
                    <strong>{bookingInfo.location}</strong>
                  </div>
                </div>

                <div className={styles.statusRow}>
                  <span className={styles.statusPill}>{bookingInfo.status}</span>
                </div>

                <Button>Confirm Check-In</Button>
              </Card>

              <Card className={styles.confirmCard}>
                <h4>Check-In Confirmed</h4>
                <p>
                  {bookingInfo.student} has successfully checked in to {bookingInfo.resource}
                </p>
                <div className={styles.infoStack}>
                  <div className={styles.statRow}>
                    <span>Check-in Time</span>
                    <strong>2:00 PM</strong>
                  </div>
                  <div className={styles.statRow}>
                    <span>Remaining Time</span>
                    <strong>2 hours</strong>
                  </div>
                </div>
              </Card>
            </>
          ) : null}

          {scannerState === 'invalid' ? (
            <>
              <div className={styles.invalidAlert}>
                <AlertTriangle size={18} />
                <span>Invalid Booking</span>
              </div>

              <Card className={styles.invalidPanel}>
                <h4>This QR code is not valid</h4>
                <ul className={styles.invalidList}>
                  <li>Booking may not exist</li>
                  <li>QR code may be expired or cancelled</li>
                  <li>Student may have already checked in</li>
                </ul>
                <Button variant="secondary" onClick={resetScanner}>
                  Scan Another Code
                </Button>
              </Card>
            </>
          ) : null}

          <Card className={styles.panel}>
            <h4>Today's Check-Ins</h4>
            <div className={styles.infoStack}>
              <div className={styles.statRow}>
                <span>Total Check-Ins</span>
                <strong>24</strong>
              </div>
              <div className={styles.statRow}>
                <span>Valid</span>
                <strong className={styles.statValid}>23</strong>
              </div>
              <div className={styles.statRow}>
                <span>Invalid</span>
                <strong className={styles.statInvalid}>1</strong>
              </div>
            </div>
            {scannedCode ? <small className={styles.lastScanned}>Last scanned code: {scannedCode}</small> : null}
          </Card>
        </div>
      </section>
    </div>
  );
}
