export function MasterCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-rose-100 p-8 text-center shadow-sm flex flex-col items-center animate-pulse">
      {/* Аватар */}
      <div className="size-24 rounded-full bg-rose-100 mb-5" />

      {/* Имя мастера */}
      <div className="h-6 w-3/4 bg-rose-100 rounded-md mb-3" />

      {/* Специализация */}
      <div className="h-4 w-1/2 bg-rose-100 rounded-md mb-6" />

      {/* Кнопка записи */}
      <div className="h-10 w-full bg-rose-100 rounded-full mt-auto" />
    </div>
  )
}