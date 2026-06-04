export function Sidebar() {
  return (
    <aside className="w-60 border-r border-bdr-light bg-white p-3 hidden md:flex md:flex-col">
      <div className="text-xs uppercase tracking-wider text-txt-tertiary px-2 mb-2">Today</div>
      <ul className="space-y-1 text-sm text-txt-primary">
        <li className="px-2 py-1 rounded-card hover:bg-surface-secondary cursor-pointer">New conversation</li>
      </ul>
      <div className="text-xs uppercase tracking-wider text-txt-tertiary px-2 mb-2 mt-4">Modules</div>
      <ul className="space-y-1 text-sm text-txt-secondary">
        <li className="px-2 py-1 rounded-card text-txt-tertiary">Coming in next slice…</li>
      </ul>
    </aside>
  )
}
