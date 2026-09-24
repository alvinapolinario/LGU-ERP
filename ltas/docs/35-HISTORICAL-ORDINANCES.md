# 35 — Historical ordinance register (constrained slice)

**Engineering authorized 2026-09-24. Not an official archive, not an accession, not a certified copy, and not a legislative measure. D-04 numbering and D-13 scanning remain unsigned.**

Staff can record an ordinance from an earlier council term without opening a draft case file. The record stores the council term, the title, the year and number only when they are on the paper, and a note of where the copy came from. A missing year or number stays blank.

A JPEG, PNG, or PDF is read locally. Selectable PDF text is used when the file has it. A scanned PDF with no selectable text is read from the page images. The words are written into the ordinance text field. Staff may correct that field; keyword search uses the saved text. At most the first 8 pages of a picture-only PDF are read. Recognized text is not a certified copy, and saving it does not enact or repeal the ordinance.

## HTTP

- `GET /archives/ordinances` — `archive.view`. Matches title, number, source note, and recognized text. Returns a short snippet, not the whole reading, in the list.
- `POST /archives/ordinances` and `PATCH /archives/ordinances/:id` — `archive.encode`.
- `GET /archives/ordinances/:id` — includes the recognized text and the note about that reading.
- `PUT /archives/ordinances/:id/scan` — JPEG, PNG, or PDF, at most 12 MiB. The words are stored in the ordinance text field.
- `PATCH /archives/ordinances/:id/text` — correct that field. Keyword search uses the saved text.
- `GET /archives/ordinances/:id/scan` — the stored JPEG, PNG, or PDF. It is not a D-13 ready document.

SEC may encode and search. AUD and LS may search. SYS and CS may not.

See ADR-24. LTAS-FR-ARCHIVE-001 and LTAS-FR-IMPORT-001 remain open for custody, holds, and batch reconciliation.
