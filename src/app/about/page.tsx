import Link from "next/link"
import { Button } from "@/components/ui/button"

const conceptPoints = [
  "私たちは、フィットネスの指導には「経歴の長さ」よりも「あなた自身の経験や工夫」が何より価値があると考えています。",
  "特別な資格がなくても、あなたの日々の積み重ねや独自のトレーニング方法が、誰かの目標達成を後押しするかもしれません。",
  "GritVibは、そんなあなたのスキルを直接ユーザーに届けられる場所です。",
]

const featureCards = [
  {
    title: "相談から始まる安心の取引",
    body: "いきなり購入するのではなく、まずは「相談リクエスト」を送ることで、講師と生徒が納得してから取引をスタートできる「事前オファー制」を採用しています。",
  },
  {
    title: "あなたらしいスキルを販売",
    body: "厳格な資格や経歴は問いません。あなたのトレーニング法、食事のアドバイス、あるいはモチベーションの管理など、自由にメニューを作成してください。",
  },
  {
    title: "透明な手数料で最大限の報酬を",
    body: "プラットフォーム手数料は販売価格の15%です。決済時に自動で差し引かれ、あなたの努力を最大限に還元することを目指しています。",
  },
]

const safetyItems = [
  {
    title: "性的な文脈の徹底排除",
    body: "フィットネス指導という目的を尊重し、健全なコミュニティ運営を行っています。",
  },
  {
    title: "ガイドラインの遵守",
    body: "不適切な行為については、規約に基づき厳正に対処します。",
  },
  {
    title: "安心の決済システム",
    body: "世界基準の決済プラットフォーム「Stripe」を採用しており、安全に取引が可能です。",
  },
]

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 text-zinc-100">
      <div className="mb-8 rounded-2xl border border-red-500/25 bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/30 p-6 md:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">GritVibについて</h1>
          <Button
            asChild
            variant="outline"
            className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
          >
            <Link href="/">トップページに戻る</Link>
          </Button>
        </div>
        <p className="text-base leading-relaxed text-zinc-200 md:text-lg">
          GritVib（グリットヴィブ）は、運動をもっと身近に、もっとパーソナルにするためのスキルマーケットプレイスです。
        </p>
      </div>

      <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 md:p-7">
        <h2 className="text-xl font-bold text-white">GritVibが大切にしていること（コンセプト）</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300 md:text-base">
          {conceptPoints.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-white">GritVibの特徴</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {featureCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <h3 className="text-base font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 md:p-7">
        <h2 className="text-xl font-bold text-white">安全への取り組み</h2>
        <p className="mt-2 text-sm text-zinc-400">私たちは、誰もが安心して利用できるプラットフォームを目指しています。</p>
        <div className="mt-4 space-y-3">
          {safetyItems.map((item) => (
            <div key={item.title} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-red-500/25 bg-red-950/15 p-5 md:p-7">
        <h2 className="text-xl font-bold text-white">運営者からの一言</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-200 md:text-base">
          <p>
            GritVibは、私自身が「フィットネスを通じて誰かとつながり、何かを生み出したい」という想いから立ち上げたプラットフォームです。
          </p>
          <p>
            まだ小さなサービスですが、ここからたくさんのフィットネスの輪が広がることを心から願っています。ぜひ、あなたのスキルで誰かを笑顔にしてください。
          </p>
        </div>
      </section>
    </main>
  )
}

