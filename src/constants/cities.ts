/** Manual city choice for People Nearby (city centre only — the server snaps to a coarse grid anyway). */
export const CITIES: { name: string; country: string; lat: number; lng: number }[] = [
  { name: 'Casablanca', country: 'MA', lat: 33.5731, lng: -7.5898 }, { name: 'Rabat', country: 'MA', lat: 34.0209, lng: -6.8416 },
  { name: 'Marrakech', country: 'MA', lat: 31.6295, lng: -7.9811 }, { name: 'Fès', country: 'MA', lat: 34.0181, lng: -5.0078 },
  { name: 'Tanger', country: 'MA', lat: 35.7595, lng: -5.834 }, { name: 'Agadir', country: 'MA', lat: 30.4278, lng: -9.5981 },
  { name: 'Meknès', country: 'MA', lat: 33.8935, lng: -5.5473 }, { name: 'Oujda', country: 'MA', lat: 34.6814, lng: -1.9086 },
  { name: 'Kénitra', country: 'MA', lat: 34.261, lng: -6.5802 }, { name: 'Tétouan', country: 'MA', lat: 35.5889, lng: -5.3626 },
  { name: 'Paris', country: 'FR', lat: 48.8566, lng: 2.3522 }, { name: 'Lyon', country: 'FR', lat: 45.764, lng: 4.8357 },
  { name: 'Marseille', country: 'FR', lat: 43.2965, lng: 5.3698 }, { name: 'Bruxelles', country: 'BE', lat: 50.8503, lng: 4.3517 },
  { name: 'Madrid', country: 'ES', lat: 40.4168, lng: -3.7038 }, { name: 'Barcelona', country: 'ES', lat: 41.3874, lng: 2.1686 },
  { name: 'London', country: 'GB', lat: 51.5072, lng: -0.1276 }, { name: 'Berlin', country: 'DE', lat: 52.52, lng: 13.405 },
  { name: 'Amsterdam', country: 'NL', lat: 52.3676, lng: 4.9041 }, { name: 'Roma', country: 'IT', lat: 41.9028, lng: 12.4964 },
  { name: 'Istanbul', country: 'TR', lat: 41.0082, lng: 28.9784 }, { name: 'Dubai', country: 'AE', lat: 25.2048, lng: 55.2708 },
  { name: 'Riyadh', country: 'SA', lat: 24.7136, lng: 46.6753 }, { name: 'Cairo', country: 'EG', lat: 30.0444, lng: 31.2357 },
  { name: 'Alger', country: 'DZ', lat: 36.7538, lng: 3.0588 }, { name: 'Tunis', country: 'TN', lat: 36.8065, lng: 10.1815 },
  { name: 'Montréal', country: 'CA', lat: 45.5019, lng: -73.5674 }, { name: 'New York', country: 'US', lat: 40.7128, lng: -74.006 },
  { name: 'Los Angeles', country: 'US', lat: 34.0522, lng: -118.2437 }, { name: 'São Paulo', country: 'BR', lat: -23.5558, lng: -46.6396 },
  { name: 'Tokyo', country: 'JP', lat: 35.6762, lng: 139.6503 }, { name: 'Dakar', country: 'SN', lat: 14.7167, lng: -17.4677 },
];
export function nearestCity(lat: number, lng: number) {
  let best = CITIES[0]; let bd = Infinity;
  for (const c of CITIES) { const d = (c.lat - lat) ** 2 + ((c.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2; if (d < bd) { bd = d; best = c; } }
  return best;
}
