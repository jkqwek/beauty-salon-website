import { NavLink, useOutletContext } from "react-router"
import heroPhoto from "@/imports/image.png"
import detailPhoto from "@/imports/image-1.png"
import {
  ArrowRight,
  Droplets,
  Scissors,
  Sparkles,
  UserCircle2,
} from "lucide-react"
import { ImageWithFallback } from "../components/ImageWithFallback"

export function HomePage() {
  const { openBooking } = useOutletContext<{ openBooking: () => void }>()

  return (
    <div className="flex flex-col flex-1">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <ImageWithFallback
            src={heroPhoto}
            alt="Allure salon luxurious interior with soft lighting and elegant furniture"
            className="w-full h-full object-cover blur-sm opacity-80"
          />
          <div className="absolute inset-0 bg-rose-50/70 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-pearl via-pearl/40 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <span className="inline-block px-4 py-1 mb-6 rounded-full border border-gold/30 bg-pearl/60 backdrop-blur-sm text-gold font-medium text-sm tracking-widest uppercase">
            Welcome to Allure
          </span>
          <h1 className="text-5xl md:text-7xl font-serif text-foreground mb-6 leading-tight drop-shadow-sm">
            Where Beauty <br />
            <span className="text-gold-gradient italic">Meets Elegance.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-medium">
            Experience the pinnacle of sophisticated pampering in a serene,
            modern oasis designed exclusively for your well-being.
          </p>
          <button
            onClick={openBooking}
            className="gold-gradient text-white px-10 py-4 rounded-full text-lg font-semibold hover:shadow-[0_10px_30px_rgba(212,175,55,0.3)] hover:-translate-y-1 transition-all duration-300"
          >
            Book Appointment
          </button>
        </div>
      </section>

      {/* Services Preview */}
      <section className="py-24 bg-pearl relative">
        <div className="absolute top-0 left-0 w-64 h-64 bg-rose-100 rounded-full blur-3xl opacity-40 -translate-x-1/2 -translate-y-1/2"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
            <div>
              <h2 className="text-4xl font-serif text-foreground mb-4">
                Our Services
              </h2>
              <p className="text-muted-foreground max-w-xl">
                Curated treatments tailored to enhance your natural beauty and
                provide ultimate relaxation.
              </p>
            </div>
            <NavLink
              to="/services"
              className="text-gold font-medium flex items-center gap-2 hover:gap-3 transition-all hover:text-gold-hover"
            >
              View All Services <ArrowRight className="size-4" />
            </NavLink>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              {
                name: "Hair Styling",
                icon: Scissors,
                desc: "Cuts, color & treatments",
              },
              {
                name: "Nail Care",
                icon: Sparkles,
                desc: "Manicure & pedicure",
              },
              {
                name: "Massage",
                icon: UserCircle2,
                desc: "Relaxation & therapy",
              },
              { name: "Skincare", icon: Droplets, desc: "Facials & peels" },
            ].map((service, i) => (
              <div
                key={i}
                className="group flex flex-col items-center text-center p-8 rounded-3xl bg-white border border-rose-100 shadow-sm hover:shadow-lg hover:border-gold/30 transition-all duration-300 cursor-pointer"
              >
                <div className="size-16 rounded-full bg-rose-50 text-gold flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <service.icon className="size-8 stroke-[1.5]" />
                </div>
                <h3 className="text-xl font-serif text-foreground mb-2">
                  {service.name}
                </h3>
                <p className="text-sm text-muted-foreground">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet the Masters */}
      <section className="py-24 bg-rose-50 border-y border-rose-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-serif text-foreground mb-4">
              Meet the Masters
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Our team of award-winning professionals is dedicated to bringing
              your vision to life.
            </p>
          </div>

          <div className="flex overflow-x-auto pb-10 -mx-6 px-6 gap-8 snap-x hide-scrollbar">
            {[
              { name: "Elena Rostova", role: "Senior Stylist & Colorist" },
              { name: "Sophia Lin", role: "Lead Esthetician" },
              { name: "Isabella Cruz", role: "Nail Art Specialist" },
              { name: "Marcus Thorne", role: "Massage Therapist" },
            ].map((master, i) => (
              <div
                key={i}
                className="snap-center shrink-0 w-[280px] flex flex-col items-center group cursor-pointer"
              >
                <div className="size-48 rounded-full p-2 border-2 border-transparent group-hover:border-gold transition-colors duration-500 mb-6">
                  <div className="size-full rounded-full overflow-hidden bg-rose-100 relative">
                    <ImageWithFallback
                      src={detailPhoto}
                      alt={master.name}
                      className="size-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                    />
                  </div>
                </div>
                <h3 className="text-2xl font-serif text-foreground mb-1 group-hover:text-gold transition-colors">
                  {master.name}
                </h3>
                <p className="text-sm font-medium text-gold/80">
                  {master.role}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-4">
            <NavLink
              to="/masters"
              className="inline-block px-8 py-3 rounded-full border-2 border-gold text-gold font-medium hover:bg-gold hover:text-white transition-colors"
            >
              View Full Team
            </NavLink>
          </div>
        </div>
      </section>
    </div>
  )
}
