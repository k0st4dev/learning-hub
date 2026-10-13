# Pravila i smernice za rad na projektu

## Automatsko testiranje i verifikacija (Playwright)

Kada god napraviš izmene na kodu ili korisnik zatraži proveru aplikacije:

1. Pokreni automatske testove:
   ```bash
   npx playwright test --reporter=list
   ```
2. Pročitaj tekstualni output grešaka iz CLI konzole.
3. Ako neki test padne, lociraj uzrok i ispravi kod dok svi testovi ne prođu (`13 passed`).
