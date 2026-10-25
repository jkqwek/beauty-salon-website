import { t } from "@/lib/i18n"
import { isRouteErrorResponse, NavLink, useRouteError } from "react-router"

export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-pearl px-6 text-center">
      <h1 className="text-4xl font-serif text-foreground">
        {notFound ? t("Страница не найдена") : t("Что-то пошло не так")}
      </h1>
      <p className="text-muted-foreground max-w-md">
        {notFound
          ? t("Такой страницы нет. Возможно, ссылка устарела.")
          : t("Произошла непредвиденная ошибка. Попробуйте обновить страницу.")}
      </p>
      <NavLink
        to="/"
        className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors"
      >
        {t("На главную")}
      </NavLink>
    </div>
  )
}