import { useState } from "react"
import {
  X,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react"
import detailPhoto from "@/imports/image-1.png"
import { ImageWithFallback } from "./ImageWithFallback"

interface BookingWizardProps {
  onClose: () => void
}

export function BookingWizard({ onClose }: BookingWizardProps) {
  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [selectedMaster, setSelectedMaster] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-rose-50 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-white p-6 border-b border-rose-100 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <h2 className="text-2xl font-serif text-foreground">
              Book Appointment
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`size-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                      step === s
                        ? "bg-gold text-white"
                        : step > s
                          ? "bg-gold/20 text-gold"
                          : "bg-rose-100 text-muted-foreground"
                    }`}
                  >
                    {s}
                  </div>
                  {s < 4 && (
                    <div
                      className={`w-8 h-[2px] rounded-full ${
                        step > s ? "bg-gold/40" : "bg-rose-100"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors bg-rose-50 rounded-full"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 hide-scrollbar">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-serif text-foreground mb-6">
                Select a Service
              </h3>
              {[
                "Balayage & Blowout",
                "Signature Haircut",
                "Classic Manicure",
                "Hydrating Facial",
              ].map((svc) => (
                <div
                  key={svc}
                  onClick={() => setSelectedService(svc)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedService === svc
                      ? "border-gold bg-white shadow-sm"
                      : "border-transparent bg-white hover:border-gold/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-foreground text-lg">
                        {svc}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        60 min • From $95
                      </p>
                    </div>
                    <div
                      className={`size-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedService === svc
                          ? "border-gold bg-gold text-white"
                          : "border-rose-200"
                      }`}
                    >
                      {selectedService === svc && (
                        <CheckCircle2 className="size-4" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-serif text-foreground mb-2">
                Select a Master
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  "Elena Rostova",
                  "Sophia Lin",
                  "Isabella Cruz",
                  "Marcus Thorne",
                  "Anyone",
                ].map((master) => (
                  <div
                    key={master}
                    onClick={() => setSelectedMaster(master)}
                    className={`flex flex-col items-center p-4 rounded-2xl border-2 cursor-pointer transition-all text-center ${
                      selectedMaster === master
                        ? "border-gold bg-white shadow-sm"
                        : "border-transparent bg-white hover:border-gold/30"
                    }`}
                  >
                    <div
                      className={`size-16 rounded-full p-1 border-2 mb-3 transition-colors ${
                        selectedMaster === master
                          ? "border-gold"
                          : "border-transparent"
                      }`}
                    >
                      <div className="size-full rounded-full bg-rose-100 overflow-hidden flex items-center justify-center text-rose-400">
                        {master === "Anyone" ? (
                          <span className="font-serif text-sm">Any</span>
                        ) : (
                          <ImageWithFallback
                            src={detailPhoto}
                            alt={master}
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                    </div>
                    <span className="font-medium text-sm text-foreground">
                      {master}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
              <h3 className="text-xl font-serif text-foreground">
                Select Date & Time
              </h3>

              <div className="bg-white rounded-2xl p-6 border border-rose-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium text-foreground">
                    October 2026
                  </span>
                  <div className="flex gap-2">
                    <button className="p-1 text-muted-foreground hover:text-foreground">
                      <ChevronLeft className="size-5" />
                    </button>
                    <button className="p-1 text-muted-foreground hover:text-foreground">
                      <ChevronRight className="size-5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <span
                      key={d}
                      className="text-xs font-medium text-muted-foreground py-2"
                    >
                      {d}
                    </span>
                  ))}
                  {Array.from({ length: 31 }).map((_, i) => (
                    <button
                      key={i}
                      className={`aspect-square rounded-full flex items-center justify-center text-sm ${
                        i === 23
                          ? "bg-gold text-white font-medium"
                          : "hover:bg-rose-50 text-foreground"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-4">
                  Available Times
                </h4>
                <div className="flex flex-wrap gap-3">
                  {[
                    "10:00 AM",
                    "11:30 AM",
                    "1:00 PM",
                    "2:30 PM",
                    "4:00 PM",
                  ].map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`px-5 py-2.5 rounded-full text-sm font-medium border transition-colors ${
                        selectedTime === time
                          ? "bg-gold border-gold text-white"
                          : "bg-white border-gold text-gold hover:bg-gold/10"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
              <div className="size-20 rounded-full bg-gold/10 flex items-center justify-center mb-2">
                <div className="size-14 rounded-full bg-gold flex items-center justify-center text-white">
                  <CheckCircle2 className="size-8" />
                </div>
              </div>
              <h3 className="text-3xl font-serif text-foreground">
                Confirm Booking
              </h3>

              <div className="w-full bg-white rounded-2xl border border-rose-100 p-6 text-left space-y-4 mt-4">
                <div className="flex justify-between items-center pb-4 border-b border-rose-50">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium text-foreground">
                    {selectedService}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-rose-50">
                  <span className="text-muted-foreground">Master</span>
                  <span className="font-medium text-foreground">
                    {selectedMaster}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span className="font-medium text-foreground">
                    Oct 24, 2026 at {selectedTime}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white p-6 border-t border-rose-100 flex items-center justify-between shrink-0">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="text-muted-foreground font-medium hover:text-foreground transition-colors px-4 py-2"
          >
            {step > 1 ? "Back" : "Cancel"}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && !selectedService) ||
                (step === 2 && !selectedMaster) ||
                (step === 3 && !selectedTime)
              }
              className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={onClose}
              className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors shadow-md flex items-center gap-2"
            >
              <CheckCircle2 className="size-5" /> Confirm Booking
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
