import type { Locale } from "@/lib/i18n/locales"

export type LegalSection = { title: string; body: string[] }

/** GritVib（人間チャットサービス）専用の利用規約（日本語正本）。 */
export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    title: "第1条（目的および本サービスの性質）",
    body: [
      "1. 本規約は、GritVib（東沙羅を中心とする運営チーム。以下、総称して「運営者」といいます）が提供する、1対1の人間による対話・チャットサービス「HITO」（以下「本サービス」といいます）の利用条件を定めるものです。",
      "2. 本サービスは、AI等の自動生成ツールに頼らず、運営者のチームメンバー（生身の人間）が1対1でテキストのやり取りを行う属人的かつ実験的なサービスです。",
      "3. 利用者は、運営の効率化および持続可能性の観点から、対話を担当するメンバーが状況に応じて随時変更される（常に同一の担当者が対応するわけではない）ことをあらかじめ承諾するものとします。なお、担当者の割り当ては運営者の裁量によるものとし、利用者が特定の担当者を指定または固定することはできません。",
      "4. 本サービスは、人間による丁寧な役務提供の品質を維持するため、登録ユーザー数に上限（定員）を設ける定員制度を採用しています。運営者は、利用者の承諾や事前の公表なく、独自の裁量によりいつでも定員数を変更（増減）できるものとします。",
      "5. 解約による欠員の発生や定員の増枠に伴い、新規ユーザーの受付を再開する場合であっても、運営者から個別の利用者または希望者に対して、受付再開に関する案内の通知や先行予約の受付等は一切行いません。",
    ],
  },
  {
    title: "第2条（運営上の免責および承諾事項）",
    body: [
      "利用者は、本サービスが「人間による手作業の役務提供」である性質上、以下の各号をあらかじめ承諾のうえで利用するものとし、これらを理由とする苦情の申し立てや契約解除は行えないものとします。",
      "(1) 24時間即時の対応義務は負いません。運営チームの業務状況、睡眠、体調等の事情により、返信までに時間を要する場合があります。",
      "(2) 本サービスは全知全能の正論や、特定の課題解決を保証するものではありません。運営者は、その裁量に基づき「わからない」「答えたくない」といった発言、または発言をしない自由を有します。",
      "(3) 運営者と利用者は対等な人間としての対話を行うものとし、運営者（その都度対応する担当メンバーを含む）は必ずしも敬語やビジネス的な文体を使用する義務を負わないものとします。また、担当者の変更に伴い、対話の文体や雰囲気が変化する場合があることを利用者はあらかじめ承諾するものとします。",
    ],
  },
  {
    title: "第3条（仕様の制限およびデータの削除）",
    body: [
      "1. 本サービスには、プッシュ通知、バッジ表示、メール等による新規受付再開の案内を含め、あらゆる通知機能はいっさい搭載されていません。利用者は、自身で本サービスにアクセスし、その時に表示されている内容のみを確認するものとします。",
      "2. 本サービス上のメッセージは、利用者の操作によりいつでも消去できます。運営者は過去のログを永続的に保存する義務を負わず、データ消失等について一切の責任を負いません。",
    ],
  },
  {
    title: "第4条（利用料金および返金不可の原則）",
    body: [
      "1. 本サービスの利用料金は、月額 3,000円（税込）とします。",
      "2. 決済は Stripe, Inc. が提供する決済システムを利用して行われます。",
      "3. 本サービスは、決済完了と同時に役務提供（チャット可能な状態の付与）が開始される性質上、法律上のクーリング・オフの対象外となります。理由の如何を問わず、支払われた利用料金の返金、および日割り計算による精算は一切行いません。",
      "4. サブスクリプションプランの解約は、次回決済日の前日までにシステム内（または運営者指定の方法）にて利用者自身が解約手続きを行うものとします。",
      "5. 利用者は、決済の際にStripeの画面においてクレジットカード名義等の会員情報を入力することに同意するものとします。運営者は、当該決済情報を本サービスのサブスクリプション管理および本人確認・問い合わせ対応の目的にのみ使用し、日々のチャット対応において運営者が利用者の実名を閲覧・利用することはありません。",
    ],
  },
  {
    title: "第5条（禁止事項および利用停止・発言権の制限）",
    body: [
      "1. 利用者は、運営者（運営メンバー個人を含む）に対する嫌がらせ、誹謗中傷、脅迫、公序良俗に反する発言、または本サービスの運営を妨げる行為を行ってはなりません。",
      "2. 利用者が前項に違反した場合、または運営者が「これ以上人間としての対話の継続が困難である」と客観的・主観的に判断した場合、運営者は事前通知なく該当利用者への発言を拒否し、アカウントの利用停止、または強制解約の措置をとることができるものとします。この場合であっても、既入金分の返金は行いません。",
    ],
  },
  {
    title: "第6条（サービスの終了・廃止）",
    body: [
      "運営者は、チームの個人的事由、疾病、または事業継続が困難と判断した場合、いつでも本サービスを終了または廃止できるものとします。サービスを完全廃止する場合、運営者はそれ以降の自動課金を停止するものとし、過去の既決済分についての返金義務は負わないものとします。",
    ],
  },
  {
    title: "第7条（準拠法および管轄裁判所）",
    body: [
      "1. 本規約の解釈および適用にあたっては、日本法を準拠法とします。",
      "2. 本サービスに関して万一紛争が生じた場合は、運営者の所在地（代表者：東沙羅の所在地）を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします。",
    ],
  },
] as const

/** GritVib（人間チャットサービス）専用のプライバシーポリシー（日本語正本）。 */
export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    title: "1. 個人情報の収集および外部ツールの利用について",
    body: [
      "本サービスでは、アカウント登録、認証、および運用のために、以下の最小限の情報のみを収集します。また、データの安全な保管と管理のため、米国Supabase, Inc.が提供するバックエンドプラットフォーム（Supabase）を利用してデータを暗号化のうえ保存します。",
      "(1) アカウント情報：メールアドレス、ニックネーム、パスワード",
      "(2) 決済関連情報：クレジットカード名義、カード情報等（※これらの情報は決済代行会社 Stripe, Inc. が直接取得・管理します。運営者はStripeの管理画面を通じて名義やメールアドレスを閲覧できますが、本サービスのサーバーやSupabaseには保存されません）",
      "(3) サービス利用情報：チャットメッセージ、お問い合わせ内容",
    ],
  },
  {
    title: "2. 決済情報とチャットアカウントの分離（匿名性の維持）",
    body: [
      "1. 本サービスは、生身の人間同士が匿名性を保って対話を行う場所です。日々のチャット対応において、運営者（担当メンバーを含む）の画面には利用者のニックネームのみが表示され、Stripe上の決済情報（実名・クレジットカード名義等）が表示されることはありません。",
      "2. 運営者は、サブスクリプションの管理、本人確認、または利用者から決済に関する問い合わせを受けた場合など、業務上不可欠な場合を除き、決済情報とチャットアカウントを照合・閲覧することはありません。",
      "3. 利用者は、チャットメッセージ内において、本名、住所、電話番号、勤務先、SNSのアカウント名などの個人を特定できる情報を記載してはならないものとします。万一記載された場合、運営者は事前の通知なく当該メッセージを削除することがあります。",
    ],
  },
  {
    title: "3. 利用目的",
    body: [
      "収集した情報は、以下の目的の範囲内でのみ利用します。",
      "(1) 本サービスの提供・運営（アカウント管理、ログイン認証）",
      "(2) サブスクリプション決済の処理、管理、および本人確認",
      "(3) 決済等に関するお問い合わせ対応および重要なお知らせの通知",
    ],
  },
  {
    title: "4. 第三者提供および委託",
    body: [
      "本サービスは、法令に基づく場合を除き、利用者の同意なく個人情報を第三者に提供しません。ただし、サービスの円滑な提供および決済処理のため、以下の信頼できる外部サービスに情報の処理を委託・連携します。",
      "(1) 決済処理：Stripe, Inc.（月額料金の決済処理のため）",
      "(2) データ保管・認証：Supabase, Inc.（アカウント認証およびチャットデータの安全な保管のため）",
    ],
  },
  {
    title: "5. データの「人間による学習」について",
    body: [
      "本サービスで取得したチャット情報は、AI（人工知能）の学習には一切使用されません。ただし、運営者という「人間」により深く学習されます。",
    ],
  },
  {
    title: "6. データの保管と消去",
    body: [
      "1. チャットメッセージは、利用者の操作によっていつでも完全に消去することができます。運営者が過去のログを永続的にバックアップ・保存することはありません。",
      "2. アカウントを解約・削除した場合、登録されたメールアドレス等の情報は速やかに破棄されます。",
    ],
  },
  {
    title: "7. お問い合わせ先",
    body: [
      "個人情報の取扱いに関するお問い合わせは、本サービス内のお問い合わせフォームより運営者宛てにご連絡ください。",
      "運営者名: GritVib（代表者：東 沙羅）",
      "所在地: 〒150-0043 東京都渋谷区道玄坂1丁目10番渋谷道玄坂東急ビル2F-C",
    ],
  },
  {
    title: "8. 改定",
    body: [
      "本ポリシーは必要に応じて改定することがあります。改定後の内容は本サービス上に掲載した時点で効力を生じるものとします。",
    ],
  },
] as const

/** HITO（GritVib 運営）専用の利用規約（英語版）。 */
export const TERMS_SECTIONS_EN: readonly LegalSection[] = [
  {
    title: "Article 1 (Purpose and Nature of the Service)",
    body: [
      "These Terms of Service (the \"Terms\") set forth the conditions for using \"HITO\", a one-to-one human conversation and chat service (the \"Service\") provided by GritVib (an operations team centered on Sara Azuma; collectively, the \"Operator\").",
      "The Service is a personal and experimental offering in which team members of the Operator (real human beings) engage in one-to-one text exchanges without relying on AI or other automated generation tools.",
      "For operational efficiency and sustainability, Users acknowledge in advance that the team member who handles a conversation may change from time to time depending on circumstances (the same person will not always respond). Assignment of team members is at the Operator's discretion, and Users may not designate or fix a particular person in charge.",
      "To maintain the quality of carefully delivered human services, the Service adopts a capacity system that sets an upper limit on the number of registered users. The Operator may increase or decrease the capacity at any time at its sole discretion without User consent or prior public notice.",
      "Even when acceptance of new users resumes due to vacancies from cancellations or an increase in capacity, the Operator will not send any notice of reopening to individual Users or prospective users, nor accept advance reservations or similar arrangements.",
    ],
  },
  {
    title: "Article 2 (Operational Disclaimers and Acknowledgments)",
    body: [
      "Given that the Service consists of manually performed services by humans, Users shall use the Service only after acknowledging each of the following in advance, and may not file complaints, seek damages, or terminate the contract on the grounds set forth below.",
      "(1) The Operator does not assume an obligation to respond immediately 24 hours a day. Replies may take time due to the operations team's work schedule, sleep, health, or similar circumstances.",
      "(2) The Service does not guarantee omniscient correctness or the resolution of any particular problem. The Operator may, at its discretion, state that they \"do not know,\" \"do not wish to answer,\" or choose not to speak at all.",
      "(3) The Operator and the User engage in dialogue as equal human beings, and the Operator (including whichever team member responds at the time) is not obligated to use honorific language or a business-like writing style. Users also acknowledge in advance that the tone and atmosphere of dialogue may change when the person in charge changes.",
    ],
  },
  {
    title: "Article 3 (Disclaimer of Warranties and Limitation of Liability)",
    body: [
      "1. THE SERVICE IS PROVIDED ON AN \"AS IS\" AND \"AS AVAILABLE\" BASIS. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE OPERATOR EXPRESSLY DISCLAIMS ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.",
      "2. IN NO EVENT SHALL THE OPERATOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.",
      "3. THE OPERATOR'S TOTAL LIABILITY FOR ANY CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE TOTAL AMOUNT PAID BY THE USER TO THE OPERATOR FOR THE SERVICE IN THE ONE (1) MONTH IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO LIABILITY.",
    ],
  },
  {
    title: "Article 4 (Feature Limitations and Deletion of Data)",
    body: [
      "The Service does not include any notification features whatsoever, including push notifications, badge displays, or email notices regarding the reopening of acceptance for new users. Users shall access the Service on their own and confirm only the content displayed at that time.",
      "Messages on the Service may be deleted at any time by User action. The Operator is not obligated to retain past logs permanently and assumes no responsibility whatsoever for loss of data or similar events.",
    ],
  },
  {
    title: "Article 5 (Fees, No-Refund Policy, and Data Processing)",
    body: [
      "The fee for the Service is USD 30 per month.",
      "Payment is processed through the payment system provided by Stripe, Inc.",
      "Because performance of the Service (granting access to chat) begins upon completion of payment, the Service is not subject to statutory cooling-off rights or any equivalent consumer withdrawal rights under applicable local laws. For any reason whatsoever, paid fees will not be refunded, and no prorated settlement will be made.",
      "Cancellation of a subscription plan must be completed by the User by the day before the next billing date through the system (or by a method designated by the Operator).",
      "Users agree to enter membership information such as the name on the credit card on Stripe's payment screen when making payment. The Operator uses such payment information only for subscription management of the Service and identity verification or responses to inquiries, and does not view or use Users' real names in day-to-day chat support. By using the Service, Users acknowledge and agree that their payment data will be processed by Stripe, Inc. and may be transferred to and stored in jurisdictions outside their country of residence, including Japan.",
    ],
  },
  {
    title: "Article 6 (Prohibited Acts, Suspension, and Restriction of the Right to Speak)",
    body: [
      "Users shall not engage in harassment, defamation, threats, statements contrary to public order and morals, or any act that interferes with operation of the Service against the Operator (including individual operations team members).",
      "If a User violates the preceding paragraph, or if the Operator objectively or subjectively determines that continuing human dialogue has become difficult, the Operator may, without prior notice, refuse to accept messages from that User, suspend the account, or forcibly cancel the subscription. Even in such cases, no refund will be made for amounts already paid.",
    ],
  },
  {
    title: "Article 7 (Termination or Discontinuation of the Service)",
    body: [
      "The Operator may terminate or discontinue the Service at any time due to the team's personal circumstances, illness, or a determination that continuing the business is difficult. If the Service is completely discontinued, the Operator shall stop further automatic billing thereafter and shall not be obligated to refund past payments already settled.",
    ],
  },
  {
    title: "Article 8 (Governing Law and Jurisdiction)",
    body: [
      "These Terms shall be governed by and construed in accordance with the laws of Japan.",
      "If any dispute arises in connection with the Service, the district court having jurisdiction over the Operator's location (the location of the representative, Sara Azuma) shall be the exclusive court of first instance by agreement.",
    ],
  },
] as const

/** HITO（GritVib 運営）専用のプライバシーポリシー（英語版）。 */
export const PRIVACY_SECTIONS_EN: readonly LegalSection[] = [
  {
    title: "1. Collection of Personal Information and Use of External Tools",
    body: [
      "For account registration, authentication, and the operation of \"HITO\" (the \"Service\"), we collect only the minimum necessary information. For the secure storage and management of data, we utilize external platform services and store data with industry-standard encryption.",
      "Account Information: Email address, nickname, and password. (Processed and secured via Supabase, Inc.)",
      "Payment-Related Information: Name on the credit card, card information, and billing details. Note: This information is collected, processed, and managed directly by our third-party payment processor, Stripe, Inc. The Operator (GritVib, represented by Sara Azuma; collectively, the \"Operator\") may view registered names and email addresses through Stripe's dashboard for management purposes, but this data is never stored on the Service's primary servers or within Supabase.",
      "Service Usage Information: Chat messages and inquiry content.",
    ],
  },
  {
    title: "2. Separation of Payment Information and Chat Accounts (Maintaining Anonymity)",
    body: [
      "The Service is a platform designed for real human beings to converse while preserving anonymity. In day-to-day chat support, only the User's chosen nickname is displayed on screens used by the Operator (including team members in charge); payment information on Stripe (such as real names or credit card billing names) is not visible during regular chat operations.",
      "Except where operationally necessary—such as subscription management, identity verification, or when responding to a direct inquiry regarding payments—the Operator does not cross-reference or view payment information together with chat accounts.",
      "Users must not include personally identifiable information (PII) in chat messages, including real names, physical addresses, phone numbers, employers, or social media account names. If such information is posted, the Operator reserves the right to delete the relevant message without prior notice to protect User privacy.",
    ],
  },
  {
    title: "3. Purpose of Use",
    body: [
      "Collected information is used strictly for the following limited purposes:",
      "Provision and operation of the Service (account management and secure login authentication).",
      "Processing and management of subscription payments, and identity verification.",
      "Responding to inquiries regarding payments and sending critical operational notices.",
    ],
  },
  {
    title: "4. Provision to Third Parties, Outsourcing, and International Data Transfers",
    body: [
      "Except as required by applicable law, the Service does not provide personal information to third parties without the User's explicit consent. To ensure smooth operation and payment processing, we entrust information processing to the following trusted external services:",
      "Payment Processing: Stripe, Inc. (United States) – For monthly subscription billing management.",
      "Data Storage and Authentication: Supabase, Inc. (United States) – For account authentication and secure storage of encrypted chat data.",
      "International Data Transfers: By using the Service, Users acknowledge and agree that their personal information may be transferred to, stored, and processed in jurisdictions outside their country of residence, including Japan and the United States. The Operator ensures that all such transfers comply with applicable data protection laws through secure transfer mechanisms.",
    ],
  },
  {
    title: "5. Cookies and Technical Data",
    body: [
      "The Service may use cookies, local storage, or similar technologies solely for essential technical functions, such as maintaining User login sessions and authentication states. We do not use these technologies for behavioral advertising or third-party tracking.",
    ],
  },
  {
    title: "6. \"Learning by Humans\" Regarding Data",
    body: [
      "Chat information obtained through the Service is strictly NOT used for AI (artificial intelligence) or machine learning in any form. However, to deliver deeper and more empathetic communication, it is learned and understood more deeply by the Operator as a human being.",
    ],
  },
  {
    title: "7. Storage, Deletion, and User Rights",
    body: [
      "Data Deletion: Chat messages may be completely and permanently deleted at any time by the User's own action within the interface. The Operator does not permanently back up or retain past chat logs once deleted.",
      "Account Termination: When an account is canceled or deleted, registered information such as the email address is promptly and securely discarded from active databases.",
      "Your Legal Rights: Depending on your jurisdiction (such as the EU/EEA under GDPR or various US state laws), you may have the right to access, correct, restrict, or request the deletion of your personal data. To exercise any of these rights, please contact us using the information provided below.",
    ],
  },
  {
    title: "8. Contact",
    body: [
      "For inquiries regarding this Privacy Policy or the handling of personal information, please contact the Operator via the inquiry form within the Service.",
      "Operator Name: GritVib (Representative: Sara Azuma)",
      "Address: 2F-C Shibuya Dogenzaka Tokyu Bldg., 1-10-8 Dogenzaka, Shibuya-ku, Tokyo, 150-0043, Japan",
    ],
  },
  {
    title: "9. Revisions",
    body: [
      "This Privacy Policy may be revised as needed to reflect changes in legal requirements or operational practices. Revised content becomes effective immediately upon being posted on the Service.",
    ],
  },
] as const

export function getTermsSections(locale: Locale): readonly LegalSection[] {
  return locale === "en" ? TERMS_SECTIONS_EN : TERMS_SECTIONS
}

export function getPrivacySections(locale: Locale): readonly LegalSection[] {
  return locale === "en" ? PRIVACY_SECTIONS_EN : PRIVACY_SECTIONS
}

