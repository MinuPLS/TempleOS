import React from 'react';

interface ResponsivePanelNavigationProps {
  currentPanel: number;
  onPanelChange: (panel: number) => void;
  className?: string;
}

export const ResponsivePanelNavigation: React.FC<ResponsivePanelNavigationProps> = ({
  currentPanel,
  onPanelChange,
  className = ''
}) => {
  const panels = [
    { id: 0, name: 'Stats', key: 'stats' },
    { id: 1, name: 'Compiler', key: 'compiler' }, // Default/main panel
    { id: 2, name: 'Pools', key: 'pools' }
  ];

  return (
    <nav className={className}>
      {panels.map((panel) => (
        <button
          key={panel.key}
          className={`panel-nav-btn ${currentPanel === panel.id ? 'active' : ''}`}
          onClick={() => onPanelChange(panel.id)}
          type="button"
          aria-pressed={currentPanel === panel.id}
        >
          {panel.name}
        </button>
      ))}
    </nav>
  );
};

export default ResponsivePanelNavigation;