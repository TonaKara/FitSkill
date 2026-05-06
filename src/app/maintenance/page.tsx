export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12 text-zinc-100">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
        <h1 className="text-3xl font-black text-white">メンテナンス中</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          現在システムメンテナンスを実施しています。ご不便をおかけしますが、しばらくしてから再度アクセスしてください。
        </p>
      </div>
    </div>
  )
}
