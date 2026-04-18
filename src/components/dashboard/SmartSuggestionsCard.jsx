import { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, ChevronLeft, ChevronRight, Clock3, GraduationCap } from 'lucide-react';

import styles from './SmartSuggestionsCard.module.css';
import Card from '../ui/Card';
import { joinClassNames } from '../../utils/formatters';

const fallbackSuggestions = [
  {
    id: 'free-slot',
    icon: Clock3,
    eyebrow: 'Free Slot',
    title: 'You have a free slot today',
    description: '2:00 PM - 4:00 PM',
    actionLabel: 'Book Now',
    theme: 'blue',
  },
  {
    id: 'resource',
    icon: GraduationCap,
    eyebrow: 'Resource Suggestion',
    title: 'Lab A is highly available',
    description: 'Few bookings scheduled today',
    actionLabel: 'Book Lab',
    theme: 'teal',
  },
  {
    id: 'peak-warning',
    icon: AlertTriangle,
    eyebrow: 'Peak Warning',
    title: 'High demand period',
    description: '10:00 AM - 12:00 PM is almost full',
    metaLabel: '92% full',
    theme: 'amber',
  },
  {
    id: 'reminder',
    icon: BellRing,
    eyebrow: 'Reminder',
    title: 'Upcoming booking soon',
    description: 'Engineering Lab A at 9:00 AM',
    actionLabel: 'View Details',
    theme: 'violet',
  },
];

export default function SmartSuggestionsCard({ suggestions = fallbackSuggestions, onAction, onViewAll }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleSuggestions = suggestions.length ? suggestions : fallbackSuggestions;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % visibleSuggestions.length);
    }, 3800);

    return () => window.clearInterval(intervalId);
  }, [visibleSuggestions.length]);

  useEffect(() => {
    if (activeIndex >= visibleSuggestions.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, visibleSuggestions.length]);

  const goToPrevious = () => {
    setActiveIndex((current) => (current === 0 ? visibleSuggestions.length - 1 : current - 1));
  };

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % visibleSuggestions.length);
  };

  return (
    <Card
      title="Smart suggestions"
      subtitle="Intelligent prompts based on your booking behavior and campus demand."
      className={styles.card}
      action={
        <div className={styles.controls}>
          <button type="button" className={styles.navButton} onClick={goToPrevious} aria-label="Previous suggestion">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className={styles.navButton} onClick={goToNext} aria-label="Next suggestion">
            <ChevronRight size={16} />
          </button>
        </div>
      }
    >
      <div className={styles.viewport}>
        <div className={styles.track} style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {visibleSuggestions.map((suggestion) => {
            const SuggestionIcon = suggestion.icon;

            return (
              <article key={suggestion.id} className={joinClassNames(styles.slide, styles[`theme${suggestion.theme}`])}>
                <div className={styles.shine} />
                <div className={styles.content}>
                  <div className={styles.iconBadge}>
                    <SuggestionIcon size={20} />
                  </div>

                  <div className={styles.copy}>
                    <span className={styles.eyebrow}>{suggestion.eyebrow}</span>
                    <h3 className={styles.title}>{suggestion.title}</h3>
                    <p className={styles.description}>{suggestion.description}</p>
                  </div>

                  <div className={styles.actionArea}>
                    {suggestion.actionLabel ? (
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => onAction?.(suggestion)}
                      >
                        {suggestion.actionLabel} <span aria-hidden="true">-&gt;</span>
                      </button>
                    ) : (
                      <span className={styles.metaPill}>{suggestion.metaLabel}</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.dots}>
          {visibleSuggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              className={joinClassNames(styles.dot, index === activeIndex && styles.dotActive)}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show suggestion ${index + 1}`}
            />
          ))}
        </div>

        <button type="button" className={styles.viewAll} onClick={() => onViewAll?.(visibleSuggestions)}>
          View all suggestions
        </button>
      </div>
    </Card>
  );
}
