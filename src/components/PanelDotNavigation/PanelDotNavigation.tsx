import React from 'react';
import styles from './PanelDotNavigation.module.css';

interface PanelDotNavigationProps {
  currentPanel: number;
  onPanelChange: (panel: number) => void;
  className?: string;
}

export const PanelDotNavigation: React.FC<PanelDotNavigationProps> = ({
  currentPanel,
  onPanelChange,
  className = ''
}) => {
  const panels = [
    { id: 0, color: 'stats', label: 'Token Stats' },
    { id: 1, color: 'compiler', label: 'Compiler' },
    { id: 2, color: 'pools', label: 'Pools' }
  ];

  const handlePrev = () => {
    onPanelChange((currentPanel - 1 + panels.length) % panels.length);
  };

  const handleNext = () => {
    onPanelChange((currentPanel + 1) % panels.length);
  };

  const activePanelColor = panels.find(p => p.id === currentPanel)?.color || 'compiler';

  return (
    <div className={`${styles.dotNavigation} ${className}`}>
      <button onClick={handlePrev} className={`${styles.arrowButton} ${styles.leftArrow} ${styles[activePanelColor]}`}>‹</button>
      <div className={styles.dotsWrapper}>
        {panels.map((panel) => (
          <button
            key={panel.id}
            className={`${styles.navDot} ${styles[panel.color]} ${currentPanel === panel.id ? styles.active : ''}`}
            onClick={() => onPanelChange(panel.id)}
            type="button"
            aria-label={`Switch to ${panel.label}`}
          />
        ))}
      </div>
      <button onClick={handleNext} className={`${styles.arrowButton} ${styles.rightArrow} ${styles[activePanelColor]}`}>›</button>
    </div>
  );
};

export default PanelDotNavigation;