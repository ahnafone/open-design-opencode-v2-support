import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '../src/i18n';
import { AnalyticsProvider } from '../src/analytics/provider';
import '@excalidraw/excalidraw/index.css';
import '../src/index.css';
import '../src/styles/home/index.css';
// These hosts render from the client-only App entry. Keep their layout CSS in
// the root route stylesheet so Turbopack does not leave the lazy chunk as a
// preload-only resource after the host mounts.
import '../src/components/TestCampaignModal.module.css';
import '../src/components/HoverTouchpointOverlay.module.css';
import '../src/components/ProductionCampaignBadge.module.css';
import '../src/components/OnboardingWelcome.module.css';

export const metadata: Metadata = {
  title: 'OpenDesign',
  icons: {
    icon: '/app-icon.png',
    apple: '/app-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#f7f7f7',
};

/**
 * Inline script that runs before React hydrates so the first paint already
 * carries the app's appearance — no flash of unstyled content.
 *
 * `data-theme` is resolved before hydration and deliberately stamped even if
 * storage is unavailable, so every reader sees a concrete theme.
 * Keep the accent variable mix ratios in sync with `accentVars()` in
 * `src/state/appearance.ts`; this script cannot import application modules.
 */
const themeInitScript = `(function(){var t='system',c={};try{c=JSON.parse(localStorage.getItem('open-design:config')||'{}');if(c.theme==='light'||c.theme==='dark'||c.theme==='system')t=c.theme}catch(e){}var m=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=t==='dark'||(t==='system'&&m);document.documentElement.setAttribute('data-theme',dark?'dark':'light');var a=typeof c.accentColor==='string'&&/^#[0-9a-fA-F]{6}$/.test(c.accentColor.trim())?c.accentColor.trim().toLowerCase():null;if(c.configMigrationVersion!==3&&(a==='#87ea5c'||a==='#c96442'))a=null;if(!a||a==='#353535')a=dark?'#ededed':'#353535';var lum=function(color){var v=[0,2,4].map(function(i){var x=parseInt(color.slice(i+1,i+3),16)/255;return x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4)});return .2126*v[0]+.7152*v[1]+.0722*v[2]};var ratio=function(x,y){var l1=lum(x),l2=lum(y);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};var light='#fafafa',ink='#202020',best=ratio(light,a)>=ratio(ink,a)?light:ink;if(ratio(best,a)<4.5)best=ratio('#ffffff',a)>=ratio('#000000',a)?'#ffffff':'#000000';var s=document.documentElement.style;s.setProperty('--accent',a);s.setProperty('--accent-contrast',best);s.setProperty('--accent-strong','color-mix(in srgb, '+a+' 82%, var(--text-strong))');s.setProperty('--accent-soft','color-mix(in srgb, '+a+' 12%, var(--bg-subtle))');s.setProperty('--accent-tint','color-mix(in srgb, '+a+' 6%, var(--bg-panel))');s.setProperty('--accent-hover','color-mix(in srgb, '+a+' 86%, var(--text-strong))');})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: intentional theme-init inline script to prevent FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <I18nProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
