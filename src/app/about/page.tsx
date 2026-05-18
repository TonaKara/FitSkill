import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"

const conceptPoints = [
  "私たちは、誰かに何かを教えたり提供したりする際に、型にはまった「肩書」や「資格の有無」よりも、「これまでの経験、工夫、そして楽しむ心」にこそ、何よりの価値があると信じています。",
  "特別な資格や、業界での長い経歴がなくても、積み重ねてきた独自のノウハウや個性が、誰かの課題を解決し、目標達成を力強く後押しするかもしれません。",
  "GritVibは、スキルを、そして「好き」を、SNSのフォロワーや必要としている人々に直接届けられる個人ストアを提供します。",
]

const featureCards = [
  {
    title: "相談から始まる安心の取引",
    body: "いきなり商品が購入されるのではなく、まずは購入希望者から「購入リクエスト」を受け取り、出品者と購入者の双方が納得してから取引をスタートできる「事前オファー制」を採用しています。これにより、お互いにミスマッチのない誠実な取引が可能です。",
  },
  {
    title: "あなたらしいスキルを自由に販売",
    body: "提供するジャンルに縛りはありません。テキストによるオンライン相談、動画やデジタルコンテンツの提供、通話によるマンツーマンサポート、あるいは対面での指導など、あなたの強みや「好き」を活かして自由にメニュー（商品）を作成してください。",
  },
  {
    title: "手数料",
    body: "プラットフォームの利用手数料は、取引成立時の販売価格の15%です。複雑な追加費用はなく、努力と成果を最大限に手元へ還元することを目指しています。",
  },
]

const safetyItems = [
  {
    title: "不適切な文脈の徹底排除",
    body: "スキルの売り買いという健全な目的を尊重し、コミュニティの安全を脅かす公序良俗に反する行為や、不適切なコンテンツの投稿はシステムと規約に基づき厳正に対処します。",
  },
  {
    title: "安心の世界基準決済システム",
    body: "世界中で利用されている最高峰の決済インフラ「Stripe（Stripe Connect）」を標準搭載。出品者・購入者ともに、お金のやり取りに一切の不安なく安全に取引が完了します。",
  },
]

const operatorParagraphs = [
  "GritVibは、私自身が「「好き」を通じて誰かとつながり、価値を生み出したい」という想いから立ち上げたプラットフォームです。",
  "まだ小さなサービスですが、ここからたくさんの挑戦の輪が広がることを心から願っています。ぜひ気軽に「好き」を共有してみてください！",
]

export default function AboutPage() {
  return (
    <main className={CONTENT_PAGE_MAIN_CLASS}>
      <div className="mb-8 overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 md:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">GritVibについて</h1>
          <Button
            asChild
            variant="outline"
            className="border-border bg-background text-foreground hover:border-primary hover:bg-muted"
          >
            <Link href="/">トップページに戻る</Link>
          </Button>
        </div>
        <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
          GritVib（グリットヴィブ）は、個人の「好き」や「得意」を価値に変え、自分だけの独立したお店を開設できる個人ストアプラットフォームです。
        </p>
      </div>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">GritVibが大切にしていること（コンセプト）</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          {conceptPoints.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-foreground">GritVibの特徴</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {featureCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">安全への取り組み</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          私たちは、個人が安心してビジネスを営み、購入者が心地よくサービスを受け取れるクリーンな環境を徹底しています。
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {safetyItems.map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-accent/50 p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">運営者からの一言</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          {operatorParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
    </main>
  )
}
