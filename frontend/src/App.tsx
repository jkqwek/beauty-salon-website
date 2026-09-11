import {
  RouterProvider,
  createBrowserRouter,
  Outlet,
  NavLink,
} from "react-router"
import { Sparkles, Calendar, User, Menu, X } from "lucide-react"
import { useState } from "react"
import { HomePage } from "./pages/HomePage"
import { MastersPage } from "./pages/MastersPage"

function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)

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
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <NavLink
              to="/profile"
              className="p-2 text-muted-foreground hover:text-gold transition-colors"
            >
              <User className="size-5" />
            </NavLink>
            <button
              onClick={() => setBookingOpen(true)}
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
            <button
              onClick={() => {
                setBookingOpen(true)
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
        <Outlet context={{ openBooking: () => setBookingOpen(true) }} />
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
        onClick={() => setBookingOpen(true)}
        className="fixed bottom-6 right-6 md:hidden z-50 bg-gold text-white p-4 rounded-full shadow-lg hover:bg-gold-hover transition-transform hover:scale-105 active:scale-95"
      >
        <Calendar className="size-6" />
      </button>

      {/* Booking Modal */}
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: "masters", Component: MastersPage },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
