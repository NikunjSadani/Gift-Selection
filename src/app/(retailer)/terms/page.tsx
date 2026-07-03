'use client';

import { useRouter } from 'next/navigation';

const sections = [
  {
    num: '1.',
    title: 'Introduction',
    body: 'Welcome to the Kwality Wall\'s Retailer Gift Selection Portal ("Portal"). The Portal has been established for eligible retail partners to select gifts, validate contact details, update delivery information and facilitate reward fulfilment under the applicable loyalty program.',
  },
  {
    num: '2.',
    title: 'Eligibility',
    body: 'The Portal is intended solely for eligible retail partners identified by Kwality Wall\'s. Participation does not automatically entitle any participant to receive rewards, gifts, incentives or benefits. Eligibility shall be determined solely by Kwality Wall\'s in accordance with applicable program rules. Further, any sales return within 30 days window will be deducted from the total achievement and consequently may result in the retailer becoming ineligible for the reward.',
  },
  {
    num: '3.',
    title: 'Information Submission',
    body: 'Users may be required to provide and/or verify information including name, mobile number, retailer details, delivery address, city, state, PIN code and gift preferences. Users represent that all information submitted is true, accurate, complete and up to date. Kwality Wall\'s and its authorized service providers shall not be responsible for delays, failed deliveries or incorrect fulfilment arising from inaccurate, incomplete or outdated information submitted by the user.',
  },
  {
    num: '4.',
    title: 'Gift Selection',
    body: 'Gift allocation is subject to eligibility verification, inventory availability and compliance with applicable program rules. Submission of a gift preference does not constitute confirmation of reward allocation. Kwality Wall\'s reserves the right to substitute rewards with equivalent alternatives in the event of stock unavailability or operational requirements.',
  },
  {
    num: '5.',
    title: 'Communication and Program Administration Consent',
    body: 'By accessing or using the Portal, the user authorizes Kwality Wall\'s and its authorized service providers to communicate regarding eligibility validation, gift selection reminders, address confirmation, reward fulfilment, delivery tracking, customer support and program administration through WhatsApp, SMS, voice calls, email or other electronic channels.',
  },
  {
    num: '6.',
    title: 'Personal Data and Privacy',
    body: 'For the purposes of the Digital Personal Data Protection Act, 2023, Kwality Wall\'s shall act as the Data Fiduciary and Gifsy Technologies Private Limited (\'Gifsy\') shall act solely as an authorized Data Processor. Personal information collected through the Portal shall be processed solely for loyalty program administration, participant verification, gift fulfilment, communication, fraud prevention, support, audit and legal compliance. Personal information may be shared with logistics partners, communication providers and technology vendors strictly for these purposes.',
  },
  {
    num: '7.',
    title: 'Express Consent',
    items: [
      'confirms that all information provided is accurate and complete;',
      'acknowledges having read and accepted these Terms & Conditions;',
      'voluntarily consents to the collection, storage, use, processing, verification and sharing of personal information for loyalty program administration, communication, gift selection and reward fulfilment;',
      'authorizes communications through WhatsApp, SMS, email and voice calls; and',
      'acknowledges that withdrawal of consent may impact participation in the program and reward fulfilment.',
    ],
    prefix: 'By clicking \'Submit\', \'Confirm\', \'Proceed\' or any similar action on the Portal, the user:',
    suffix: 'Electronic records of consent may be maintained for audit and compliance purposes.',
  },
  {
    num: '8.',
    title: 'Portal Journey and Reward Fulfilment Process',
    body: 'The user journey may include mobile verification, eligibility validation, review of eligible gift options, address confirmation, gift selection, enrollment confirmation and reward fulfilment. Reward fulfilment remains subject to eligibility verification, inventory availability, successful validation of participant information and compliance with applicable program rules.',
  },
  {
    num: '9.',
    title: 'User Rights',
    body: 'Subject to applicable law, users may request correction or updating of information and may seek withdrawal of consent by contacting support channels communicated by Kwality Wall\'s.',
  },
  {
    num: '10.',
    title: 'Data Retention',
    body: 'Personal information shall be retained only for as long as reasonably necessary to administer the program, complete fulfilment activities, resolve disputes and satisfy legal, regulatory, tax, audit and compliance requirements.',
  },
  {
    num: '11.',
    title: 'Fraud Prevention',
    body: 'Kwality Wall\'s reserves the right to verify participant information, reject duplicate submissions, disqualify fraudulent entries and suspend participation where misuse, manipulation or false information is suspected.',
  },
  {
    num: '12.',
    title: 'Limitation of Liability',
    body: 'Kwality Wall\'s and Gifsy shall not be liable for delays or failures arising from inaccurate information provided by users, inventory shortages, courier delays, network issues, force majeure events or circumstances beyond their reasonable control.',
  },
  {
    num: '13.',
    title: 'Intellectual Property',
    body: 'All content, trademarks, designs, logos and materials available on the Portal remain the property of Kwality Wall\'s or its licensors.',
  },
  {
    num: '14.',
    title: 'Modification of Program',
    body: 'Kwality Wall\'s reserves the right to modify, suspend, discontinue or terminate the Portal or the loyalty program at any time, subject to applicable law.',
  },
  {
    num: '15.',
    title: 'Governing Law and Jurisdiction',
    body: 'These Terms & Conditions shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts located in Mumbai, Maharashtra.',
  },
  {
    num: '16.',
    title: 'Contact',
    body: 'For any queries relating to the Portal, loyalty program, reward fulfilment or personal data processing, participants may contact the support channels communicated by Kwality Wall\'s from time to time.',
  },
];

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-gray-800">Terms &amp; Conditions</h1>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto">
        {/* Title block */}
        <div className="mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Kwality Wall&apos;s</p>
          <h2 className="text-lg font-bold text-gray-900 mt-1">Retailer Gift Selection Portal</h2>
          <p className="text-xs text-gray-400 mt-1">Please read these terms carefully before using the portal.</p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((s) => (
            <div key={s.num} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex gap-2 mb-2">
                <span className="text-sm font-bold text-[#E3000F] min-w-[1.5rem]">{s.num}</span>
                <h3 className="text-sm font-bold text-gray-800">{s.title}</h3>
              </div>
              {'body' in s && s.body && (
                <p className="text-sm text-gray-600 leading-relaxed ml-6">{s.body}</p>
              )}
              {'items' in s && s.items && (
                <div className="ml-6 space-y-1">
                  {s.prefix && (
                    <p className="text-sm text-gray-600 leading-relaxed mb-2">{s.prefix}</p>
                  )}
                  <ol className="list-none space-y-1">
                    {s.items.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 leading-relaxed flex gap-2">
                        <span className="text-gray-400 min-w-[1rem]">({String.fromCharCode(97 + i)})</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                  {s.suffix && (
                    <p className="text-sm text-gray-600 leading-relaxed mt-2">{s.suffix}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs text-amber-800 leading-relaxed">
            By proceeding to use the portal and submitting your details, you confirm that you have read, understood and agreed to these Terms &amp; Conditions.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-4">
          Kwality Wall&apos;s · Gifsy Technologies Private Limited
        </p>
      </div>
    </div>
  );
}
