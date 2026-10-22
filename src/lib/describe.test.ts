import { describe, expect, it } from 'vitest'
import { roomLabel, setupLabel } from './describe'
import { defaultForm, newDeviceRow } from './form'

describe('plain-language summaries', () => {
  it('names preset rooms and falls back to dimensions', () => {
    const f = defaultForm()
    expect(roomLabel(f)).toBe('Medium bedroom')
    f.heightFt = '10'
    expect(roomLabel(f)).toBe('12 × 12 ft room')
  })

  it('describes the air cleaners the way a person would', () => {
    const f = defaultForm()
    expect(setupLabel(f)).toBe('a box fan with a filter')
    f.devices = []
    expect(setupLabel(f)).toBe('no air cleaner')
    f.devices = [newDeviceRow('purifier'), newDeviceRow('cr-box-4', undefined, 2)]
    expect(setupLabel(f)).toBe('an air purifier and 2 filter cubes')
  })
})
