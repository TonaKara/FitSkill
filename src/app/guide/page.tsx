import Link from "next/link"
import { ArrowDown, ArrowRight, BadgeCheck, Handshake, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

const teacherSteps = [
  {
    title: "マイページで準備",
    body: "「マイページ」からStripe連携を行い、本人確認・口座設定を完了させます。",
  },
  {
    title: "スキルを出品",
    body: "「出品する」ボタンから、あなたの指導内容を作成します。",
  },
  {
    title: "事前オファーの設定",
    body: "質問（最大3つ）と自由回答欄を設定できます。事前に生徒のレベルや目標を確認することで、より的確な指導が可能になります。",
  },
  {
    title: "オファーの承認",
    body: "届いた回答を確認し、「承認」または「拒否」を選択します。承認されると生徒は購入可能になります。",
  },
  {
    title: "指導開始",
    body: "購入後、チャットでZoomやYouTube等の連携リンクを共有して指導を行います。",
  },
  {
    title: "完了申請",
    body: "指導終了後、「完了申請」を送信してください。生徒側の承認をもって取引が終了します。",
  },
] as const

const studentSteps = [
  {
    title: "オファーに回答",
    body: "購入前に講師から質問がある場合、回答を入力して送信します。",
  },
  {
    title: "購入と開始",
    body: "承認後、決済が完了するとチャットが開放されます。",
  },
  {
    title: "指導を受ける",
    body: "チャットでやり取りを行い、Zoom等で指導を受けます。",
  },
  {
    title: "取引完了",
    body: "講師から完了申請が届いたら内容を確認し、指導が十分であれば承認してください。",
  },
  {
    title: "評価",
    body: "最後にお互いを評価して終了となります。",
  },
] as const

const supportItems = [
  {
    title: "異議申し立てについて",
    body: "万が一、指導が行われない等のトラブルが発生した場合は「異議申し立て」をご利用ください。運営が事実確認を行い、取引の進行や強制終了等の対応を行います。",
  },
  {
    title: "お問い合わせについて",
    body: "フッターにございます「お問い合わせ」より受け付けております。必要に応じてご活用ください。",
  },
] as const

type StepItem = {
  title: string
  body: string
}

function FlowTimeline({ steps }: { steps: readonly StepItem[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        return (
          <div key={step.title}>
            <article className="relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 pl-12 md:pl-14">
              <div className="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border border-red-400/50 bg-red-500/15 text-xs font-bold text-red-300 md:left-5 md:h-7 md:w-7">
                {index + 1}
              </div>
              <h3 className="text-sm font-semibold text-white md:text-base">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{step.body}</p>
            </article>
            {!isLast ? (
              <>
                <div className="flex justify-center py-2 md:hidden">
                  <ArrowDown className="h-4 w-4 text-red-300/80" />
                </div>
                <div className="hidden justify-center py-2 md:flex">
                  <ArrowRight className="h-4 w-4 text-red-300/80" />
                </div>
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default function GuidePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 text-zinc-100">
      <section className="rounded-2xl border border-red-500/25 bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/30 p-6 md:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">GritVibの使い方</h1>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
          >
            <Link href="/">トップページに戻る</Link>
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-zinc-300 md:text-base">
          講師・生徒のどちらでも、安心してスムーズに取引できるように、開始から完了までの流れをまとめました。
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-red-400" />
          <h2 className="text-xl font-bold text-white">1. 講師の方へ：スキルを出品する</h2>
        </div>
        <p className="mb-5 text-sm text-zinc-400 md:text-base">
          あなたの得意な運動スキルを、必要としている人へ届けましょう。
        </p>
        <FlowTimeline steps={teacherSteps} />
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-red-400" />
          <h2 className="text-xl font-bold text-white">2. 生徒の方へ：スキルを購入する</h2>
        </div>
        <p className="mb-5 text-sm text-zinc-400 md:text-base">
          プロや先輩から、自分にぴったりの指導を受けましょう。
        </p>
        <FlowTimeline steps={studentSteps} />
      </section>

      <section className="mt-8 rounded-2xl border border-red-500/25 bg-red-950/15 p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-red-300" />
          <h2 className="text-xl font-bold text-white">3. 安心・安全への取り組み（運営サポート）</h2>
        </div>
        <p className="mb-5 text-sm text-zinc-300 md:text-base">
          GritVibでは、快適な取引のために運営がサポートします。
        </p>
        <div className="space-y-3">
          {supportItems.map((item) => (
            <article key={item.title} className="rounded-xl border border-red-500/20 bg-zinc-900/60 p-4">
              <h3 className="text-sm font-semibold text-white md:text-base">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
