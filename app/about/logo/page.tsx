import Link from "next/link"
import { BrandMarkSvg } from "@/components/BrandMarkSvg"
import { Button } from "@/components/ui/button"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"

export default function LogoAboutPage() {
  return (
    <main className={CONTENT_PAGE_MAIN_CLASS}>
      <section className="mb-8 rounded-2xl border border-primary/25 bg-accent p-6 md:p-8 dark:border-red-500/25 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-900 dark:to-red-950/30">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">ブランドロゴ</h1>
          <Button
            asChild
            variant="outline"
            className="border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80"
          >
            <Link href="/">トップページに戻る</Link>
          </Button>
        </div>

        <div className="p-1 md:p-2">
          <div className="flex h-52 w-full items-center justify-center rounded-xl border border-border bg-muted/50 md:h-72">
            <div className="inline-flex max-w-full items-center gap-4 px-2 md:gap-8">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#e64a19] md:h-40 md:w-40">
                <BrandMarkSvg className="h-20 w-20 md:h-32 md:w-32" />
              </div>
              <span className="text-4xl font-bold leading-none tracking-tight md:text-7xl">
                <span className="text-[#e64a19]">Grit</span>
                <span className="text-foreground">Vib</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">GritVibのロゴに込めた想い</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          <p>
            「GritVib（グリット・ヴィブ）」という名前に込めたのは、折れない心と共鳴です。GritVibは、単なるスキルの売り買いの場ではありません。「Grit（やり抜く力・気概）」を持つ人たちが、その熱量を「Vibe（共鳴）」させ、新しい挑戦を後押しする場所として誕生しました。
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">1. イントロダクション</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          <p>GritVibは、努力の途中にいる人の熱量を価値に変え、次の挑戦者へつなぐためのコミュニティです。</p>
          <p>
            このロゴには、「挑戦を始める瞬間」と「積み重ねる時間」を、ひとつのシンボルとして表現したいという意思を込めています。
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">2. シンボル：隠されたストーリー</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-border bg-muted/50 p-4">
            <h3 className="text-base font-semibold text-foreground">GOAT（Greatest of All Time）への敬意</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              ロゴを構成する三角形のパーツは、山岳地帯を力強く登り続ける「ヤギ（GOAT）」の蹄跡（ひづめのあと）をモチーフにしています。
            </p>
          </article>
          <article className="rounded-xl border border-border bg-muted/50 p-4">
            <h3 className="text-base font-semibold text-foreground">頂点を目指す「Grit」</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              隠された三角形は、目標に向かって一歩ずつ着実に進むステップを表現しており、全体でヤギの角（ホーン）のシルエットを形成しています。
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">3. コンセプト：経歴よりも、今の情熱を</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          <p className="font-semibold text-foreground">「誰でも教えられる。誰でも挑戦できる。」</p>
          <p>このロゴには、「完成されたプロ」だけでなく、「今まさに努力している人」を肯定したいという想いを込めました。</p>
          <p>
            豪華な経歴がなくても、あなたの持つ独自の視点や「好き」への情熱が、誰かの「一歩」を支える力になります。
          </p>
          <p>
            私たちは、この小さな蹄跡（ロゴ）のように、一人ひとりの挑戦が積み重なり、大きな山を登り切るための力となれるようなコミュニティを目指しています。
          </p>
        </div>
      </section>
    </main>
  )
}
