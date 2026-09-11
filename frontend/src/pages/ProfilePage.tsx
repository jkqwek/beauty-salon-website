import { useState } from "react"
import {
  User,
  Calendar,
  Clock,
  CheckCircle2,
  MoreVertical,
  Upload,
} from "lucide-react"

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState("appointments")

  return (
    <div className="flex-1 bg-pearl pb-24">
      {/* Header */}
      <div className="bg-rose-50 border-b border-rose-100 py-12 px-6">
        <div className="max-w-5xl mx-auto flex items-center gap-6">
          <div className="size-24 rounded-full bg-white border-2 border-gold flex items-center justify-center text-gold text-3xl font-serif">
            AS
          </div>
          <div>
            <h1 className="text-3xl font-serif text-foreground mb-1">
              Anna Smith
            </h1>
            <p className="text-muted-foreground">anna.smith@example.com</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-10 flex flex-col md:flex-row gap-10">
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="bg-white rounded-3xl border border-rose-100 overflow-hidden flex flex-col p-2">
            <button
              onClick={() => setActiveTab("appointments")}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-medium transition-colors ${
                activeTab === "appointments"
                  ? "bg-rose-50 text-gold"
                  : "text-muted-foreground hover:bg-rose-50/50"
              }`}
            >
              <Calendar className="size-5" /> Appointments
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-medium transition-colors ${
                activeTab === "history"
                  ? "bg-rose-50 text-gold"
                  : "text-muted-foreground hover:bg-rose-50/50"
              }`}
            >
              <Clock className="size-5" /> Visit History
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-medium transition-colors ${
                activeTab === "profile"
                  ? "bg-rose-50 text-gold"
                  : "text-muted-foreground hover:bg-rose-50/50"
              }`}
            >
              <User className="size-5" /> Edit Profile
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1">
          {activeTab === "appointments" && (
            <div>
              <h2 className="text-2xl font-serif text-foreground mb-6">
                Upcoming Appointments
              </h2>
              <div className="space-y-4">
                <div className="bg-white border border-gold/30 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-gold"></div>
                  <div>
                    <div className="flex items-center gap-2 text-gold font-medium mb-1">
                      <Calendar className="size-4" /> Tomorrow, Oct 24 • 10:00
                      AM
                    </div>
                    <h3 className="text-xl font-serif text-foreground mb-2">
                      Signature Haircut
                    </h3>
                    <p className="text-muted-foreground flex items-center gap-2">
                      <User className="size-4" /> Elena Rostova
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="px-6 py-2 rounded-full border border-gold text-gold font-medium hover:bg-gold/10 transition-colors">
                      Reschedule
                    </button>
                    <button className="px-6 py-2 rounded-full bg-rose-50 border border-rose-200 text-rose-600 font-medium hover:bg-rose-100 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div>
              <h2 className="text-2xl font-serif text-foreground mb-6">
                Visit History
              </h2>
              <div className="space-y-4">
                {[
                  {
                    date: "Sep 15, 2026",
                    service: "Balayage & Blowout",
                    master: "Elena Rostova",
                    status: "Completed",
                  },
                  {
                    date: "Aug 02, 2026",
                    service: "Classic Manicure",
                    master: "Isabella Cruz",
                    status: "Completed",
                  },
                ].map((visit, i) => (
                  <div
                    key={i}
                    className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm flex items-center justify-between"
                  >
                    <div>
                      <h3 className="text-lg font-serif text-foreground mb-1">
                        {visit.service}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {visit.date} • {visit.master}
                      </p>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                        <CheckCircle2 className="size-3" /> {visit.status}
                      </span>
                    </div>
                    <button className="text-muted-foreground hover:text-gold transition-colors p-2">
                      <MoreVertical className="size-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div>
              <h2 className="text-2xl font-serif text-foreground mb-6">
                Edit Profile
              </h2>
              <div className="bg-white border border-rose-100 rounded-3xl p-8 shadow-sm">
                <div className="flex items-center gap-6 mb-8 pb-8 border-b border-rose-100">
                  <div className="relative group cursor-pointer">
                    <div className="size-24 rounded-full bg-rose-50 border-2 border-dashed border-rose-200 flex items-center justify-center text-rose-300">
                      <User className="size-10" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="size-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-1">
                      Profile Photo
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      JPG, GIF or PNG. Max size 2MB.
                    </p>
                  </div>
                </div>

                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        First Name
                      </label>
                      <input
                        type="text"
                        defaultValue="Anna"
                        className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Last Name
                      </label>
                      <input
                        type="text"
                        defaultValue="Smith"
                        className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Email Address
                      </label>
                      <input
                        type="email"
                        defaultValue="anna.smith@example.com"
                        className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        defaultValue="+1 (555) 123-4567"
                        className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      className="bg-gold text-white font-medium px-8 py-3 rounded-full hover:bg-gold-hover transition-colors shadow-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
