import { useState } from "react"
import { useOutletContext } from "react-router"
import heroPhoto from "@/imports/image.png"
import detailPhoto from "@/imports/image-1.png"
import { ImageWithFallback } from "../components/ImageWithFallback"
import { Clock } from "lucide-react"

const CATEGORIES = ["All", "Hair", "Nails", "Skin", "Massage"]

const SERVICES = [
  {
    id: 1,
    category: "Hair",
    name: "Balayage & Blowout",
    desc: "Hand-painted highlights for a natural, sun-kissed look, finished with a voluminous blowout.",
    time: "120 min",
    price: "$250",
  },
  {
    id: 2,
    category: "Hair",
    name: "Signature Haircut",
    desc: "Precision cut tailored to your face shape and lifestyle.",
    time: "60 min",
    price: "$95",
  },
  {
    id: 3,
    category: "Nails",
    name: "Gel Extensions",
    desc: "Long-lasting, structured gel extensions with custom art.",
    time: "90 min",
    price: "$85",
  },
  {
    id: 4,
    category: "Nails",
    name: "Classic Manicure",
    desc: "Essential nail care, cuticle work, and perfect polish application.",
    time: "45 min",
    price: "$40",
  },
  {
    id: 5,
    category: "Skin",
    name: "Hydrating Facial",
    desc: "Deep cleanse, exfoliation, and intense hydration treatment.",
    time: "60 min",
    price: "$120",
  },
  {
    id: 6,
    category: "Skin",
    name: "Chemical Peel",
    desc: "Advanced resurfacing for glowing, renewed skin.",
    time: "45 min",
    price: "$150",
  },
  {
    id: 7,
    category: "Massage",
    name: "Swedish Massage",
    desc: "Full body relaxation massage to melt away tension.",
    time: "60 min",
    price: "$110",
  },
  {
    id: 8,
    category: "Massage",
    name: "Deep Tissue",
    desc: "Targeted therapy for muscle knots and chronic pain.",
    time: "90 min",
    price: "$160",
  },
]

export function ServicesPage() {
  const [activeCategory, setActiveCategory] = useState("All")
  const { openBooking } = useOutletContext<{ openBooking: () => void }>()

  const filteredServices =
    activeCategory === "All"
      ? SERVICES
      : SERVICES.filter((s) => s.category === activeCategory)

  return (
    <div className="flex-1 bg-pearl pb-24">
      {/* Header */}
      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">
          Our Services
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Explore our menu of luxurious treatments designed to elevate your
          beauty and wellness journey.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-12">
        {/* Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
                activeCategory === cat
                  ? "bg-gold text-white border-gold shadow-md"
                  : "bg-white text-muted-foreground border-rose-200 hover:border-gold/50 hover:text-gold"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex flex-col gap-6">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="flex flex-col md:flex-row bg-white rounded-3xl overflow-hidden border border-rose-100 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="w-full md:w-64 h-48 md:h-auto overflow-hidden">
                <ImageWithFallback
                  src={
                    service.category === "Hair" || service.category === "Skin"
                      ? detailPhoto
                      : heroPhoto
                  }
                  alt={service.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>

              <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                <div className="flex justify-between items-start mb-2 gap-4">
                  <h3 className="text-2xl font-serif text-foreground">
                    {service.name}
                  </h3>
                  <span className="text-xl font-medium text-gold shrink-0">
                    {service.price}
                  </span>
                </div>

                <p className="text-muted-foreground mb-6 line-clamp-2 md:line-clamp-none">
                  {service.desc}
                </p>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="size-4" /> {service.time}
                  </div>
                  <button
                    onClick={openBooking}
                    className="bg-white border-2 border-gold text-gold hover:bg-gold hover:text-white px-6 py-2 rounded-full text-sm font-medium transition-colors"
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
