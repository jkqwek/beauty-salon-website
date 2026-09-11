# Assets from Figma

Put the two exported images here — the filenames must match exactly,
they are imported by path in the source:

- `image.png`   — hero background (salon interior).
  Used by: HomePage (hero), ServicesPage (Nails/Massage cards).
- `image-1.png` — master portrait.
  Used by: HomePage (masters carousel), MastersPage, BookingWizard (step 2).

Until both files are present, `npm run dev` / `npm run build` will fail with
"Cannot find module '@/imports/image.png'".
