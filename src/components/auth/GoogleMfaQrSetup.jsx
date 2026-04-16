import { useEffect, useState } from 'react';
import axios from 'axios';

import styles from './GoogleMfaQrSetup.module.css';

const MFA_QR_API_URL = 'http://localhost:8080/api/auth/2fa/qr';

export default function GoogleMfaQrSetup({ email, otpAuthUrlFallback = '' }) {
  const [qrCodeBase64, setQrCodeBase64] = useState('');
  const [otpAuthUrl, setOtpAuthUrl] = useState(otpAuthUrlFallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!email) {
      return;
    }

    let active = true;

    const loadQrCode = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await axios.get(MFA_QR_API_URL, { params: { email } });
        if (!active) {
          return;
        }
        setQrCodeBase64(data?.qrCodeImageBase64 || '');
        setOtpAuthUrl(data?.otpAuthUrl || otpAuthUrlFallback);
      } catch (apiError) {
        if (!active) {
          return;
        }
        console.error('Failed to load Google Authenticator QR code', apiError);
        setError('Could not load QR code. Use the setup link below.');
        setOtpAuthUrl(otpAuthUrlFallback);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadQrCode();

    return () => {
      active = false;
    };
  }, [email, otpAuthUrlFallback]);

  return (
    <div className={styles.container}>
      <p className={styles.title}>Scan this QR code with Google Authenticator</p>
      {loading ? <p className={styles.info}>Generating QR code...</p> : null}
      {qrCodeBase64 ? (
        <img
          className={styles.qrImage}
          src={`data:image/png;base64,${qrCodeBase64}`}
          alt="Google Authenticator setup QR"
        />
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {otpAuthUrl ? <p className={styles.linkText}>Setup link: {otpAuthUrl}</p> : null}
    </div>
  );
}
