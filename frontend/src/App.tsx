import { LanguageProvider, t, useLang } from "./lib/i18n"
import {
  RouterProvider,
  createBrowserRouter,
  Outlet,
  NavLink,
} from "react-router"
import { Sparkles, Calendar, Menu, X, LogOut, Globe } from "lucide-react"
import { useState } from "react"
import { HomePage } from "./pages/HomePage"
import { MastersPage } from "./pages/MastersPage"
import { ServicesPage } from "./pages/ServicesPage"
import { ProfilePage } from "./pages/ProfilePage"
import { BookingWizard, type BookingPrefill } from "./components/BookingWizard"
import { AuthModal } from "./components/AuthModal"
import { RouteError } from "./components/RouteError"
import { AuthProvider, useAuth } from "./auth/AuthContext"
import { PanelLayout, panelRoutes } from "./pages/PanelPage"
import { ReviewsPage } from "./pages/ReviewsPage"
import { BackToTopButton } from "./components/BackToTopButton"
import { Avatar } from "./components/Avatar"
import { formatTime, hoursUntil, relativeDay } from "./lib/format"
import { BugReportModal } from "./components/BugReportModal"

function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const { user, logout, refreshUser } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [resumeBooking, setResumeBooking] = useState(false)
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | null>(null)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [bugReportOpen, setBugReportOpen] = useState(false)

  // запись в ближайшие 24 часа — золотая точка на аватаре и в мобильном меню
  const next = user?.next_booking
  const soon =
    next && hoursUntil(next.date, next.start_time) <= 24
      ? t("Запись {day} в {time}", { day: relativeDay(next.date), time: formatTime(next.start_time) })
      : null
  const dot = (
    <span className="absolute top-0 right-0 size-3 rounded-full bg-gold ring-2 ring-pearl" aria-hidden="true" />
  )

  // Запись только для вошедших: гостю сначала показываем вход
  const openBooking = () => {
    if (user) setBookingOpen(true)
    else {
      setResumeBooking(true)
      setAuthOpen(true)
    }
  }

  // «Записаться снова» из истории визитов
  const rebook = (prefill: BookingPrefill) => {
    setBookingPrefill(prefill)
    openBooking()
  }

  const closeBooking = () => {
    setBookingOpen(false)
    setBookingPrefill(null)
    if (user) refreshUser() // новая запись могла стать ближайшей
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-clip bg-pearl text-foreground selection:bg-gold/20 selection:text-gold">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-pearl/90 backdrop-blur-md border-b border-rose-100/50">
        {/* Сетка из трёх равных колонок: логотип слева, меню в центре, действия справа */}
        <div className="max-w-7xl mx-auto px-6 h-20 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Логотип */}
          <NavLink
            to="/"
            className="text-2xl font-serif text-gold flex items-center gap-2 justify-self-start"
          >
            <Sparkles className="size-5" />
            <span>Allure</span>
          </NavLink>

          {/* Меню — по центру страницы */}
          <nav className="hidden lg:flex items-center justify-center gap-8">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm font-medium whitespace-nowrap transition-colors hover:text-gold ${
                  isActive ? "text-gold" : "text-muted-foreground"
                }`
              }
            >
              {t("Главная")}
            </NavLink>
            <NavLink
              to="/services"
              className={({ isActive }) =>
                `text-sm font-medium whitespace-nowrap transition-colors hover:text-gold ${
                  isActive ? "text-gold" : "text-muted-foreground"
                }`
              }
            >
              {t("Услуги")}
            </NavLink>
            <NavLink
              to="/masters"
              className={({ isActive }) =>
                `text-sm font-medium whitespace-nowrap transition-colors hover:text-gold ${
                  isActive ? "text-gold" : "text-muted-foreground"
                }`
              }
            >
              {t("Мастера")}
            </NavLink>
            <NavLink
              to="/reviews"
              className={({ isActive }) =>
                `text-sm font-medium whitespace-nowrap transition-colors hover:text-gold ${
                  isActive ? "text-gold" : "text-muted-foreground"
                }`
              }
            >
              {t("Отзывы")}
            </NavLink>
            {user?.is_staff && (
              <NavLink
                to="/panel"
                className={({ isActive }) =>
                  `text-sm font-medium whitespace-nowrap transition-colors hover:text-gold ${
                    isActive ? "text-gold" : "text-muted-foreground"
                  }`
                }
              >
                {t("Панель")}
              </NavLink>
            )}
          </nav>

          {/* Действия — прижаты вправо */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-4 justify-self-end">
            <LangSwitch />
            {user ? (
              <>
                <NavLink
                  to="/profile"
                  title={soon ?? t("Личный кабинет")}
                  aria-label={soon ? `${t("Личный кабинет")}. ${soon}` : t("Личный кабинет")}
                  className="relative rounded-full hover:ring-2 hover:ring-gold/40 transition-shadow"
                >
                  <Avatar
                    src={user.avatar}
                    name={[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}
                    className="size-9 text-xs"
                  />
                  {soon && dot}
                </NavLink>
                <button
                  onClick={() => setLogoutOpen(true)}
                  title={t("Выйти")}
                  className="p-2 text-muted-foreground hover:text-gold transition-colors"
                >
                  <LogOut className="size-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="text-sm font-medium text-muted-foreground hover:text-gold transition-colors whitespace-nowrap"
              >
                {t("Войти")}
              </button>
            )}
            <button
              onClick={openBooking}
              className="bg-gold hover:bg-gold-hover text-white px-6 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow-md whitespace-nowrap"
            >
              {t("Записаться")}
            </button>
          </div>

          {/* Мобильный бургер — прижат вправо */}
          <button
            className="lg:hidden p-2 text-muted-foreground justify-self-end col-start-3"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={t("Меню")}
          >
            {mobileMenuOpen ? (
              <X className="size-6" />
            ) : (
              <Menu className="size-6" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-20 left-0 w-full bg-pearl border-b border-rose-100 p-6 flex flex-col gap-4 shadow-lg">
            <NavLink
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium text-foreground"
            >
              {t("Главная")}
            </NavLink>
            <NavLink
              to="/services"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium text-foreground"
            >
              {t("Услуги")}
            </NavLink>
            <NavLink
              to="/masters"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium text-foreground"
            >
              {t("Мастера")}
            </NavLink>
            <NavLink
              to="/reviews"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium text-foreground"
            >
              {t("Отзывы")}
            </NavLink>
            <NavLink
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium text-foreground flex items-center gap-2"
            >
              {t("Профиль")}
              {soon && (
                <span className="flex items-center gap-1.5 text-sm font-normal text-gold-dark">
                  <span className="size-2.5 rounded-full bg-gold" aria-hidden="true" />
                  {soon}
                </span>
              )}
            </NavLink>
            {user?.is_staff && (
              <NavLink
                to="/panel"
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-foreground"
              >
                {t("Панель")}
              </NavLink>
            )}
            <LangSwitch className="text-lg text-foreground" />
            {user ? (
              <button
                onClick={() => {
                  setLogoutOpen(true)
                  setMobileMenuOpen(false)
                }}
                className="text-lg font-medium text-foreground text-left"
              >
                {t("Выйти")}
              </button>
            ) : (
              <button
                onClick={() => {
                  setAuthOpen(true)
                  setMobileMenuOpen(false)
                }}
                className="text-lg font-medium text-foreground text-left"
              >
                {t("Войти")}
              </button>
            )}
            <button
              onClick={() => {
                openBooking()
                setMobileMenuOpen(false)
              }}
              className="bg-gold text-white px-6 py-3 rounded-full text-center font-medium mt-4"
            >
              {t("Записаться")}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet context={{ openBooking, rebook, openAuth: () => setAuthOpen(true) }} />
      </main>

      {/* Footer */}
      <footer className="bg-rose-50 border-t border-rose-100 py-12 px-6">
        {/* Используем grid для идеального выравнивания: 1fr (лого) - 1fr (текст) - 1fr (ссылки) */}
        <div className="max-w-7xl mx-auto flex flex-col md:grid md:grid-cols-3 items-center gap-6 md:gap-0">
          
          {/* Логотип (слева) */}
          <div className="flex justify-center md:justify-self-start">
            <div className="text-xl font-serif text-gold flex items-center gap-2">
              <Sparkles className="size-5" />
              Allure
            </div>
          </div>

          {/* Копирайт (строго по центру) */}
          <p className="text-muted-foreground text-sm text-center md:justify-self-center">
            {t("© 2026 Allure Beauty Salon. Все права защищены.")}
          </p>

          {/* Ссылки (справа) */}
          <div className="flex justify-center md:justify-self-end gap-4 items-center">
            <span className="text-sm text-muted-foreground hover:text-gold cursor-pointer transition-colors">
              {t("ВКонтакте")}
            </span>
            <span className="text-sm text-muted-foreground hover:text-gold cursor-pointer transition-colors">
              Telegram
            </span>
            
            <button 
              onClick={() => setBugReportOpen(true)} 
              className="text-sm text-muted-foreground hover:text-rose-500 transition-colors border-l border-rose-200 pl-4 ml-2"
            >
              {t("Сообщить об ошибке")}
            </button>
          </div>
          
        </div>
      </footer>

      {/* Sticky Book Now Button (Mobile primarily, or floating) */}
      <button
        onClick={openBooking}
        className="fixed bottom-6 right-6 lg:hidden z-50 bg-gold text-white p-4 rounded-full shadow-lg hover:bg-gold-hover transition-transform hover:scale-105 active:scale-95"
      >
        <Calendar className="size-6" />
      </button>

      {/* Back to top */}
      <BackToTopButton />

      {/* Booking Modal */}
      {bookingOpen &&
        (user?.is_blocked ? (
          <BlockedNotice onClose={closeBooking} />
        ) : (
          <BookingWizard prefill={bookingPrefill} onClose={closeBooking} />
        ))}

      {logoutOpen && (
        <LogoutConfirm
          onClose={() => setLogoutOpen(false)}
          onConfirm={() => {
            setLogoutOpen(false)
            logout()
          }}
        />
      )}

      {/* Auth Modal */}
      {authOpen && (
        <AuthModal
          onClose={() => {
            setAuthOpen(false)
            setResumeBooking(false)
          }}
          onSuccess={() => {
            setAuthOpen(false)
            if (resumeBooking) {
              setResumeBooking(false)
              setBookingOpen(true)
            }
          }}
        />
      )}

      {/* Bug Report Modal */}
      {bugReportOpen && <BugReportModal onClose={() => setBugReportOpen(false)} />}
      
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    ErrorBoundary: RouteError,
    children: [
      { index: true, Component: HomePage },
      { path: "services", Component: ServicesPage },
      { path: "masters", Component: MastersPage },
      { path: "reviews", Component: ReviewsPage },
      { path: "profile", Component: ProfilePage },
      { path: "panel", Component: PanelLayout, children: panelRoutes },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </AuthProvider>
  )
}

/** Переключатель языка RU / EN */
function LangSwitch({ className = "text-sm" }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <button
      onClick={() => setLang(lang === "ru" ? "en" : "ru")}
      title={t("Сменить язык")}
      aria-label={t("Сменить язык")}
      className={`inline-flex items-center gap-1.5 font-medium hover:text-gold transition-colors ${className} ${className.includes("text-foreground") ? "" : "text-muted-foreground"}`}
    >
      <Globe className="size-4" /> {lang === "ru" ? "EN" : "RU"}
    </button>
  )
}

function BlockedNotice({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="blocked-title"
        className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center space-y-4"
      >
        <h2 id="blocked-title" className="text-2xl font-serif text-foreground">
          {t("Запись недоступна")}
        </h2>
        <p className="text-muted-foreground">{t("Онлайн-запись недоступна. Свяжитесь с салоном.")}</p>
        <button
          onClick={onClose}
          autoFocus
          className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors"
        >
          {t("Понятно")}
        </button>
      </div>
    </div>
  )
}

function LogoutConfirm({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center space-y-4"
      >
        <h2 id="logout-title" className="text-2xl font-serif text-foreground">
          {t("Выйти из аккаунта?")}
        </h2>
        <p className="text-muted-foreground">{t("Чтобы записаться или посмотреть свои записи, нужно будет войти снова.")}</p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={onClose}
            autoFocus
            className="px-6 py-3 rounded-full border border-rose-200 text-foreground font-medium hover:bg-rose-50 transition-colors"
          >
            {t("Отмена")}
          </button>
          <button
            onClick={onConfirm}
            className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors"
          >
            {t("Выйти")}
          </button>
        </div>
      </div>
    </div>
  )
}