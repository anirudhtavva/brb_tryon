# app/src/hooks/ — app logic used by screens

`useTryOn.ts` runs the try-on flow: pick photo → shrink → upload → wait → result or error.
It also handles permissions, cancelling, and deleting the photo from the phone afterwards.
