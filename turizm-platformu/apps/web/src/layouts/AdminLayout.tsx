import { Link, Outlet } from 'react-router-dom'

/** Yönetim arayüzü — kullanıcı menüsünden ayrı; hava efektleri yok. */
export default function AdminLayout() {
  return (
    <div className="admin-shell flex min-h-dvh flex-col bg-slate-100 text-slate-900">
      <header className="border-b border-slate-300 bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Yönetim paneli</h1>
            <p className="text-xs text-slate-300">Sadece yöneticiler — kullanıcı sitesinden ayrı</p>
          </div>
          <Link to="/" className="rounded bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
            ← Kullanıcı sitesi (harita)
          </Link>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <footer className="border-t border-slate-300 bg-white px-4 py-2 text-center text-xs text-slate-500">
        Tam veri düzenleme: <code className="rounded bg-slate-100 px-1">destinasyon\baslat-panel.bat</code>
      </footer>
    </div>
  )
}
