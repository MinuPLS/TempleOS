import React from 'react';

interface ResponsivePanelNavigationProps {
  currentPanel: number;
  viewMode: 'single' | 'twoPanel';
  onPanelChange: (panel: number) => void;
  className?: string;
}

export const ResponsivePanelNavigation: React.FC<ResponsivePanelNavigationProps> = ({
  currentPanel,
  viewMode,
  onPanelChange,
  className = ''
}) => {
  const panels = [
    { id: 0, name: 'Stats', key: 'stats' },
    { id: 1, name: 'Compiler', key: 'compiler' }, // Middle position - most important
    { id: 2, name: 'Pools', key: 'pools' },
    { id: 3, name: 'Data', key: 'data' } // Show stats + pools together (tablet mode)
  ];

  const getButtonState = (panel: { id: number; key: string }) => {
    if (panel.id === 3) {
      // "Data" button is active when in twoPanel mode (stats + pools together)
      return viewMode === 'twoPanel' ? 'active' : '';
    }
    if (viewMode === 'twoPanel') {
      // In 2-panel mode, both stats and pools show but neither individual button is active
      return '';
    }
    // Normal single panel mode
    return currentPanel === panel.id ? 'active' : '';
  };

  return (
    <nav className={className}>
      {panels.map((panel) => (
        <button
          key={panel.key}
          className={`panel-nav-btn ${getButtonState(panel)}`}
          onClick={() => onPanelChange(panel.id)}
          type="button"
          aria-pressed={getButtonState(panel) === 'active'}
        >
          {panel.name}
        </button>
      ))}
    </nav>
  );
};

export default ResponsivePanelNavigation;