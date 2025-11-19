import { memo, useCallback } from 'react'
import { ANIMATION_DURATION } from '../utils/constants'
import styles from '../styles/interface.module.css'

interface ModeToggleProps {
  isCompileMode: boolean
  onModeChange: (isCompile: boolean) => void
  onTransitionStart: () => void
}

export const ModeToggle = memo<ModeToggleProps>(({
  isCompileMode,
  onModeChange,
  onTransitionStart,
}) => {
  const handleModeChange = useCallback((newMode: boolean) => {
    if (newMode !== isCompileMode) {
      onTransitionStart()
      setTimeout(() => {
        // Transition animation complete
      }, ANIMATION_DURATION.MODE_TRANSITION)
    }
    onModeChange(newMode)
  }, [isCompileMode, onModeChange, onTransitionStart])

  return (
    <div className={styles.modeToggleContainer}>
      <button
        className={`${styles.modeToggle} ${isCompileMode ? styles.active : ''}`}
        onClick={() => handleModeChange(true)}
        type="button"
      >
        Compile
      </button>
      <button
        className={`${styles.modeToggle} ${!isCompileMode ? styles.active : ''}`}
        onClick={() => handleModeChange(false)}
        type="button"
      >
        Restore
      </button>
    </div>
  )
})
