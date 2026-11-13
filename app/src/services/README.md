# app/src/services/ — talking to the server

`tryOnApi.ts` is the only file that knows the server's addresses.
It starts a try-on, checks for the result every 2 seconds, and handles timeouts, dropped connections and friendly errors.
