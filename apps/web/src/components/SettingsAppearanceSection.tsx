import type { AppTheme } from '../types';
import { useT } from '../i18n';
import { ACCENT_SWATCHES } from '../state/appearance';
import styles from './SettingsAppearanceSection.module.css';

export interface AppearanceSettingsValue {
  theme: AppTheme;
  accentColor: string;
}

export function SettingsAppearanceSection({
  value,
  onChange,
}: {
  value: AppearanceSettingsValue;
  onChange: (value: AppearanceSettingsValue) => void;
}) {
  const t = useT();
  const themes: Array<{ value: AppTheme; label: string }> = [
    { value: 'light', label: t('brandDetail.themeLight') },
    { value: 'dark', label: t('brandDetail.themeDark') },
    { value: 'system', label: t('settings.themeSystem') },
  ];

  return (
    <section className="settings-section settings-general-section" data-testid="settings-appearance-section">
      <div className="settings-general-block">
        <div className="settings-general-field">
          <span className="settings-general-label">{t('settings.appearanceTitle')}</span>
          <div className={`seg-control ${styles.appearanceControl}`} style={{ '--seg-cols': 3 } as React.CSSProperties} role="radiogroup" aria-label={t('settings.appearanceTitle')}>
            {themes.map(({ value: theme, label }) => (
              <button
                key={theme}
                type="button"
                role="radio"
                aria-checked={value.theme === theme}
                tabIndex={value.theme === theme ? 0 : -1}
                className={`seg-btn${value.theme === theme ? ' active' : ''}`}
                onClick={() => onChange({ ...value, theme })}
                onKeyDown={(event) => {
                  const currentIndex = themes.findIndex((item) => item.value === theme);
                  const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
                    ? (currentIndex + 1) % themes.length
                    : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                      ? (currentIndex - 1 + themes.length) % themes.length
                      : -1;
                  if (nextIndex >= 0) {
                    event.preventDefault();
                    const nextTheme = themes[nextIndex]!.value;
                    onChange({ ...value, theme: nextTheme });
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
                  }
                }}
              >
                <span className="seg-title">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="settings-general-block">
        <div className="settings-general-field">
          <span className="settings-general-label">{t('settings.accentColor')}</span>
          <div role="radiogroup" aria-label={t('settings.accentColor')} className={styles.swatches}>
            {ACCENT_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-label={color}
                aria-checked={value.accentColor === color.toLowerCase()}
                tabIndex={value.accentColor === color.toLowerCase() || (color === ACCENT_SWATCHES[0] && !ACCENT_SWATCHES.some((swatch) => value.accentColor === swatch.toLowerCase())) ? 0 : -1}
                className={styles.swatch}
                style={{ backgroundColor: color }}
                onClick={() => onChange({ ...value, accentColor: color.toLowerCase() })}
                onKeyDown={(event) => {
                  const currentIndex = ACCENT_SWATCHES.indexOf(color);
                  const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
                    ? (currentIndex + 1) % ACCENT_SWATCHES.length
                    : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                      ? (currentIndex - 1 + ACCENT_SWATCHES.length) % ACCENT_SWATCHES.length
                      : -1;
                  if (nextIndex >= 0) {
                    event.preventDefault();
                    const nextColor = ACCENT_SWATCHES[nextIndex]!;
                    onChange({ ...value, accentColor: nextColor.toLowerCase() });
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
