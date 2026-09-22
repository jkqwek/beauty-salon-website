import {
  RouterProvider,
  createBrowserRouter,
  Outlet,
  NavLink,
} from "react-router"
import { Sparkles, Calendar, User, Menu, X, LogOut } from "lucide-react"
import { useState } from "react"
import { HomePage } from "./pages/HomePage"
import { MastersPage } from "./pages/MastersPage"
import { ServicesPage } from "./pages/ServicesPage"
import { ProfilePage } from "./pages/ProfilePage"
import { BookingWizard } from "./components/BookingWizard"
import { AuthModal } from "./components/AuthModal"
import { RouteError } from "./components/RouteError"
import { AuthProvider, useAuth } from "./auth/AuthContext"
import { DashboardPage } from "./pages/DashboardPage"

function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const { user, logout } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [resumeBooking, setResumeBooking] = useState(false)

  // Запись только для вошедших: гостю сначала показываем вход
  const openBooking = () => {
    if (user) setBookingOpen(true)
    else {
      setResumeBooking(true)
      setAuthOpen(true)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-clip bg-pearl text-foreground selection:bg-gold/20 selection:text-gold">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-pearl/90 backdrop-blur-md border-b border-rose-100/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <NavLink
            to="/"
            className="text-2xl font-serif text-gold flex items-center gap-2"
          >
            <Sparkles className="size-5" />
            <span>Allure</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-8">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-gold ${
                  isActive ? "text-gold" : "text-muted-foreground"
                }`
              }
            >
              Главная
            </NavLink>
            <NavLink
              to="/services"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-gold ${
                  isActive ? "text-gold" : "text-muted-foreground"
                }`
              }
            >
              Услуги
            </NavLink>
            <NavLink
              to="/masters"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-gold ${
                  isActive ? "text-gold" : "text-muted-foreground"
                }`
              }
            >
              Мастера
            </NavLink>
            {user?.is_staff && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-gold ${
                    isActive ? "text-gold" : "text-muted-foreground"
                  }`
                }
              >
                Дашборд
              </NavLink>
            )}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <NavLink
                  to="/profile"
                  className="p-2 text-muted-foreground hover:text-gold transition-colors"
                >
                  <User className="size-5" />
                </NavLink>
                <button
                  onClick={logout}
                  title="Выйти"
                  className="p-2 text-muted-foreground hover:text-gold transition-colors"
                >
                  <LogOut className="size-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="text-sm font-medium text-muted-foreground hover:text-gold transition-colors"
              >
                Войти
              </button>
            )}
            <button
              onClick={openBooking}
              className="bg-gold hover:bg-gold-hover text-white px-6 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow-md"
            >
              Записаться
            </button>
          </div>

          <button
            className="md:hidden p-2 text-muted-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
          <div className="md:hidden absolute top-20 left-0 w-full bg-pearl border-b border-rose-100 p-6 flex flex-col gap-4 shadow-lg">
            <NavLink
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium text-foreground"
            >
              Главная
            </NavLink>
            <NavLink
              to="/services"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium text-foreground"
            >
              Услуги
            </NavLink>
            <NavLink
              to="/masters"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium text-foreground"
            >
              Мастера
            </NavLink>
            <NavLink
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium text-foreground"
            >
              Профиль
            </NavLink>
            {user?.is_staff && (
              <NavLink
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-foreground"
              >
                Дашборд
              </NavLink>
            )}
            {user ? (
              <button
                onClick={() => {
                  logout()
                  setMobileMenuOpen(false)
                }}
                className="text-lg font-medium text-foreground text-left"
              >
                Выйти
              </button>
            ) : (
              <button
                onClick={() => {
                  setAuthOpen(true)
                  setMobileMenuOpen(false)
                }}
                className="text-lg font-medium text-foreground text-left"
              >
                Войти
              </button>
            )}
            <button
              onClick={() => {
                openBooking()
                setMobileMenuOpen(false)
              }}
              className="bg-gold text-white px-6 py-3 rounded-full text-center font-medium mt-4"
            >
              Записаться
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet context={{ openBooking, openAuth: () => setAuthOpen(true) }} />
      </main>

      {/* Footer */}
      <footer className="bg-rose-50 border-t border-rose-100 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-xl font-serif text-gold flex items-center gap-2">
            <Sparkles className="size-5" />
            Allure
          </div>
          <p className="text-muted-foreground text-sm text-center md:text-left">
            © 2026 Allure Beauty Salon. Все права защищены.
          </p>
          <div className="flex gap-4">
            <span className="text-sm text-muted-foreground hover:text-gold cursor-pointer transition-colors">
              ВКонтакте
            </span>
            <span className="text-sm text-muted-foreground hover:text-gold cursor-pointer transition-colors">
              Telegram
            </span>
          </div>
        </div>
      </footer>

      {/* Sticky Book Now Button (Mobile primarily, or floating) */}
      <button
        onClick={openBooking}
        className="fixed bottom-6 right-6 md:hidden z-50 bg-gold text-white p-4 rounded-full shadow-lg hover:bg-gold-hover transition-transform hover:scale-105 active:scale-95"
      >
        <Calendar className="size-6" />
      </button>

      {/* Booking Modal */}
      {bookingOpen && <BookingWizard onClose={() => setBookingOpen(false)} />}

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
      { path: "profile", Component: ProfilePage },
      { path: "dashboard", Component: DashboardPage },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}