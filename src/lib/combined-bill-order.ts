// Direct port of v1's CUSTOM_COMBINED_RETAILER_ORDER (combined-bill-module.js)
// — a fixed, business-specific display order for Combined Bill retailer
// cards (roughly grouped by which mandi-day/organ each retailer usually
// deals in), not a sort by balance or name. Retailers not in this list fall
// through to the balance/name fallback sort, appearing after every named
// retailer — matching v1 exactly, including its own console note about
// "retailers not found in custom order list."
const CUSTOM_COMBINED_RETAILER_ORDER_RAW = `
Aslam mundi
Zahir budan
Moin saab
Hamid mundi
Mustaque mundi
Ansar mundi
Anis gulab
Pappu kaleji
Abdulla kaleji
Buran bhai
Rizwan
Shahid gadi
Mujju gadi
Ayub naddi
Zakir shahd
Chota shakeel
Javed laddu
Shakeel miletry
Tanveer vajdi
Najim bhaiya
Khalid bhaiya
Atik nulbzr
Zaid nulbzr
Sabir nulbzr
Siraj kaleji
Sadiq byculla
Sajid byculla
Arbaz aslam
Jabbar gurda
Naseem paya
Farid paya
Israr paya
Nafis paya
Akhlak paya
Furkan paya
Asif paya
Akram paya
Amaan paya
Asif sadu
Amjad paya
Ashfaq vajdi
Razzak vajdi
Zahir vajdi
Haroon kaleji
Yaar mohammad
Umair
Irfan gadi
Rehan kala
Ijju zahir vajdi
Salim paya
Ayaz alas
Sufiyan bhai
Jallya
Abu bandra
Arab shab
Feroz rado
Asif helkari
Waseem fridge
Alam mundi
Sohel baraf
Sonu
Arif bhaiya
Rehan samad
Rafiq titwala
Shadab musa
Rizwan iqbal
Asfiyan
Nasir vajdi
Murtuza
Dukan
Faraz bhaiya
Samran
Moin shab
Gudi lal
Arfat
Sakib byculla
Whab reject bakra
Vipin banglore
Mustufa chennai
Rauf yaqoob
Sameer
Tufail vajdi
Banglor
Irfan nisar
Javed paya
Vinod banglore
Ejaz budan
Ashfaq jammo
Alam ghar
Arslan aurangabad
Zahid paya
Raheem gadi
Feroz samad
Pyaro
Abrar gadi
Asif naigaon
`;

function normalizeRetailerNameForOrder(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const CUSTOM_ORDER_NAMES = CUSTOM_COMBINED_RETAILER_ORDER_RAW.split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const CUSTOM_ORDER_INDEX = new Map<string, number>(
  CUSTOM_ORDER_NAMES.map((name, idx) => [normalizeRetailerNameForOrder(name), idx])
);

/** Position in the fixed display order, or Number.MAX_SAFE_INTEGER if this
 * retailer isn't in the list (sorts after every named retailer). */
export function getCombinedRetailerCustomOrderIndex(name: string): number {
  const key = normalizeRetailerNameForOrder(name);
  return CUSTOM_ORDER_INDEX.has(key) ? CUSTOM_ORDER_INDEX.get(key)! : Number.MAX_SAFE_INTEGER;
}
