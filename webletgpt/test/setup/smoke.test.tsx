import { describe, expect, it } from 'vitest'

import { render, screen } from './render'

describe('smoke test', () => {
  it('renders text content', () => {
    render(<div>Vitest smoke test</div>)

    expect(screen.getByText('Vitest smoke test')).toBeInTheDocument()
  })
})
