// whatsapp module — WhatsApp bot ingress (v2, premium only)
// Conversation states: awaiting_prompt → awaiting_platform → awaiting_confirmation
// Text-prompt only — no seed track selection via WhatsApp
// Conversation state stored in Redis (TTL: 30 minutes)
