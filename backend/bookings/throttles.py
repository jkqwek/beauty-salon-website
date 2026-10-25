from rest_framework.throttling import SimpleRateThrottle

class IpRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}

class GuestBookingThrottle(IpRateThrottle):
    scope = "guest_booking"

class PublicSlotsThrottle(IpRateThrottle):
    scope = "public_slots"