// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LevelSlider from './LevelSlider'
import SeekBar from './SeekBar'
import { formatClock } from './seekTime'
import { waveform } from './waveform'

afterEach(cleanup)

describe('LevelSlider', () => {
  it('inks the bars up to the level and reports changes as 0–1', () => {
    const onChange = vi.fn()
    const view = render(<LevelSlider value={0.5} onChange={onChange} label="Volume" bars={10} />)
    const slider = screen.getByRole('slider', { name: 'Volume' })

    expect(slider).toHaveValue('50')
    expect(slider).toHaveAttribute('aria-valuetext', '50%')
    expect(view.container.querySelectorAll('.level-slider__bars i')).toHaveLength(10)
    expect(view.container.querySelectorAll('.level-slider__bars i.is-on')).toHaveLength(5)

    fireEvent.change(slider, { target: { value: '80' } })
    expect(onChange).toHaveBeenCalledWith(0.8)
  })

  it('dances only while playing, enabled and audible', () => {
    const view = render(<LevelSlider value={0.4} onChange={vi.fn()} label="Volume" playing />)
    const root = () => view.container.querySelector('.level-slider')
    expect(root()).toHaveAttribute('data-playing')

    view.rerender(<LevelSlider value={0} onChange={vi.fn()} label="Volume" playing />)
    expect(root()).not.toHaveAttribute('data-playing')

    view.rerender(<LevelSlider value={0.4} onChange={vi.fn()} label="Volume" playing disabled />)
    expect(root()).not.toHaveAttribute('data-playing')
    expect(screen.getByRole('slider')).toBeDisabled()

    view.rerender(<LevelSlider value={0.4} onChange={vi.fn()} label="Volume" />)
    expect(root()).not.toHaveAttribute('data-playing')
  })
})

describe('SeekBar', () => {
  it('inks the waveform up to the playhead and seeks by fraction', () => {
    const onSeek = vi.fn()
    const view = render(<SeekBar currentTime={72} duration={392} onSeek={onSeek} label="Progress" seed="episode-1" />)
    const slider = screen.getByRole('slider', { name: 'Progress' })

    expect(slider).toHaveValue('18.4')
    expect(slider).toHaveAttribute('aria-valuetext', '1:12 / 6:32')
    expect(view.container.querySelector('.seek-bar')).toHaveStyle({ '--seek': '18.4%' })
    expect(view.container.querySelectorAll('.seek-bar__bars--played i').length).toBeGreaterThan(0)

    fireEvent.change(slider, { target: { value: '50' } })
    expect(onSeek).toHaveBeenCalledWith(0.5)
  })

  it('is disabled with no playhead until the length is known', () => {
    const view = render(<SeekBar currentTime={0} duration={0} onSeek={vi.fn()} label="Progress" />)
    expect(screen.getByRole('slider')).toBeDisabled()
    expect(view.container.querySelector('.seek-bar__head')).toBeNull()
  })
})

describe('waveform', () => {
  it('gives each seed its own fixed shape within 0.15–1', () => {
    const first = waveform('episode-1', 60)
    expect(first).toEqual(waveform('episode-1', 60))
    expect(first).not.toEqual(waveform('episode-2', 60))
    expect(Math.min(...first)).toBeGreaterThanOrEqual(0.15)
    expect(Math.max(...first)).toBeLessThanOrEqual(1)
  })
})

describe('formatClock', () => {
  it('formats minutes and hours', () => {
    expect(formatClock(392)).toBe('6:32')
    expect(formatClock(3725)).toBe('1:02:05')
  })
})
