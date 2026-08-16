interface Props {
  icon: React.ReactNode
  title: string
  description: string
}

export function ComingSoonPanel({ icon, title, description }: Props) {
  return (
    <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 ring-1 ring-gray-200">
        {icon}
      </div>
      <p className="mt-4 text-base font-semibold text-gray-800">{title}</p>
      <p className="mt-1.5 max-w-xs text-center text-sm text-gray-400">{description}</p>
    </div>
  )
}
