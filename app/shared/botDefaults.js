// Defaults for the AI auto-reply bot. Plain JS with no imports so it can be shared by
// the browser (Vite) and the Vercel functions in api/.

// bot/knowledge — editable FAQ answers. Each FAQ has a ready-made English (en) and
// Romanized Nepali (ne) answer so the keyword fallback can reply without the LLM;
// the LLM also receives them as the source of truth.
export const DEFAULT_KNOWLEDGE = {
  brand_tone:
    'Friendly, short and helpful, like a local shop owner chatting on Messenger. ' +
    'Use at most one emoji. Never pushy.',
  faqs: [
    {
      key: 'delivery_charge', label: 'Delivery areas & charges',
      en: 'We deliver all over Nepal. Inside Kathmandu Valley delivery is Rs. 100; outside the valley it is Rs. 150–200 depending on location.',
      ne: 'Hami Nepal bhari delivery garchhau. Kathmandu Valley bhitra Rs. 100, valley bahira location anusar Rs. 150–200 lagcha.',
    },
    {
      key: 'delivery_time', label: 'Delivery time',
      en: 'Inside the valley delivery takes 1–2 days; outside the valley 3–5 days.',
      ne: 'Valley bhitra 1–2 din, valley bahira 3–5 din lagcha.',
    },
    {
      key: 'returns', label: 'Return / exchange policy',
      en: 'If a product arrives damaged or wrong, message us within 3 days with a photo and we will exchange it.',
      ne: 'Product damage wa galat aayo bhane 3 din bhitra photo sahit message garnus, hami exchange garidinchhau.',
    },
    {
      key: 'usage', label: 'Product usage tips',
      en: 'Rinse the car first, apply FoamX with a foam sprayer, let it sit 2–3 minutes, then wash with Hydro Wash Shampoo and dry with the microfiber towel. Avoid washing in direct hot sun.',
      ne: 'Pahile gadi pani le rinse garnus, FoamX foam sprayer le lagaunus, 2–3 minute rakhnus, ani Hydro Wash Shampoo le wash garera microfiber towel le pusnus. Kada gham ma wash nagarnus.',
    },
    {
      key: 'contact', label: 'Contact & hours',
      en: 'We reply 9am–7pm, Sunday to Friday. You can also message us here any time.',
      ne: 'Hami Aaitabar dekhi Sukrabar, 9am–7pm samma reply garchhau. Jaba pani yaha message garna saknuhunchha.',
    },
  ],
}

// bot/settings — global switch + greeting/fallback templates.
export const DEFAULT_BOT_SETTINGS = {
  auto_reply_enabled: true,
  greeting_en: 'Hi! Welcome to MotoviaNepal 🚗 How can we help you today?',
  greeting_ne: 'Namaste! MotoviaNepal ma swagat cha 🚗 Kasari help garna sakchhau?',
  fallback_en: 'Thanks for your message! Our team will reply to you soon. 🙏',
  fallback_ne: 'Message ko lagi dhanyabad! Hamro team le chhittai reply garnecha. 🙏',
}
