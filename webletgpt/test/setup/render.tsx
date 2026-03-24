import { render as rtlRender } from '@testing-library/react'
import type { ReactElement } from 'react'

export * from '@testing-library/react'

export function render(ui: ReactElement) {
  return rtlRender(ui)
}

export { screen } from '@testing-library/react'
