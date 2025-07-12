export const ANIMATION_DURATION = {
  MODE_TRANSITION: 800,
  FLOW_PARTICLE: 3000,
  FLOW_TRAIL: 2000,
} as const

export const COMPONENT_IDS = {
  AMOUNT_INPUT: 'compiler-amount-input',
  MODE_TOGGLE: 'compiler-mode-toggle',
  ACTION_BUTTON: 'compiler-action-button',
} as const

export const CSS_CLASSES = {
  COMPILE_MODE: 'compile-mode',
  RESTORE_MODE: 'restore-mode',
  SOURCE_ACTIVE: 'source-active',
  TARGET_ACTIVE: 'target-active',
  COMPILE_DIRECTION: 'compile-direction',
  RESTORE_DIRECTION: 'restore-direction',
} as const