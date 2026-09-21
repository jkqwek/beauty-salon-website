import { isRouteErrorResponse, NavLink, useRouteError } from "react-router"

export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-pearl px-6 text-center">
      <h1 className="text-4xl font-serif text-foreground">
        {notFound ? "Страница не найдена" : "Что-то пошло не так"}
      </h1>
      <p className="text-muted-foreground max-w-md">
        {notFound
          ? "Такой страницы нет. Возможно, ссылка устарела."
          : "Произошла непредвиденная ошибка. Попробуйте обновить страницу."}
      </p>
      <NavLink
        to="/"
        reloadDocument
        className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors"
      >
        На главную
      </NavLink>
    </div>
  )
}