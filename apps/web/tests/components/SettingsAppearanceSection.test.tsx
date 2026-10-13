// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsAppearanceSection } from '../../src/components/SettingsAppearanceSection';
import { I18nProvider } from '../../src/i18n';
import { ACCENT_SWATCHES } from '../../src/state/appearance';

describe('SettingsAppearanceSection', () => {
  it('renders the three-theme radio group and supports arrow-key selection', () => {
    const onChange = vi.fn();
    render(
      <I18nProvider initial="en">
        <SettingsAppearanceSection value={{ theme: 'system', accentColor: '#353535' }} onChange={onChange} />
      </I18nProvider>,
    );

    const themeGroup = screen.getByRole('radiogroup', { name: 'Appearance' });
    expect((themeGroup as HTMLElement).style.getPropertyValue('--seg-cols')).toBe('3');
    const radios = within(themeGroup).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      expect(radio.querySelector('.seg-title')).toBeTruthy();
    }

    const selected = radios.find((radio) => radio.getAttribute('aria-checked') === 'true');
    expect(selected).toBeTruthy();
    fireEvent.keyDown(selected!, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith({ theme: 'light', accentColor: '#353535' });
  });

  it('renders and changes the controlled accent selection by click and arrow key', () => {
    const value = { theme: 'system' as const, accentColor: '#1a74ff' };
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider initial="en">
        <SettingsAppearanceSection value={value} onChange={onChange} />
      </I18nProvider>,
    );

    const appearanceSection = within(container).getByTestId('settings-appearance-section');
    const accentGroup = within(appearanceSection).getByRole('radiogroup', { name: 'Accent color' });
    const swatches = within(accentGroup).getAllByRole('radio');
    expect(swatches).toHaveLength(ACCENT_SWATCHES.length);
    swatches.forEach((swatch, index) => {
      expect(swatch).toHaveAttribute('aria-checked', ACCENT_SWATCHES[index]!.toLowerCase() === value.accentColor ? 'true' : 'false');
    });

    fireEvent.click(swatches[2]!);
    expect(onChange).toHaveBeenLastCalledWith({ ...value, accentColor: ACCENT_SWATCHES[2]!.toLowerCase() });

    fireEvent.keyDown(swatches[5]!, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith({ ...value, accentColor: ACCENT_SWATCHES[6]!.toLowerCase() });
  });
});
