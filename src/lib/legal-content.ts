import { ALLOWED_EXTERNAL_TOOLS_LIST } from "@/lib/allowed-external-tools"
import type { Locale } from "@/lib/i18n/locales"

export type LegalSection = { title: string; body: string[] }

const ALLOWED_EXTERNAL_TOOLS_LIST_EN = "Zoom, YouTube, Discord"

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    title: "第1条（目的および適用）",
    body: [
      "本規約は、東沙羅（以下「運営者」といいます）が提供する個人ストアプラットフォーム「GritVib」および、プロダクト投稿・交流機能「FromHere」、ならびに運営者が直接提供する「日本進出支援サービス（Japan Entry Support）」（以下、これらを総称して「本サービス」といいます）の利用条件を定めるものです。",
      "利用者は本規約に同意したうえで本サービスを利用するものとし、同意しない場合は利用できません。",
    ],
  },
  {
    title: "第2条（定義）",
    body: [
      "「本サービス」とは、以下の各サービスを総称した名称を指します。",
      "(a) 出品者が自身のスキルやデジタルコンテンツを販売する「ストア」を開設し、購入者と取引を行うプラットフォーム機能。",
      "(b) 利用者が自らのプロダクトやプロジェクトを投稿し、投票やコメント等の交流を行うコミュニティ機能（以下「FromHere」といいます）。",
      "(c) 運営者が海外クライアント向けに提供する、日本市場向けの翻訳、文化的ローカライズ、およびコンサルティングサービス（以下「日本進出支援サービス」といいます）。",
      "「利用者」とは、本プラットフォームの利用者（出品者、購入者、およびFromHereの投稿・閲覧者を含みます）、および日本進出支援サービスの提供を受けるクライアント（個人または法人）を指します。",
      "「取引」とは、本サービスを通じて利用者間で成立する売買契約、または日本進出支援サービスにおいて運営者とクライアントの間で成立する業務委託契約を指します。",
    ],
  },
  {
    title: "第3条（サービスの性質）",
    body: [
      "プラットフォーム機能およびFromHereにおいては、運営者は取引や交流の「場」を提供するのみであり、運営者は取引の当事者ではありません。出品・投稿されるプロダクト、スキル、情報の品質、適法性、正確性について運営者は一切保証しません。取引契約は、利用者間で直接成立します。",
      "日本進出支援サービスにおいては、運営者が直接のサービス提供者となり、クライアントと運営者の間で業務委託関係が成立します。本サービスは運営者の個人的知見に基づき、AI等の自動生成ツールに頼らず手作業で提供される属人的なサービスです。そのため、受託可能な案件数には制限があり、運営者の判断により新規受付を停止する場合があります。",
    ],
  },
  {
    title: "第4条（利用資格）",
    body: [
      "18歳未満の利用者は、本サービスの利用にあたり保護者の同意を必要とします。",
      "対面での直接指導を伴うスキルの出品および購入は、18歳未満の利用者は行えないものとします。",
      "反社会的勢力、またはそれに準ずる者による本サービスの利用を一切禁止します。",
    ],
  },
  {
    title: "第5条（FromHereにおける投稿と管理）",
    body: [
      "利用者は、自身が正当な権利を有する、または許諾を得たプロダクトやコンテンツのみをFromHereに投稿できるものとします。",
      "運営者は、以下に該当する投稿について、事前通知なく削除、非表示、または編集等の措置をとる権限を有します。",
      "他者の著作権、名誉、プライバシーを侵害するもの。",
      "スパム、嫌がらせ、または本サービスの趣旨と著しく乖離するもの。",
      "虚偽の内容、または公序良俗に反するもの。",
      "その他、運営者が不適切と判断した内容。",
      "投稿内容に起因する紛争は当事者間で解決するものとし、運営者は一切の責任を負いません。",
    ],
  },
  {
    title: "第6条（事前オファーと取引）",
    body: [
      "本サービスは、出品者が事前に取引内容を確認できる「事前オファー（相談リクエスト）」機能を備えています。",
      "出品者が事前オファー設定を行っている場合、購入者は出品者の承認を得ることで初めて購入権を取得できます。運営者は、承認の可否や遅延について一切介入せず、責任を負いません。",
    ],
  },
  {
    title: "第7条（禁止事項）",
    body: [
      "利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。",
      "虚偽の経歴、実績、または出品・投稿内容の記載。",
      "本サービスを介さない直接取引（中抜き行為）への誘導、またはそれに応じる行為。",
      "本サービスを通じて知り合った利用者に対し、本サービスを介さずに直接雇用や業務委託契約を持ちかける行為。",
      `運営者が指定する外部ツール（${ALLOWED_EXTERNAL_TOOLS_LIST}等）以外の外部サービスへの誘導、およびそれを利用した直接的な金銭の授受。`,
      "詐欺行為、または性的、わいせつ的内容の出品および取引。",
      "本サービスの解析（リバースエンジニアリング等）、または本サービスを模倣したサービスの開発・提供を目的とした利用。",
      "その他、運営者が不適切と判断する行為。",
    ],
  },
  {
    title: "第8条（外部ツールの利用）",
    body: [
      "利用者は、取引の履行にあたり外部ツールを連携・利用できますが、当該ツールの利用に起因するアカウント停止、接続不良等のトラブルについて、運営者は一切の責任を負いません。",
    ],
  },
  {
    title: "第9条（コミュニケーションおよび対応時間）",
    body: [
      "本サービスに関する連絡は、運営者指定のチャット（Discord等）またはメールを通じて行うものとします。",
      "運営者は、原則として電話やビデオ通話によるリアルタイムの口頭対応は行いません。",
      "運営者は日本標準時（JST）を基準に活動します。時差、および運営者の開発・作業状況や個人的な体調管理等の事情により、返信までに数営業日を要する場合があることを利用者はあらかじめ承諾するものとします。原則として即時対応の義務は負わないものとします。",
    ],
  },
  {
    title: "第10条（対面指導に関する注意と自己責任）",
    body: [
      "取引に基づき利用者間で対面による直接指導を行う場合、必ず公共の安全な場所で実施し、夜間・密室など危険を伴う場所での実施を禁止します。",
      "対面指導に伴う事故、怪我、トラブルについて、運営者は一切責任を負わず、すべて当事者間で解決するものとします。",
    ],
  },
  {
    title: "第11条（取引責任とキャンセル・返品）",
    body: [
      "スキル等の提供方法は当事者間で誠実に合意し履行するものとします。売買契約成立後、利用者の自己都合によるキャンセルや返金請求は認められません。",
      "出品者は、取引完了後、自身の Stripe アカウント上で売上金が支払可能となるまで待機する必要があることに同意するものとします。",
      "日本進出支援サービスにおける成果物は、その性質上および手作業による役務提供であることから、返品および返金は一切認められません。",
      "サブスクリプションプランの解約は次回決済日前日までに手続きを行うものとし、日割り計算による返金は行いません。",
    ],
  },
  {
    title: "第12条（知的財産権および投稿コンテンツ）",
    body: [
      "本サービスを構成するすべてのソフトウェア、商標、ロゴ、デザイン等の知的財産権は、運営者または正当な権限を持つ第三者に帰属します。",
      "利用者の投稿コンテンツの著作権は、当該利用者に帰属します。ただし、利用者は運営者に対し、本サービスの提供・運営・広告宣伝（SNSでの紹介等）のために必要な範囲で、無償かつ非独占的に利用する権利を許諾するものとします。",
      "運営者は、データ容量最適化のため、取引完了から一定期間経過後、チャット上の投稿コンテンツを削除することがあります。利用者は各自で保存を行うものとします。",
    ],
  },
  {
    title: "第13条（決済・手数料および本人確認）",
    body: [
      "決済は Stripe のシステムを利用して行われます。",
      "出品者は、Stripe社の定めに従い、本人確認書類の提出を完了する義務を負います。本人確認未完了による売上金の振込制限について、運営者は責任を負いません。",
      "プラットフォーム機能における取引成立時、出品者は販売価格に対し15%の手数料を支払うものとし、決済時に自動的に差し引かれます。",
      "日本進出支援サービスの利用料金は、Stripeを通じて指定の通貨で決済されます。為替レートの変動による差益・差損について運営者は責任を負いません。",
    ],
  },
  {
    title: "第14条（利用停止）",
    body: [
      "規約違反、他ユーザーからの通報多数、または安全確保上必要と判断した場合、運営者は事前通知なく該当出品・投稿の削除やアカウントの利用停止、ストアの閉鎖措置を行うことができます。",
    ],
  },
  {
    title: "第15条（免責事項）",
    body: [
      "運営者は、利用者間の取引の履行、提供されるスキルの品質、成果物の状態等について一切の保証をしません。",
      "本サービスの利用により生じた損害について、運営者に故意または重過失がある場合を除き、運営者は賠償責任を負いません。また、Stripe のシステム障害等に起因する不利益についても責任を負わないものとします。",
      "日本進出支援サービスの成果物は、運営者の主観的判断に基づきAIを使用せず作成されます。言語・文化の性質上、クライアントの期待する主観的表現との完全な一致は保証しません。",
      "運営者の疾病、不慮の事故、その他やむを得ない個人的事情により、一時的にサービスを停止または納期を調整する場合があることを利用者は承諾し、これにより生じた損害について運営者は責任を負わないものとします。",
      "提供されるスキルを実践する際、利用者は自己の責任において健康状態を考慮するものとします。実践に伴う事故や体調悪化について運営者は一切の責任を負いません。",
      "日本進出支援におけるリーガルチェックは弁護士による法律監修を代替するものではなく、最終的な法的判断の責任はクライアント自身が負うものとします。",
    ],
  },
  {
    title: "第16条（システムと規約の変更）",
    body: [
      "運営者は、システム障害や保守点検、不可抗力等により、予告なくサービスを停止できるものとします。また、必要に応じていつでも本規約を変更でき、変更後の規約は掲載時点より効力を生じるものとします。",
    ],
  },
  {
    title: "第17条（準拠法・管轄および正本）",
    body: [
      "本規約の解釈にあたっては、利用者の国籍や居住地にかかわらず、日本法を準拠法とします。",
      "本サービスに関して紛争が生じた場合は、運営者の所在地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします。",
      "本規約は日本語版を正本とします。",
    ],
  },
  {
    title: "第18条（運営者情報）",
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
      "「GritVib」（以下「本サービス」）は、運営者が提供する個人ストアプラットフォーム、プロダクト投稿機能「FromHere」、および運営者が直接提供する「日本進出支援サービス（Japan Entry Support）」を含む包括的なサービスです。",
      "運営者である東沙羅（以下「運営者」といいます）は、利用者の個人情報の保護を重要な責務とし、以下の方針に基づき適切に管理・運用します。",
    ],
  },
  {
    title: "2. 収集する情報",
    body: [
      "本サービスでは、以下の情報を収集します。",
      "アカウント・顧客情報: メールアドレス、氏名、表示名、アイコン画像、生年月日。日本進出支援サービス利用時は、SNSアカウント（Discord ID等）、会社名、役職、ビジネスに関する情報。",
      "FromHere投稿情報: 利用者が「FromHere」に投稿したプロダクト名、画像、URL、紹介文、および他投稿へのコメントや投票内容。（これらは本サービス上で一般公開されます）",
      "本人確認および決済関連: 出品者が登録する口座情報・本人確認書類、および購入者・クライアントが入力するクレジットカード情報等。※これらは決済代行会社 Stripe, Inc. が直接取得・管理し、本サービスサーバーには詳細なカード番号等は保存されません。",
      "サービス利用情報: 事前オファー内容、メッセージ、相談・依頼内容、提供資料、行動履歴、お問い合わせ内容。",
    ],
  },
  {
    title: "3. 利用目的",
    body: [
      "本サービスの提供・運営(ストア開設、プロダクト掲示板の運用、および日本進出支援の実務遂行)",
      "本人確認、アカウント管理、および顧客管理",
      "FromHereにおける投稿内容の掲載および本サービスの宣伝（SNS等での紹介）",
      "取引の成立・履行、および継続的なコンサルティングの提供",
      "規約違反への対応、不正行為の防止、お問い合わせ対応",
      "サービス改善および新機能の検討",
    ],
  },
  {
    title: "4. 第三者提供と情報共有",
    body: [
      "本サービスは、法令に基づく場合を除き、同意なく個人情報を第三者に提供しません。ただし、以下を除きます。",
      "決済および売上振込: 決済代行業者（Stripe, Inc.）への必要情報の提供・連携。",
      "取引・交流の履行: 出品者と購入者間、またはFromHere上での公開情報の表示等、サービスの性質上不可欠な共有。",
      "外部ツールの利用: 日本進出支援等でDiscord、Slack、Zoom等を利用する場合、各ツールの運営会社への情報提供（各ツールの規約に準じます）。",
      "ビジネス情報の取り扱い: 日本進出支援サービスにおいて提供された機密性の高いビジネス情報は、運営者が業務遂行のためにのみ使用し、第三者に開示しません。",
    ],
  },
  {
    title: "5. セキュリティ対策",
    body: [
      "不正アクセス、紛失、破壊、改ざんを防止するため、適切な技術的・組織的措置を講じます。",
    ],
  },
  {
    title: "6. 保管期間とデータの消去",
    body: [
      "利用目的の達成に必要な期間、または法令に定める期間データを保管します。",
      "投稿コンテンツの自動削除: プライバシー保護およびストレージ最適化のため、取引完了から一定期間経過した投稿内容（画像・動画等）を自動消去する場合があります。必要なデータは利用者の責任で保存してください。",
    ],
  },
  {
    title: "7. Googleアナリティクス等の利用",
    body: [
      "サービス改善のためGoogleアナリティクス等を使用し、Cookieを通じて匿名で利用データを収集することがあります。",
    ],
  },
  {
    title: "8. Cookie（クッキー）の利用",
    body: [
      "ログイン状態の保持や利便性向上のためにCookieを使用します。ブラウザ設定で拒否も可能ですが、一部機能が制限される場合があります。",
    ],
  },
  {
    title: "9. お問い合わせ",
    body: [
      "個人情報の取扱いに関するお問い合わせは、本サービス内のお問い合わせフォーム、または指定の連絡先（Discord、メール等）より運営者宛てにご連絡ください。",
      "運営者名: 東 沙羅",
      "所在地: 〒150-0043 東京都渋谷区道玄坂1丁目10番渋谷道玄坂東急ビル2F-C",
    ],
  },
  {
    title: "10. 改定",
    body: [
      "本ポリシーは必要に応じて改定することがあります。改定後の内容は本サービス上に掲載した時点で効力を生じるものとします。",
    ],
  },
] as const

export const TERMS_SECTIONS_EN: readonly LegalSection[] = [
  {
    title: "Article 1 (Purpose and Applicability)",
    body: [
      "These Terms of Service (the \"Terms\") set forth the conditions for using (i) the personal store platform \"GritVib\", (ii) the product-posting and community feature \"FromHere\", and (iii) the \"Japan Entry Support\" service directly provided by Sara Azuma (the \"Operator\") (collectively, the \"Service\").",
      "Users must agree to these Terms to use the Service. If you do not agree, you may not use the Service.",
    ],
  },
  {
    title: "Article 2 (Definitions)",
    body: [
      "\"The Service\" refers collectively to the following:",
      "(a) The platform function in which Sellers open a \"Store\" to sell their own skills or digital content and transact with Buyers.",
      "(b) The community feature in which Users post their own products or projects and interact with others through votes and comments (the \"FromHere\" feature).",
      "(c) The translation, cultural localization, and consulting services for the Japanese market that the Operator provides to overseas clients (the \"Japan Entry Support service\").",
      "\"User\" refers to any individual or entity using the platform (including Sellers, Buyers, and FromHere posters and viewers) and to clients (individual or corporate) receiving the Japan Entry Support service.",
      "\"Transaction\" refers to a sales contract established between Users through the Service, or a service-engagement contract established between the Operator and a Client under the Japan Entry Support service.",
    ],
  },
  {
    title: "Article 3 (Nature of the Service)",
    body: [
      "With respect to the Platform and FromHere, the Operator merely provides a \"venue\" for transactions and interactions and is not a party to any transaction. The Operator does not guarantee the quality, legality, or accuracy of any product, skill, or information that is listed or posted. Transaction contracts are established directly between Users.",
      "With respect to the Japan Entry Support service, the Operator is the direct service provider, and a service-engagement relationship is established between the Client and the Operator. This service is provided manually based on the Operator's personal expertise and is not produced with AI or other automated generation tools. The number of engagements that can be accepted is therefore limited, and the Operator may suspend new orders at its discretion.",
    ],
  },
  {
    title: "Article 4 (Eligibility)",
    body: [
      "Users under the age of 18 require parental or guardian consent to use the Service.",
      "Users under the age of 18 are prohibited from listing or purchasing skills involving in-person instruction.",
      "Use of the Service by members of anti-social forces or comparable groups is strictly prohibited.",
    ],
  },
  {
    title: "Article 5 (Posting and Moderation on FromHere)",
    body: [
      "Users may post on FromHere only products or content for which they hold the rightful rights or have obtained permission.",
      "The Operator has the authority to remove, hide, or edit, without prior notice, any post that falls under the following:",
      "Content that infringes the copyright, reputation, or privacy of others.",
      "Content that constitutes spam, harassment, or materially deviates from the purpose of the Service.",
      "Content that is false or contrary to public order and morals.",
      "Any other content the Operator deems inappropriate.",
      "Disputes arising from posted content shall be resolved between the parties, and the Operator assumes no responsibility.",
    ],
  },
  {
    title: "Article 6 (Booking Requests and Transactions)",
    body: [
      "The Service provides a \"Booking Request (Consultation Request)\" function that allows Sellers to confirm transaction details in advance.",
      "When a Seller has enabled Booking Requests, a Buyer can acquire the right to purchase only after receiving the Seller's approval. The Operator does not intervene in, and bears no responsibility for, the approval decision or any delays therein.",
    ],
  },
  {
    title: "Article 7 (Prohibited Acts)",
    body: [
      "Users shall not engage in any of the following:",
      "Providing false information regarding background, achievements, or listed/posted content.",
      "Inducing or accepting direct transactions outside the Service (circumvention).",
      "Soliciting direct employment or service-engagement contracts with Users met through the Service, bypassing the Service.",
      `Inducing the use of external services other than those designated by the Operator (${ALLOWED_EXTERNAL_TOOLS_LIST_EN}, etc.), or any direct monetary exchange through such services.`,
      "Fraud, or listings or transactions of sexual or obscene content.",
      "Reverse engineering or other analysis of the Service, or use of the Service for the purpose of developing or providing a service that imitates it.",
      "Any other acts deemed inappropriate by the Operator.",
    ],
  },
  {
    title: "Article 8 (Use of External Tools)",
    body: [
      "Users may integrate and use external tools to fulfill transactions. The Operator assumes no responsibility for any issues arising from the use of such tools, including account suspension or connection failures.",
    ],
  },
  {
    title: "Article 9 (Communication and Response Times)",
    body: [
      "All communication regarding the Service shall be conducted via chat tools designated by the Operator (such as Discord) or email.",
      "As a general rule, the Operator does not provide real-time verbal support via telephone or video call.",
      "The Operator operates on Japan Standard Time (JST). Users acknowledge and agree in advance that replies may take several business days due to time-zone differences, the Operator's development and work circumstances, personal health management, or similar reasons. As a general rule, the Operator does not assume any obligation of immediate response.",
    ],
  },
  {
    title: "Article 10 (In-Person Instruction and Self-Responsibility)",
    body: [
      "Any in-person instruction conducted between Users under a transaction must take place in a safe, public location. Meetings at night, in private spaces, or in otherwise dangerous locations are strictly prohibited.",
      "The Operator assumes no responsibility for any accident, injury, or trouble arising from in-person instruction; all such matters must be resolved between the parties.",
    ],
  },
  {
    title: "Article 11 (Transaction Responsibility, Cancellation, and Refunds)",
    body: [
      "The method of delivering skills and similar content shall be agreed upon and performed in good faith between the parties. Once a sales contract is established, cancellations or refund requests for user convenience are not permitted.",
      "Sellers agree that, after a transaction is completed, funds will be held until they become available for payout from the Seller's own Stripe account.",
      "Deliverables under the Japan Entry Support service, by their nature and because they are produced through manual labor, are not eligible for any return or refund.",
      "Cancellation of subscription plans must be processed by the day before the next billing date. No prorated refunds will be issued.",
    ],
  },
  {
    title: "Article 12 (Intellectual Property and Posted Content)",
    body: [
      "All intellectual property rights in the software, trademarks, logos, designs, and similar items that constitute the Service belong to the Operator or other rightful third parties.",
      "Copyright in User-posted content belongs to the respective User. However, the User grants the Operator a royalty-free, non-exclusive license to use such content to the extent necessary for the provision, operation, and promotion of the Service (including introductions on social media).",
      "For data-capacity optimization, the Operator may delete chat-based posted content after a certain period from the completion of a transaction. Users are responsible for backing up their own data.",
    ],
  },
  {
    title: "Article 13 (Payment, Fees, and Identity Verification)",
    body: [
      "Payments are processed via Stripe.",
      "Sellers are obligated to complete the submission of identity verification documents in accordance with Stripe's requirements. The Operator is not responsible for payout restrictions caused by incomplete identity verification.",
      "Upon a Platform transaction, the Seller shall pay a fee of 15% of the sales price, which is automatically deducted at the time of payment.",
      "Fees for the Japan Entry Support service are charged via Stripe in the designated currency. The Operator assumes no responsibility for any gain or loss caused by foreign exchange rate fluctuations.",
    ],
  },
  {
    title: "Article 14 (Suspension and Termination)",
    body: [
      "In the event of a breach of these Terms, numerous reports from other users, or where deemed necessary for safety, the Operator may remove the relevant listing or post, suspend the account, or close the Store, without prior notice.",
    ],
  },
  {
    title: "Article 15 (Disclaimer)",
    body: [
      "The Operator does not warrant the performance of transactions between Users, the quality of skills, or the condition of deliverables.",
      "Except in cases of willful misconduct or gross negligence by the Operator, the Operator shall not be liable for any damages arising from the use of the Service. The Operator also assumes no responsibility for any disadvantage arising from Stripe system failures or similar events.",
      "Deliverables of the Japan Entry Support service are produced based on the Operator's subjective judgment without using AI. Due to the nature of language and culture, a complete match with the Client's subjective expectations is not guaranteed.",
      "Users acknowledge that the Operator may temporarily suspend the Service or adjust delivery deadlines due to illness, accident, or other unavoidable personal circumstances of the Operator, and the Operator shall not be liable for any resulting damages.",
      "When practicing any provided skill, Users shall consider their own health condition at their own responsibility. The Operator bears no responsibility for accidents or health deterioration arising from such practice.",
      "Legal checks under the Japan Entry Support service do not substitute for legal supervision by a licensed attorney; final legal judgment rests solely with the Client.",
    ],
  },
  {
    title: "Article 16 (Changes to the Service and Terms)",
    body: [
      "The Operator may suspend all or part of the Service without prior notice due to system failures, maintenance, force majeure, or similar events. The Operator may also amend these Terms as needed, and amended Terms shall take effect upon being posted.",
    ],
  },
  {
    title: "Article 17 (Governing Law, Jurisdiction, and Authoritative Version)",
    body: [
      "These Terms shall be governed by the laws of Japan, regardless of the User's nationality or place of residence.",
      "Any disputes arising in connection with the Service shall be subject to the exclusive jurisdiction of the district court having jurisdiction over the Operator's location as the court of first instance.",
      "The Japanese version of these Terms shall be the authoritative version.",
    ],
  },
  {
    title: "Article 18 (Operator Information)",
    body: [
      "Operator: Sara Azuma",
      "Address: 2F-C Shibuya Dogenzaka Tokyu Bldg., 1-10-8 Dogenzaka, Shibuya-ku, Tokyo, 150-0043, Japan",
      "Contact: Please contact us via the inquiry form within the Service.",
    ],
  },
] as const

export const PRIVACY_SECTIONS_EN: readonly LegalSection[] = [
  {
    title: "1. Introduction",
    body: [
      "\"GritVib\" (the \"Service\") is a comprehensive service consisting of the personal store platform operated by the Operator, the product-posting feature \"FromHere\", and the \"Japan Entry Support\" service directly provided by the Operator.",
      "Sara Azuma (the \"Operator\") regards the protection of users' personal information as an important responsibility and will manage and operate it appropriately in accordance with the following policy.",
    ],
  },
  {
    title: "2. Information We Collect",
    body: [
      "The Service collects the following information:",
      "Account & Customer Information: Email address, name, display name, profile image, and date of birth. When using the Japan Entry Support service, we also collect social-media accounts (e.g., Discord ID), company name, job title, and business-related information.",
      "FromHere Posted Information: Product names, images, URLs, descriptions, and comments and votes on other posts that Users submit to \"FromHere\". (These are publicly displayed on the Service.)",
      "Verification and Payment Data: Bank account information and identity verification documents registered by Sellers, as well as credit card information entered by Buyers and Clients. Note: This data is collected and managed directly by the payment processor Stripe, Inc., and detailed card numbers and similar information are not stored on the Service's servers.",
      "Usage Information: Booking Request content, messages, consultation/engagement details, materials provided, activity history, and inquiry content.",
    ],
  },
  {
    title: "3. Purpose of Use",
    body: [
      "Provision and operation of the Service (Store setup, operation of the product board, and execution of the Japan Entry Support service).",
      "Identity verification, account management, and customer management.",
      "Displaying posted content on FromHere and promoting the Service (such as introductions on social media).",
      "Conclusion and performance of transactions, and provision of ongoing consulting.",
      "Responding to Terms violations, preventing fraud, and responding to inquiries.",
      "Service improvement and consideration of new features.",
    ],
  },
  {
    title: "4. Third-Party Disclosure and Sharing",
    body: [
      "Except as required by law, the Service does not provide personal information to third parties without consent, except in the following cases:",
      "For payment and payout processing: Providing or linking necessary information with the payment processor Stripe, Inc.",
      "For transaction and interaction fulfillment: Sharing inherently required by the nature of the Service, such as displaying public information between Sellers and Buyers, or on FromHere.",
      "For the use of external tools: When external tools such as Discord, Slack, or Zoom are used (for example, in the Japan Entry Support service), necessary information may be provided to the operators of those tools (subject to each tool's terms).",
      "Handling of business information: Confidential business information provided under the Japan Entry Support service is used by the Operator solely to perform the engagement and is not disclosed to third parties.",
    ],
  },
  {
    title: "5. Security Measures",
    body: [
      "We implement appropriate technical and organizational measures to prevent unauthorized access, loss, destruction, or alteration.",
    ],
  },
  {
    title: "6. Data Retention and Deletion",
    body: [
      "We retain data for the period necessary to achieve the purpose of use, or as required by law.",
      "Automatic deletion of posted content: To protect privacy and optimize storage, posted content (such as images and videos) may be automatically deleted after a certain period following transaction completion. Users are responsible for backing up any data they need.",
    ],
  },
  {
    title: "7. Use of Google Analytics, etc.",
    body: [
      "We may use tools such as Google Analytics to improve the Service, collecting usage data anonymously via Cookies.",
    ],
  },
  {
    title: "8. Use of Cookies",
    body: [
      "We use Cookies to maintain login sessions and improve user experience. You may disable Cookies in your browser settings, but some features may become limited.",
    ],
  },
  {
    title: "9. Contact",
    body: [
      "For inquiries regarding the handling of personal information, please contact the Operator via the inquiry form within the Service or any designated contact method (such as Discord or email).",
      "Operator Name: Sara Azuma",
      "Address: 2F-C Shibuya Dogenzaka Tokyu Bldg., 1-10-8 Dogenzaka, Shibuya-ku, Tokyo, 150-0043, Japan",
    ],
  },
  {
    title: "10. Revisions",
    body: [
      "This policy may be revised as needed. Revised content becomes effective once posted on the Service.",
    ],
  },
] as const

export function getTermsSections(locale: Locale): readonly LegalSection[] {
  return locale === "en" ? TERMS_SECTIONS_EN : TERMS_SECTIONS
}

export function getPrivacySections(locale: Locale): readonly LegalSection[] {
  return locale === "en" ? PRIVACY_SECTIONS_EN : PRIVACY_SECTIONS
}

