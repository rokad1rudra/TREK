import { ExternalLink, Info, Mail } from 'lucide-react';
import React from 'react';
import { useTranslation } from '../../i18n';
import Section from './Section';

interface Props {
  appVersion: string;
}

const CONTACT_URL = 'https://github.com/liketrek/TREK/issues/new/choose';

export default function AboutTab({ appVersion }: Props): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Section title={t('settings.about')} icon={Info}>
      <p
        className="text-content-secondary"
        style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', lineHeight: 1.6, marginBottom: 16, marginTop: -4 }}
      >
        Plan trips, organize reservations, and keep every travel detail in one place.{' '}
        GlobeTrotter makes travel planning simple, clear, and ready whenever you are.
      </p>

      <a
        href={CONTACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 overflow-hidden rounded-xl border border-edge bg-surface-card px-5 py-4 no-underline transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#2563eb';
          e.currentTarget.style.boxShadow = '0 0 0 1px #2563eb22';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-primary)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div
          className="bg-[#2563eb15]"
          style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Mail size={20} className="text-[#2563eb]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-content">Contact us</div>
          <div className="text-xs text-content-faint">Questions, feedback, or support? Get in touch.</div>
        </div>
        <ExternalLink size={14} className="ml-auto flex-shrink-0 text-content-faint" />
      </a>

      <p className="mt-4 text-xs text-content-faint">Version {appVersion}</p>
    </Section>
  );
}
