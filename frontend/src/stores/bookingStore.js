import { create } from 'zustand'

const useBookingStore = create((set, get) => ({
  eventId: null,
  selectedSeats: [],       // seat IDs
  holds: [],               // [{seatId, holdId, expiresAt}]
  holdExpiresAt: null,     // Date
  totalPrice: 0,
  checkoutStep: 'seats',   // 'seats' | 'details' | 'payment' | 'confirmation'
  lastBooking: null,
  tickerInterval: null,
  secondsRemaining: null,

  setEventId: (id) => set({ eventId: id }),

  addSeat: (seat) => {
    const { selectedSeats } = get()
    if (!selectedSeats.find(s => s.id === seat.id)) {
      set({ selectedSeats: [...selectedSeats, seat] })
    }
  },

  removeSeat: (seatId) => {
    const { selectedSeats } = get()
    set({ selectedSeats: selectedSeats.filter(s => s.id !== seatId) })
  },

  clearSeats: () => set({ selectedSeats: [], totalPrice: 0 }),

  setHolds: (holds, expiresAt) => {
    const exp = new Date(expiresAt)
    set({ holds, holdExpiresAt: exp })

    // Start countdown
    const { tickerInterval } = get()
    if (tickerInterval) clearInterval(tickerInterval)

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((exp - Date.now()) / 1000))
      set({ secondsRemaining: remaining })
      if (remaining === 0) {
        clearInterval(interval)
        set({ holds: [], holdExpiresAt: null, selectedSeats: [], secondsRemaining: null })
      }
    }, 1000)
    set({ tickerInterval: interval, secondsRemaining: Math.floor((exp - Date.now()) / 1000) })
  },

  setTotalPrice: (price) => set({ totalPrice: price }),
  setCheckoutStep: (step) => set({ checkoutStep: step }),
  setLastBooking: (booking) => set({ lastBooking: booking }),

  clearBooking: () => {
    const { tickerInterval } = get()
    if (tickerInterval) clearInterval(tickerInterval)
    set({
      selectedSeats: [], holds: [], holdExpiresAt: null, totalPrice: 0,
      checkoutStep: 'seats', tickerInterval: null, secondsRemaining: null,
    })
  },
}))

export default useBookingStore
