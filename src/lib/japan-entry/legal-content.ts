import type { LegalSection } from "@/lib/legal-content"

/** Japan Market Entry Support Service 専用利用規約（英語正本）。 */
export const JAPAN_ENTRY_TERMS_SECTIONS: readonly LegalSection[] = [
  {
    title: "Introduction",
    body: [
      "Last Updated: June 12, 2026",
      "Welcome to the Japan Market Entry Support Service (hereinafter referred to as the \"Company,\" \"we,\" \"us,\" or \"our\"). These Terms of Service (\"Terms\") govern your access to and use of our website, translation, cultural adaptation, and subscription-based social media management services (collectively, the \"Services\"). By accessing our website or purchasing our Services, you (the \"Client\") agree to be bound by these Terms.",
    ],
  },
  {
    title: "Section 1: Description of Services",
    body: [
      "The Company provides highly specialized localization and social media management services tailored exclusively for foreign businesses entering the Japanese market. Our Services are categorized into three core types:",
      "One-Time Translation Service: High-quality text translation from English to Japanese. The Company explicitly guarantees that all translations are performed strictly by native human professionals. Generative AI tools are absolutely not used in our translation workflow.",
      "Cultural Adaptation Service: Conceptual modification and cultural localization of original client documents, including but not limited to corporate messaging, privacy policies, and terms of service, to ensure alignment with Japanese social, cultural, and commercial business norms.",
      "Subscription-Based SMM Service: Ongoing, monthly recurring social media management, content creation, and localization support for the Client's Japanese-targeted social media accounts.",
    ],
  },
  {
    title: "Section 2: Legal Disclaimer & Non-Legal Advice",
    body: [
      "No Legal Services: The Cultural Adaptation Service provided by the Company (including the adaptation of privacy policies, terms of service, or commercial disclosures) is intended solely for linguistic, cultural, and marketing localization purposes. The Company is NOT a law firm, does not practice law, and does not provide formal legal advice, legal services, or legal opinions.",
      "Client Responsibility: The Company does not guarantee that the adapted documents strictly comply with current Japanese laws, regulations, or statutory requirements.",
      "Assumption of Risk: The Client acknowledges and agrees that the use of any localized document or policy is at their own sole risk. The Client is strongly advised to consult with a qualified attorney or legal professional in Japan to ensure formal legal compliance prior to using any localized documents commercially. The Company shall not be liable for any legal disputes, penalties, or damages arising from the use of our localized content.",
    ],
  },
  {
    title: "Section 3: Communication Channels & Operational Limitations",
    body: [
      "To ensure maximum operational efficiency, security, and quality control, the Company strictly limits its communication channels as follows:",
      "Email-Only Standard Communication: All standard project communications, inquiries, deliveries, and updates between the Company and the Client shall be conducted exclusively via text-based Email. The Company does not offer, participate in, or accept voice calls, video conferences (e.g., Zoom, Google Meet), or telephone support under any circumstances.",
      "Discord Exception for Premium Subscribers: Clients currently enrolled in and paying for the \"Premium Plan\" of our subscription service are granted exclusive access to a dedicated Discord server for ongoing, text-based project communication. No voice or video communication will be conducted on Discord.",
      "Refusal of Service: The Company reserves the right to immediately terminate the project or subscription without a refund if the Client repeatedly demands video/voice consultations or breaches this communication policy.",
    ],
  },
  {
    title: "Section 4: Fees, Subscriptions, & Refund Policy",
    body: [
      "One-Time Services: Fees for one-time translation or cultural adaptation services must be paid in full upfront before any work commences.",
      "Subscription Services: Subscription-based SMM Services are billed in advance on a monthly recurring cycle. Subscriptions automatically renew unless cancelled by the Client prior to the next billing date.",
      "Strict No-Refund Policy: Due to the customized, human-labor-intensive nature of our localized services, all fees paid to the Company are strictly non-refundable. Once translation or localization work has commenced, or a subscription cycle has begun, no refunds will be issued for any reason, including early termination of the project by the Client.",
    ],
  },
  {
    title: "Section 5: Intellectual Property Rights",
    body: [
      "Deliverables: Upon full and final payment of all outstanding fees, the intellectual property rights of the final Japanese localized text or content delivered to the Client shall be transferred to the Client.",
      "Retained Rights: The Company retains all intellectual property rights in its proprietary methods, templates, software, and tools used to generate the deliverables.",
    ],
  },
  {
    title: "Section 6: Limitation of Liability",
    body: [
      "To the maximum extent permitted by applicable law, the Company shall not be liable to the Client or any third party for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or business opportunities, arising out of or relating to the use of our Services, even if the Company has been advised of the possibility of such damages. In no event shall the Company's total aggregate liability exceed the total amount actually paid by the Client to the Company for the specific service giving rise to the claim.",
    ],
  },
  {
    title: "Section 7: Governing Law & Jurisdiction",
    body: [
      "These Terms and any separate agreements whereby we provide you Services shall be governed by and construed in accordance with the laws of Japan, without regard to its conflict of law principles. Any legal action, suit, or proceeding arising out of or relating to these Terms shall be instituted exclusively in the courts of Tokyo, Japan.",
    ],
  },
  {
    title: "Section 8: Changes to Terms of Service",
    body: [
      "The Company reserves the right, at its sole discretion, to update, change, or replace any part of these Terms by posting updates and changes to our website. It is the Client's responsibility to check our website periodically for changes. Your continued use of or access to our Services following the posting of any changes to these Terms constitutes acceptance of those changes.",
    ],
  },
  {
    title: "Section 9: Contact Information",
    body: [
      "Questions about these Terms of Service or any initial inquiries should be submitted exclusively through our Official Contact Form available on our website. The Company will respond to valid inquiries via text-based email in accordance with Section 3 of these Terms.",
    ],
  },
] as const

/** Japan Market Entry Support Service 専用プライバシーポリシー（英語正本）。 */
export const JAPAN_ENTRY_PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    title: "Introduction",
    body: [
      "Last Updated: June 12, 2026",
      "The Japan Market Entry Support Service (hereinafter referred to as the \"Company,\" \"we,\" \"us,\" or \"our\") is committed to protecting the privacy and security of the personal data of our international clients (the \"Client,\" \"you,\" or \"your\"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or utilize our translation, cultural adaptation, and subscription-based social media management services.",
    ],
  },
  {
    title: "Section 1: Information We Collect",
    body: [
      "We only collect information that is strictly necessary to fulfill our business obligations and deliver our high-quality, human-driven Services.",
      "Information Provided via Official Contact Form: When you submit an inquiry through our Official Contact Form, we collect your name, company name, email address, website URL, and any specific project details or text you choose to provide.",
      "Onboarding and Project Data: For clients moving forward with our Services, we collect necessary commercial data, project files, original English text, brand assets, and platform access credentials (only if required for subscription-based SMM Services).",
      "Communication Data: We retain records of your text-based communications with us via Email and, if applicable, our dedicated Discord server for Premium subscribers.",
    ],
  },
  {
    title: "Section 2: How We Use Your Information",
    body: [
      "We use the collected data strictly for the following operational purposes:",
      "To process, analyze, and reply to inquiries submitted via our Official Contact Form.",
      "To deliver our human-generated translation, cultural adaptation, and social media management services.",
      "To manage client accounts, process subscription billings, and send operational updates.",
      "To communicate with you regarding project deliverables, timelines, or changes to our Terms of Service.",
      "To comply with applicable legal obligations or resolve potential disputes.",
    ],
  },
  {
    title: "Section 3: Human-Only Workflow & Data Security",
    body: [
      "Strict No-AI Clause: The Company prides itself on providing 100% human-generated localization. We guarantee that your proprietary text, internal documents, and brand data are never fed into, processed by, or shared with Generative AI tools or large language models. This eliminates the risk of your sensitive business information leaking into public AI training datasets.",
      "Data Minimization and Security: We implement appropriate technical and organizational measures to protect your data from unauthorized access, loss, or alteration. Access to your project files is strictly limited to the native human professionals directly handling your project.",
    ],
  },
  {
    title: "Section 4: Data Retention & Channels",
    body: [
      "Communication Logs: In alignment with Section 3 of our Terms of Service, all interactions are strictly text-based. Email threads and Premium Discord chat logs are securely retained to ensure quality control and proof of project delivery.",
      "Deletion Policy: Upon completion of a one-time project or termination of a subscription, the Client may request the permanent deletion of their raw source files. The Company will comply within thirty (30) days, except for historical communication logs required for accounting, tax, or legal defense purposes.",
    ],
  },
  {
    title: "Section 5: Sharing and Disclosure of Data",
    body: [
      "The Company does not sell, rent, trade, or share your personal information with third-party marketers. Your data is only shared under the following strict conditions:",
      "Third-Party Subcontractors: We may share project files with trusted native human freelancers or contractors who work under strict confidentiality agreements solely to execute the localization or SMM tasks.",
      "Legal Requirements: We may disclose your information if required to do so by Japanese law or in response to valid legal requests by public authorities.",
    ],
  },
  {
    title: "Section 6: International Data Transfers",
    body: [
      "As we specialize in supporting foreign businesses entering Japan, your personal data will be transferred to and processed in Japan. By submitting your information via our Official Contact Form, you consent to this transfer, storage, and processing in accordance with Japanese data protection practices.",
    ],
  },
  {
    title: "Section 7: Client Rights",
    body: [
      "Depending on your jurisdiction (such as the EU/UK GDPR or US State Privacy Laws), you may have the right to request access to, correction of, or deletion of the personal data we hold about you. To exercise these rights, please submit a formal request through our Official Contact Form.",
    ],
  },
  {
    title: "Section 8: Changes to This Privacy Policy",
    body: [
      "The Company reserves the right to modify this Privacy Policy at any time. Any changes will be posted immediately on this page with an updated \"Last Updated\" date. Your continued use of our website or Services after changes are posted constitutes your explicit acceptance of the revised policy.",
    ],
  },
  {
    title: "Section 9: Contact Us",
    body: [
      "If you have any questions or concerns regarding this Privacy Policy or how your personal data is handled, please reach out to us exclusively through our Official Contact Form available on our website.",
    ],
  },
] as const

export function getJapanEntryTermsSections(): readonly LegalSection[] {
  return JAPAN_ENTRY_TERMS_SECTIONS
}

export function getJapanEntryPrivacySections(): readonly LegalSection[] {
  return JAPAN_ENTRY_PRIVACY_SECTIONS
}
