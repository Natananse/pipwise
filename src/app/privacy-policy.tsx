import React from 'react';
import { LegalPage, LegalSection, LegalText } from '../components/LegalPage';
import { legalDetails, privacySections } from '../lib/legal';

export default function PrivacyPolicy() {
  return <LegalPage title="Privacy policy" subtitle={`Effective ${legalDetails.effectiveDate} · PipWise account and practice information`}>
    {privacySections.map(section => <LegalSection key={section.title} title={section.title}>
      {section.paragraphs.map(paragraph => <LegalText key={paragraph}>{paragraph}</LegalText>)}
    </LegalSection>)}
  </LegalPage>;
}
