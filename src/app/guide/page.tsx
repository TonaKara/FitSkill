import { Fragment } from "react"
import Link from "next/link"
import { BadgeCheck, Handshake, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ALLOWED_EXTERNAL_TOOLS_ETC } from "@/lib/allowed-external-tools"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"

const sellerSteps = [
  {
    title: "マイページで準備",
    body: "「マイページ」からStripe連携を行い、本人確認・口座設定を完了させます（売上を受け取るために必須となります）。",
  },
  {
    title: "スキルを出品",
    body: "「新しく出品する」ボタンから、あなたが提供できるサービスの内容（テキスト相談、オンライン通話、動画提供、対面指導など）や価格を設定して公開します。",
  },
  {
    title: "事前オファー（相談）の設定",
    body: "購入前の確認質問（最大3つ）を設定できます。購入者の目的や現状を事前に把握することで、お互いのミスマッチを防ぐことができます。",
  },
  {
    title: "オファーの確認と承認",
    body: "購入希望者から届いたオファー内容を確認し、「承認」または「拒否」を選択します。承認されると、購入者が決済（購入）できるようになります。",
  },
  {
    title: "取引・提供開始",
    body: `決済が完了すると専用のチャット画面が開放されます。チャット内でメッセージのやり取りをしたり、${ALLOWED_EXTERNAL_TOOLS_ETC}を使ってスキルを提供します。`,
  },
  {
    title: "完了申請",
    body: "すべてのサービスの提供が終了したら、チャット画面等から「完了申請」を送信してください。購入者側の承認をもって取引が正式に完了します。",
  },
] as const

const buyerSteps = [
  {
    title: "事前オファー（相談）に回答",
    body: "購入を希望するスキルの詳細ページから、出品者の質問に対する回答を入力して送信します。",
  },
  {
    title: "購入（決済）とチャットの開始",
    body: "出品者からオファーが承認されると、決済が可能になります。支払いが完了するとすぐに専用のチャット画面へ案内されます。",
  },
  {
    title: "スキルの受け取り・やり取り",
    body: `チャット画面を使って出品者とコミュニケーションを取り、メッセージでの相談や、共有された外部ツール（${ALLOWED_EXTERNAL_TOOLS_ETC}）を通じてサービスを受け取ります。`,
  },
  {
    title: "取引完了の承認",
    body: "出品者から「完了申請」が届いたら内容を確認し、サービスの提供がしっかりと行われていれば「承認」してください。",
  },
  {
    title: "評価",
    body: "最後に、取引の感想を込めてお互いを評価し、すべて完了となります。",
  },
] as const

const supportItems = [
  {
    title: "異議申し立てについて",
    body: "万が一、「代金を支払ったのにサービスが一切提供されない」「連絡が途絶えてしまった」などのトラブルが発生した場合は、運営へ「異議申し立て」を行うことができます。運営が事実確認を行い、取引の進行サポートや取引の強制終了（返金等）の対応を行います。",
  },
  {
    title: "お問い合わせについて",
    body: "ご不明な点やシステム上の不具合がございましたら、フッターにある「お問い合わせ」よりいつでもお気軽にご連絡ください。",
  },
] as const

type StepItem = {
  title: string
  body: string
}

function FlowStepArrow() {
  return (
    <svg
      viewBox="0 0 28 36"
      className="h-9 w-7 shrink-0 text-primary-readable"
      role="presentation"
      aria-hidden
    >
      <path fill="currentColor" d="M14 36 1 16h9V3h8v13h9L14 36z" />
    </svg>
  )
}

function FlowTimeline({ steps }: { steps: readonly StepItem[] }) {
  return (
    <div className="flex flex-col">
      {steps.map((step, index) => (
        <Fragment key={step.title}>
          <article className="relative w-full rounded-xl border border-border bg-muted/40 p-4 pl-12 md:pl-14">
            <div className="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary-readable md:left-5 md:h-7 md:w-7">
              {index + 1}
            </div>
            <h3 className="text-sm font-semibold text-foreground md:text-base">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </article>
          {index < steps.length - 1 ? (
            <div className="flex h-11 w-full items-center justify-center md:h-12" aria-hidden>
              <FlowStepArrow />
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  )
}

export default function GuidePage() {
  return (
    <main className={CONTENT_PAGE_MAIN_CLASS}>
      <section className="rounded-2xl border border-primary/25 bg-accent p-6 md:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">GritVib 使い方ガイド</h1>
          <Button
            asChild
            variant="outline"
            className="border-border bg-background text-foreground hover:border-primary hover:bg-muted"
          >
            <Link href="/">トップページに戻る</Link>
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          出品者・購入者のどちらでも、安心してスムーズに取引できるように、開始から完了までの流れをまとめました。
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-primary-readable" aria-hidden />
          <h2 className="text-xl font-bold text-foreground">1. 出品者の方へ：あなたの「スキル」を販売する</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground md:text-base">
          あなたの得意なこと、専門知識、デジタルコンテンツを必要としている人へ届けましょう。
        </p>
        <FlowTimeline steps={sellerSteps} />
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary-readable" aria-hidden />
          <h2 className="text-xl font-bold text-foreground">2. 購入者の方へ：スキル・コンテンツを購入する</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground md:text-base">
          クリエイターや専門家から、自分にぴったりのスキルやサポートを受けましょう。
        </p>
        <FlowTimeline steps={buyerSteps} />
      </section>

      <section className="mt-8 rounded-2xl border border-primary/20 bg-accent/50 p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary-readable" aria-hidden />
          <h2 className="text-xl font-bold text-foreground">3. 安心・安全への取り組み（運営サポート）</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground md:text-base">
          GritVibでは、すべての利用者が快適に取引を行えるよう、運営がバックアップします。
        </p>
        <div className="space-y-3">
          {supportItems.map((item) => (
            <article key={item.title} className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground md:text-base">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
