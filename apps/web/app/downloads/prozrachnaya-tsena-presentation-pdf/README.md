# Public PDF presentation asset

The PDF is stored as base64 chunks to keep repository writes text-safe. The public route joins the chunks, decodes them server-side and returns a repeatable attachment download.
