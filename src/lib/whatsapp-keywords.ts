// Plain-text keyword replies that change a customer's WhatsApp marketing
// preference. Matched on the whole trimmed message (case-insensitive) so a
// sentence that merely contains the word never triggers it.
//
// "CANCEL" is deliberately NOT an opt-out keyword: customers use it to cancel
// a booking. It is handled as a normal inbound message (an inquiry staff will
// see), so it never silently unsubscribes anyone.
export const OPT_OUT_KEYWORDS = /^(stop|unsubscribe|opt\s*out)$/i;
export const OPT_IN_KEYWORDS = /^(start|subscribe|opt\s*in)$/i;
