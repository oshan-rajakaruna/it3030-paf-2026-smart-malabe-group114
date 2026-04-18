import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, SendHorizontal, XCircle } from 'lucide-react';

import styles from './CreateNotification.module.css';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FormField from '../../components/ui/FormField';
import PageHeader from '../../components/ui/PageHeader';
import SelectField from '../../components/ui/SelectField';
import TextAreaField from '../../components/ui/TextAreaField';
import { useAuth } from '../../hooks/useAuth';
import { ROUTE_PATHS } from '../../routes/routeConfig';
import { createNotification } from '../../services/notificationApi';

const DRAFT_STORAGE_KEY = 'smart-campus-notification-draft';

const AUDIENCE_OPTIONS = [
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Technician', value: 'TECHNICIAN' },
  { label: 'Student', value: 'STUDENT' },
  { label: 'All', value: 'ALL' },
];

const CHANNEL_OPTIONS = [
  { label: 'Web', value: 'WEB' },
  { label: 'Email', value: 'EMAIL' },
  { label: 'Both', value: 'BOTH' },
];

const PRIORITY_OPTIONS = [
  { label: 'Low', value: 'LOW' },
  { label: 'Normal', value: 'NORMAL' },
  { label: 'High', value: 'HIGH' },
];

const MODULE_OPTIONS = [
  { label: 'Auth', value: 'AUTH' },
  { label: 'Booking', value: 'BOOKING' },
  { label: 'Resource', value: 'RESOURCE' },
  { label: 'Ticket', value: 'TICKET' },
];

export default function CreateNotification() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('ADMIN');
  const [channel, setChannel] = useState('WEB');
  const [priority, setPriority] = useState('NORMAL');
  const [module, setModule] = useState('AUTH');
  const [scheduleAt, setScheduleAt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    try {
      const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!rawDraft) {
        return;
      }
      const draft = JSON.parse(rawDraft);
      setSubject(draft?.subject || '');
      setMessage(draft?.message || '');
      setAudience(draft?.audience || 'ADMIN');
      setChannel(draft?.channel || 'WEB');
      setPriority(draft?.priority || 'NORMAL');
      setModule(draft?.module || 'AUTH');
      setScheduleAt(draft?.scheduleAt || '');
      setFeedback('Loaded saved draft.');
    } catch (error) {
      // Ignore malformed local draft payloads.
    }
  }, []);

  const saveDraft = () => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        subject,
        message,
        audience,
        channel,
        priority,
        module,
        scheduleAt,
        savedAt: new Date().toISOString(),
      }),
    );
    setFeedback('Draft saved locally.');
  };

  const sendNow = async () => {
    if (!subject.trim() || !message.trim()) {
      setFeedback('Subject and message are required.');
      return;
    }

    setIsSending(true);
    setFeedback('');
    try {
      await createNotification({
        title: subject.trim(),
        message: message.trim(),
        role: audience,
        module,
        channel,
        priority,
        status: 'UNREAD',
        createdBy: currentUser?.id || 'ADMIN',
      });

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      navigate(ROUTE_PATHS.ADMIN_NOTIFICATIONS, { replace: true });
    } catch (requestError) {
      console.error('Failed to send notification', requestError);
      setFeedback(requestError?.message || 'Failed to send notification.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Admin Notifications"
        title="Create Notification"
        description="Compose targeted alerts for admins, technicians, students, or all users."
      />

      <Card title="Notification Composer" subtitle="Draft, schedule notes, and send instantly.">
        <div className={styles.formGrid}>
          <FormField id="notification-subject" label="Subject" required>
            <input
              id="notification-subject"
              className={styles.control}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="New booking request"
            />
          </FormField>

          <SelectField
            id="notification-audience"
            label="Audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            options={AUDIENCE_OPTIONS}
          />

          <SelectField
            id="notification-channel"
            label="Channel"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            options={CHANNEL_OPTIONS}
          />

          <SelectField
            id="notification-priority"
            label="Priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            options={PRIORITY_OPTIONS}
          />

          <SelectField
            id="notification-module"
            label="Module"
            value={module}
            onChange={(event) => setModule(event.target.value)}
            options={MODULE_OPTIONS}
          />

          <FormField id="notification-schedule" label="Schedule (optional)">
            <input
              id="notification-schedule"
              type="datetime-local"
              className={styles.control}
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
            />
          </FormField>

          <TextAreaField
            id="notification-message"
            label="Message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={6}
            placeholder="A student has requested a booking."
            required
          />
        </div>

        {feedback ? <p className={styles.feedback}>{feedback}</p> : null}

        <div className={styles.actions}>
          <Button variant="secondary" icon={XCircle} onClick={() => navigate(ROUTE_PATHS.ADMIN_NOTIFICATIONS)}>
            Cancel
          </Button>
          <Button variant="ghost" icon={Save} onClick={saveDraft}>
            Save draft
          </Button>
          <Button icon={SendHorizontal} onClick={sendNow} disabled={isSending}>
            {isSending ? 'Sending...' : 'Send now'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
