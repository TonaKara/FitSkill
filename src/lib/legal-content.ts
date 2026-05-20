import { ALLOWED_EXTERNAL_TOOLS_LIST } from "@/lib/allowed-external-tools"
import type { Locale } from "@/lib/i18n/locales"

export type LegalSection = { title: string; body: string[] }

const ALLOWED_EXTERNAL_TOOLS_LIST_EN = "Zoom, YouTube, Discord"

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    title: "第1条（目的および適用）",
    body: [
      "本規約は、東沙羅（以下「運営者」といいます）が提供する個人ストアプラットフォーム「GritVib」および関連する一切のサービス（以下「本サービス」といいます）の利用条件を定めるものです。利用者は本規約に同意したうえで本サービスを利用するものとし、同意しない場合は利用できません。",
    ],
  },
  {
    title: "第2条（定義）",
    body: [
      "「本サービス」とは、個人が自身のスキルやデジタルコンテンツを販売する「ストア」を開設し、当該スキル等を出品・販売する「出品者」と、それを購入する「購入者」とのマッチングおよび取引の場を提供するプラットフォームを指します。",
      "「利用者」とは、出品者および購入者を含む、本サービスを利用するすべての個人または法人を指します。",
      "「取引」とは、本サービスを通じて出品者と購入者の間で成立する、スキルやコンテンツの売買契約を指します。",
    ],
  },
  {
    title: "第3条（サービスの性質）",
    body: [
      "本サービスは、利用者間の取引の「場」を提供するのみであり、運営者は取引の当事者ではありません。出品されるスキルの品質、適法性、正確性、または出品者の経歴等について運営者は一切保証しません。取引契約は、出品者と購入者の間で直接成立します。",
    ],
  },
  {
    title: "第4条（利用資格）",
    body: [
      "18歳未満の利用者は、本サービスの利用にあたり保護者の同意を必要とします。",
      "対面での直接指導を伴うスキルの出品および購入は、18歳未満の利用者は行えないものとします。",
      "反社会勢力、またはそれに準ずる者による本サービスの利用を一切禁止します。",
    ],
  },
  {
    title: "第5条（事前オファーと取引）",
    body: [
      "本サービスは、出品者が購入者を選定または事前に取引内容を確認できる「事前オファー（相談リクエスト）」機能を備えています。",
      "出品者が事前オファー設定を行っている場合、購入者は出品者の承認を得ることで初めて該当スキルの購入権を取得できます。",
      "運営者は、事前オファーの承認の可否に関する判断、およびその遅延について一切介入せず、責任を負いません。",
    ],
  },
  {
    title: "第6条（禁止事項）",
    body: [
      "利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。",
      "虚偽の経歴、実績、または出品内容の記載",
      "本サービスを介さない直接取引（中抜き行為）への誘導、またはそれに応じる行為",
      `運営者が指定する外部ツール（${ALLOWED_EXTERNAL_TOOLS_LIST}等）以外の外部サービスへの誘導、およびそれを利用した直接的な金銭の授受`,
      "本サービスを通じた決済以外の方法による金銭の徴収",
      "詐欺行為、虚偽表示、その他公序良俗に反する行為",
      "性的、わいせつ的、または性的な興奮を誘発する内容の出品および取引",
      "過度な露出、身体の部位を強調する写真、または指導目的を超えた不適切な画像・動画の投稿",
      "本サービスのネットワーク、システム、ソフトウェア等に対するリバースエンジニアリング、逆アセンブル、逆コンパイル、修正、改変その他の解析行為",
      "本サービスを模倣したサービスの開発・提供を目的とした利用、または本サービスに含まれる知的財産権を侵害する行為",
      "その他、運営者が不適切と判断する行為",
    ],
  },
  {
    title: "第7条（外部ツールの利用）",
    body: [
      `利用者は、取引の履行にあたり${ALLOWED_EXTERNAL_TOOLS_LIST}等の外部ツールを連携・利用することができます。ただし、当該外部ツールの利用に起因するアカウント停止、接続不良、規約違反等のトラブルについて、運営者は一切の責任を負いません。`,
    ],
  },
  {
    title: "第8条（対面指導に関する注意と自己責任）",
    body: [
      "取引内容に基づき、利用者間で対面による直接指導を行う場合、必ず公共の安全な場所で実施するものとし、夜間・密室など危険を伴う場所での実施を禁止します。",
      "対面指導の実施に伴う事故、怪我、その他の損害または利用者間のトラブルについて、運営者は一切責任を負わず、すべて当事者間で解決するものとします。",
    ],
  },
  {
    title: "第9条（取引責任とキャンセル）",
    body: [
      "スキルやコンテンツの提供方法、メッセージや成果物、動画・写真・その他ファイルのやり取り等は、当事者間で誠実に合意し履行するものとします。",
      "売買契約成立後、利用者の自己都合によるキャンセルや返金請求は認められません。",
      "提供された商品（スキル）に不備や不一致がある場合、当事者間で誠実に協議のうえ解決するものとします。",
      "取引代金の振込手続きは、取引の完了が運営者の管理システムで確認された後に開始されます。出品者は、取引完了後、自身の Stripe アカウント上で売上金が支払可能となるまで待機する必要があることに同意するものとします。",
    ],
  },
  {
    title: "第10条（知的財産権および投稿コンテンツの取扱い）",
    body: [
      "本サービスを構成するすべてのプログラム、ソフトウェア、商標（「GritVib」等）、ロゴ、デザイン、および運営者が作成したテキスト・画像等の知的財産権は、すべて運営者または正当な権限を持つ第三者に帰属します。",
      "利用者が本サービス内に投稿した動画、画像、テキスト、ファイル等のコンテンツ（以下「投稿コンテンツ」といいます）の著作権は、当該コンテンツを作成した利用者に帰属します。",
      "利用者は、投稿コンテンツについて、運営者に対し、本サービスの提供、運営、および広告宣伝のために必要な範囲（システムのサーバーへの保存、利用者間での表示・配信等）で、無償かつ非独占的に利用する権利を許諾するものとします。",
      "運営者は、投稿コンテンツが本規約に違反していると判断した場合、事前通知なく削除等の措置をとることができます。",
      "運営者は、利用者のプライバシー保護およびシステムのデータ容量最適化のため、取引完了から一定期間経過後、チャット上の投稿コンテンツを自動的に削除することがあります。利用者は必要に応じて各自で保存を行うものとし、削除に起因する損害について運営者は責任を負いません。",
    ],
  },
  {
    title: "第11条（決済・手数料および本人確認）",
    body: [
      "本サービスにおける決済は、決済代行会社である Stripe のシステム（Stripe Connect）を利用して行われます。",
      "利用者間の取引代金は、出品者の Stripe Connect アカウントに対して直接支払われます。運営者は、取引代金の受領代理人ではなく、また決済代金を預かるものではありません。",
      "【本人確認の義務】出品者は、売上金を受け取るにあたり、Stripe社の定めに従い、本人確認書類の提出および審査の完了を行う義務を負います。本人確認が完了しない場合、Stripeアカウント内の売上金の引き出し（銀行振込）が行えないこと、およびアカウントの利用が制限される場合があることを出品者はあらかじめ承諾するものとします。",
      "本サービスにおける取引成立時、出品者は販売価格に対し15%のプラットフォーム利用手数料を支払うものとします。当該手数料は、決済時に Stripe のシステムを通じて自動的に差し引かれます。",
      "出品者への報酬の振込（入金）については、Stripe が定める規約および、出品者が自身の Stripe アカウントで設定した入金スケジュールに従うものとします。運営者は振込の実行や遅延について一切責任を負いません。",
    ],
  },
  {
    title: "第12条（出品削除・利用停止）",
    body: [
      "規約違反、他ユーザーからの通報多数、または安全確保上必要と判断した場合、運営者は事前通知なく該当出品の削除やアカウントの利用停止、開設されたストアの閉鎖措置を行うことができます。",
    ],
  },
  {
    title: "第13条（免責事項および健康上の注意）",
    body: [
      "運営者は、本サービスを通じて行われる取引の当事者とはならず、契約の履行、提供されるスキルの品質や成果物の状態、返金その他取引に付随する事項について一切の保証をしません。",
      "本サービスの利用により生じた損害について、運営者に故意または重過失がある場合を除き、運営者は賠償責任を負いません。",
      "運営者は、Stripe のシステム障害、認証エラー、振込遅延、または決済の取り消し（チャージバック等）により、出品者が報酬を得られなかった場合や、購入者が返金を受けられなかった場合について、いかなる責任も負わないものとします。",
      "利用者は、提供されるスキル（フィットネスや運動指導等を含みます）を実践する際、自身の健康状態を考慮したうえで、自己の責任において本サービスを利用するものとします。",
      "スキルの実践に伴う事故、怪我、体調悪化、その他一切の損害について、運営者は一切の責任を負いません。",
    ],
  },
  {
    title: "第14条（システムと規約の変更）",
    body: [
      "運営者にかかわるシステム障害、保守点検、不可抗力等により、運営者は予告なくサービスの一部または全部を停止できるものとします。",
      "運営者が必要と判断した場合、いつでも本規約を変更することができるものとします。変更後の規約は、本サービス上に掲載された時点より効力を生じるものとします。",
    ],
  },
  {
    title: "第15条（準拠法・管轄）",
    body: [
      "本規約の解釈にあたっては日本法を準拠法とし、本サービスに関して紛争が生じた場合は、運営者の所在地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします。",
    ],
  },
  {
    title: "第16条（運営者情報）",
    body: [
      "運営者名：東 沙羅",
      "所在地：〒150-0043 東京都渋谷区道玄坂1丁目10番渋谷道玄坂東急ビル2F-C",
      "連絡先：本サービス内のお問い合わせフォームよりご連絡ください。",
    ],
  },
] as const

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    title: "1. はじめに",
    body: [
      "「GritVib」（以下「本サービス」）は、個人のスキルやデジタルコンテンツの販売・取引を提供するストアプラットフォームです。運営者である東沙羅（以下「運営者」といいます）は、利用者の個人情報の保護を重要な責務とし、個人情報の取扱いについて以下の方針に基づき適切に管理・運用します。",
    ],
  },
  {
    title: "2. 収集する情報",
    body: [
      "本サービスでは、アカウント登録・取引・サービス利用に際して以下の情報を収集します。",
      "アカウント情報: メールアドレス、氏名（本名）、表示名（ユーザーネーム）、アイコン画像、生年月日",
      "本人確認および決済関連: 本サービス上での販売および決済機能（Stripe Connect）を利用するにあたり、出品者が登録する口座情報・本人確認書類等、および購入者が決済時に入力するクレジットカード情報等。※これらの一切の決済・口座情報は、決済代行会社である Stripe 社が直接取得・管理し、本サービスのサーバーにはクレジットカード番号や口座の暗証番号等の詳細は保存されません。",
      "サービス利用情報: 事前オファーの回答内容、メッセージ（画像・動画含む）、お問い合わせ内容、およびプラットフォーム上での行動履歴。",
    ],
  },
  {
    title: "3. 利用目的",
    body: [
      "収集した情報は、以下の目的で利用します。",
      "本サービスの提供・運営（ストア開設の支援、スキル取引の場およびチャットシステムの提供）",
      "本人確認およびアカウントの管理",
      "取引の成立・履行、および利用者のサポート",
      "お問い合わせ対応",
      "規約違反への対応、および不正行為の防止・安全確保",
      "サービス改善および新機能の検討",
    ],
  },
  {
    title: "4. 第三者提供と情報共有",
    body: [
      "本サービスは、法令に基づく場合を除き、利用者の同意なく個人情報を第三者に提供しません。ただし、以下の場合を除きます。",
      "決済および売上振込処理のため: 決済代行業者（Stripe, Inc.）のシステムを利用し、購入者の決済処理、および出品者の売上金振込のための口座登録・本人確認（Stripe Connectアカウント開設）を行うため。これらに必要な情報は、利用者が同社の規約に同意のうえで同社に直接提供、または同社と連携されます。",
      "取引の履行のため: 出品者と購入者が取引を行う上で、相互に確認が必要な情報（表示名、メッセージ内容、および取引の安全性のために必要な範囲の氏名等）を、両者間で共有する場合。",
      "法令等に基づく場合: 法令により開示を求められた場合、または警察等の公的機関からの適法な要請があった場合。",
    ],
  },
  {
    title: "5. セキュリティ対策",
    body: [
      "個人情報は適切な技術的・組織的措置により管理し、不正アクセス、紛失、破壊、改ざんを防止するよう努めます。",
    ],
  },
  {
    title: "6. 保管期間",
    body: [
      "利用目的の達成に必要な期間、または法令に定める期間、個人情報を保管します。利用者が退会した場合であっても、不正防止、紛争解決、法令対応等のため、必要な範囲で一定期間データを保持することがあります。",
    ],
  },
  {
    title: "7. 投稿コンテンツの削除",
    body: [
      "本サービスは、利用者のプライバシー保護および本サービスの円滑な運営（ストレージ容量の最適化）のため、取引終了から一定期間経過した投稿コンテンツ（画像・動画等）を自動的に消去するシステムを採用しています。一度削除されたコンテンツを復元することはできませんので、必要な情報はあらかじめ利用者の責任において保存してください。",
    ],
  },
  {
    title: "8. Googleアナリティクス等の利用",
    body: [
      "本サービスでは、サービスの改善および利用状況の分析のため、Google アナリティクス等の計測ツールを使用することがあります。これらのツールは Cookie を使用してデータを収集しますが、データは匿名で収集されており、個人を特定するものではありません。",
    ],
  },
  {
    title: "9. Cookie（クッキー）の利用",
    body: [
      "本サービスでは、ログイン状態の保持および利便性向上のため、Cookieを使用します。ブラウザの設定によりCookieを拒否することも可能ですが、その場合本サービスの一部機能が利用できなくなることがあります。",
    ],
  },
  {
    title: "10. お問い合わせ",
    body: [
      "個人情報の取扱いに関するお問い合わせは、本サービス内のお問い合わせフォームより、下記運営者宛てまでご連絡ください。",
      "運営者名: 東 沙羅",
      "所在地: 〒150-0043 東京都渋谷区道玄坂1丁目10番渋谷道玄坂東急ビル2F-C",
      "連絡先: 本サービス内のお問い合わせフォームをご利用ください。",
    ],
  },
  {
    title: "11. 改定",
    body: [
      "本ポリシーは必要に応じて改定することがあります。改定後の内容は本サービス上に掲載した時点で効力を生じるものとします。",
    ],
  },
] as const

export const TERMS_SECTIONS_EN: readonly LegalSection[] = [
  {
    title: "Article 1 (Purpose and Applicability)",
    body: [
      "These Terms of Service (the \"Terms\") set forth the conditions for using the personal store platform \"GritVib\" and all related services (the \"Service\") provided by Sara Higashi (the \"Operator\"). Users must agree to these Terms to use the Service. If you do not agree, you may not use the Service.",
    ],
  },
  {
    title: "Article 2 (Definitions)",
    body: [
      "\"The Service\" refers to the platform that provides a marketplace for individuals to open a \"Store\" to sell their skills and digital content, matching \"Sellers\" with \"Buyers.\"",
      "\"User\" refers to any individual or entity using the Service, including both Sellers and Buyers.",
      "\"Transaction\" refers to the sales contract for skills or content established between a Seller and a Buyer through the Service.",
    ],
  },
  {
    title: "Article 3 (Nature of the Service)",
    body: [
      "The Service provides a \"venue\" for transactions between Users. The Operator is not a party to any transaction. The Operator does not guarantee the quality, legality, accuracy of the skills offered, or the background of any Seller. The transaction contract is established directly between the Seller and the Buyer.",
    ],
  },
  {
    title: "Article 4 (Eligibility)",
    body: [
      "Users under the age of 18 require parental or guardian consent to use the Service.",
      "Users under the age of 18 are prohibited from listing or purchasing skills involving in-person instruction.",
      "Use of the Service by members of anti-social forces or similar groups is strictly prohibited.",
    ],
  },
  {
    title: "Article 5 (Booking Requests and Transactions)",
    body: [
      "The Service features a \"Booking Request (Consultation Request)\" function, allowing Sellers to vet Buyers or confirm transaction details in advance.",
      "If a Seller has enabled Booking Requests, the Buyer can only purchase the skill after receiving approval from the Seller.",
      "The Operator shall not intervene in, nor be held responsible for, the approval process or any delays therein.",
    ],
  },
  {
    title: "Article 6 (Prohibited Acts)",
    body: [
      "Users shall not engage in the following:",
      "Providing false information regarding background, achievements, or listing content.",
      "Direct transactions outside the Service (circumvention) or soliciting such acts.",
      `Inducing Users to use external services other than those designated by the Operator (${ALLOWED_EXTERNAL_TOOLS_LIST_EN}, etc.) for direct monetary exchange.`,
      "Collecting payments through methods other than those provided by the Service.",
      "Fraud, misrepresentation, or acts contrary to public order and morals.",
      "Transactions or content that are sexual, obscene, or intended to incite sexual arousal.",
      "Posting inappropriate images or videos involving excessive exposure or emphasizing body parts beyond instructional purposes.",
      "Reverse engineering, disassembling, or analyzing the Service's systems or software.",
      "Using the Service to develop a competing product or infringing on intellectual property rights.",
      "Any other acts deemed inappropriate by the Operator.",
    ],
  },
  {
    title: "Article 7 (Use of External Tools)",
    body: [
      `Users may utilize external tools (${ALLOWED_EXTERNAL_TOOLS_LIST_EN}, etc.) to fulfill transactions. The Operator assumes no responsibility for any issues, including account suspension or connection failure, arising from the use of such tools.`,
    ],
  },
  {
    title: "Article 8 (In-Person Instruction and Self-Responsibility)",
    body: [
      "Any in-person instruction must take place in a safe, public location. Meetings in private or dangerous locations are strictly prohibited.",
      "The Operator assumes no responsibility for accidents, injuries, or disputes arising from in-person instruction. All such matters must be resolved between the parties involved.",
    ],
  },
  {
    title: "Article 9 (Transaction Responsibility and Cancellation)",
    body: [
      "Delivery of skills/content and exchange of files must be performed in good faith between the parties.",
      "Once a contract is established, cancellations or refund requests for user convenience are not permitted.",
      "The payout process begins only after the Operator's system confirms the completion of the transaction. Sellers agree that funds will be held in their Stripe account until they become available for withdrawal.",
    ],
  },
  {
    title: "Article 10 (Intellectual Property and Posted Content)",
    body: [
      "All rights to the programs, software, trademarks (\"GritVib\"), logos, and designs of the Service belong to the Operator or authorized third parties.",
      "Copyright of content posted by Users (videos, images, text, files, etc.) belongs to the respective User.",
      "Users grant the Operator a non-exclusive, royalty-free license to use posted content for the operation and promotion of the Service.",
      "The Operator may delete content that violates these Terms without prior notice.",
      "To protect privacy and optimize system capacity, the Operator may automatically delete chat-based content (images, videos, files) after a certain period following transaction completion. Users are responsible for backing up their own data.",
    ],
  },
  {
    title: "Article 11 (Payment, Fees, and Identity Verification)",
    body: [
      "Payments are processed through Stripe Connect.",
      "Transaction funds are paid directly to the Seller's Stripe Connect account. The Operator does not collect or hold transaction funds as a proxy.",
      "[Identity Verification (KYC)] Sellers are obligated to submit identity verification documents as required by Stripe. Sellers acknowledge that failure to complete verification will result in the inability to withdraw funds and may lead to account restrictions.",
      "A 15% platform fee is automatically deducted from the sales price at the time of transaction.",
      "Payout schedules are governed by Stripe's terms and the Seller's individual settings. The Operator is not responsible for payout delays.",
    ],
  },
  {
    title: "Article 12 (Suspension and Termination)",
    body: [
      "The Operator may delete listings or suspend accounts without notice in the event of a breach of Terms, multiple reports from other users, or for safety reasons.",
    ],
  },
  {
    title: "Article 13 (Disclaimer and Health Warning)",
    body: [
      "THE OPERATOR IS NOT A PARTY TO TRANSACTIONS AND PROVIDES NO WARRANTY REGARDING THE QUALITY, RESULTS, OR LEGALITY OF THE SKILLS PROVIDED.",
      "THE OPERATOR SHALL NOT BE LIABLE FOR ANY DAMAGES ARISING FROM THE USE OF THE SERVICE, EXCEPT IN CASES OF WILLFUL MISCONDUCT OR GROSS NEGLIGENCE BY THE OPERATOR.",
      "THE OPERATOR IS NOT RESPONSIBLE FOR STRIPE SYSTEM FAILURES, AUTHENTICATION ERRORS, OR PAYOUT DELAYS.",
      "USERS VOLUNTARILY ASSUME ALL RISKS RELATED TO PHYSICAL ACTIVITIES (FITNESS, ETC.) AND MUST CONSIDER THEIR OWN HEALTH CONDITIONS (PREGNANCY, INJURIES, ETC.) BEFORE USE.",
    ],
  },
  {
    title: "Article 14 (Changes to Service and Terms)",
    body: [
      "The Operator may suspend the Service for maintenance or updates without notice. The Operator may modify these Terms at any time, and such changes become effective upon being posted on the Service.",
    ],
  },
  {
    title: "Article 15 (Governing Law and Jurisdiction)",
    body: [
      "These Terms shall be governed by and construed in accordance with the laws of Japan. Any disputes shall be subject to the exclusive jurisdiction of the district court having jurisdiction over the Operator's location.",
    ],
  },
  {
    title: "Article 16 (Operator Information)",
    body: [
      "Operator: Sara Higashi",
      "Address: 2F-C Shibuya Dogenzaka Tokyu Bldg., 1-10-8 Dogenzaka, Shibuya-ku, Tokyo, 150-0043, Japan",
      "Contact: Please contact us via the inquiry form within the Service.",
    ],
  },
] as const

export const PRIVACY_SECTIONS_EN: readonly LegalSection[] = [
  {
    title: "1. Introduction",
    body: [
      "\"GritVib\" (the \"Service\") is a store platform providing the sale and transaction of personal skills and digital content. Sara Higashi (the \"Operator\") recognizes the protection of users' personal information as a vital responsibility and will manage and operate it appropriately based on the following policy.",
    ],
  },
  {
    title: "2. Information We Collect",
    body: [
      "The Service collects the following information during account registration, transactions, and service usage:",
      "Account Information: Email address, legal name, display name (username), profile image, and date of birth.",
      "Verification and Payment Data: To use selling and payment functions (Stripe Connect), Sellers provide bank account details and identity verification documents. Buyers provide credit card information during checkout. Note: All payment and bank data is collected and managed directly by Stripe, Inc. The Service does not store credit card numbers or bank PINs on its servers.",
      "Usage Information: Answers to Booking Requests, messages (including images/videos), inquiry details, and activity history on the platform.",
    ],
  },
  {
    title: "3. Purpose of Use",
    body: [
      "We use the collected information for the following purposes:",
      "Provision and operation of the Service (Store setup support, transaction venue, and chat system).",
      "Identity verification and account management.",
      "Execution of transactions and user support.",
      "Responding to inquiries.",
      "Enforcing terms of use, preventing fraud, and ensuring safety.",
      "Service improvement and development of new features.",
    ],
  },
  {
    title: "4. Third-Party Disclosure and Sharing",
    body: [
      "We do not provide personal information to third parties without the user's consent, except in the following cases:",
      "For Payment and Payout Processing: We utilize Stripe, Inc. (Stripe Connect) for processing payments and payouts. Necessary information is shared with or provided directly to Stripe by the user in accordance with Stripe's terms.",
      "For Transaction Fulfillment: Information necessary for the safe execution of transactions (e.g., display name, message content, and legal name within a necessary scope) will be shared between the Seller and the Buyer.",
      "Legal Requirements: When required by law or upon valid requests from public authorities such as the police.",
    ],
  },
  {
    title: "5. Security Measures",
    body: [
      "We implement appropriate technical and organizational measures to protect personal information and prevent unauthorized access, loss, destruction, or alteration.",
    ],
  },
  {
    title: "6. Data Retention and Deletion",
    body: [
      "We retain personal information for the period necessary to achieve the purposes of use or as required by law.",
      "Automatic Deletion: To protect user privacy and optimize system storage, posted content (images, videos, files) in chats may be automatically deleted after a certain period following the completion of a transaction. Once deleted, content cannot be recovered.",
      "Account Deletion: Even after a user closes their account, we may retain certain data for a limited period for fraud prevention, dispute resolution, or legal compliance.",
    ],
  },
  {
    title: "7. Your Rights",
    body: [
      "Users have the right to request access to, correction of, or deletion of their personal information. Please contact us via the inquiry form for any such requests.",
    ],
  },
  {
    title: "8. Use of Analytics and Cookies",
    body: [
      "Google Analytics: We may use tools like Google Analytics to analyze service usage. Data is collected anonymously via Cookies and does not identify individuals.",
      "Cookies: We use Cookies to maintain login sessions and improve user experience. You can disable Cookies in your browser settings, though some features of the Service may become unavailable.",
    ],
  },
  {
    title: "9. International Data Transfers",
    body: [
      "As the Service is operated from Japan, your information may be transferred to and processed in Japan. By using the Service, you consent to this transfer.",
    ],
  },
  {
    title: "10. Contact Information",
    body: [
      "For inquiries regarding personal information, please contact the Operator via the inquiry form.",
      "Operator Name: Sara Higashi",
      "Address: 2F-C Shibuya Dogenzaka Tokyu Bldg., 1-10-8 Dogenzaka, Shibuya-ku, Tokyo, 150-0043, Japan",
    ],
  },
  {
    title: "11. Revisions",
    body: [
      "This policy may be revised at any time. Changes become effective once posted on the Service.",
    ],
  },
] as const

export function getTermsSections(locale: Locale): readonly LegalSection[] {
  return locale === "en" ? TERMS_SECTIONS_EN : TERMS_SECTIONS
}

export function getPrivacySections(locale: Locale): readonly LegalSection[] {
  return locale === "en" ? PRIVACY_SECTIONS_EN : PRIVACY_SECTIONS
}

