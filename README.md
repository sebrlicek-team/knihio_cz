# Knihio

Osobní knihovna v češtině s béžovým vzhledem, přihlášením přes Supabase a načítáním knih podle ISBN.

## Web na GitHub Pages

**Cílová adresa aplikace:** https://knihio.seb-dev.cloud/

Vlastní doména `knihio.seb-dev.cloud` je nastavená v GitHub Pages. Pro její dostupnost vytvořte u správce DNS záznam:

| Typ | Název | Cíl |
| --- | --- | --- |
| CNAME | `knihio` | `sebrlicek-team.github.io` |

Cíl neobsahuje `https://` ani cestu `/knihio_cz/`. Pro stejný název nesmí existovat konfliktní A nebo AAAA záznamy. Po ověření DNS a vystavení certifikátu zapněte v **Settings → Pages** volbu **Enforce HTTPS**.

Původní adresa https://sebrlicek-team.github.io/knihio_cz/ přesměrovává na vlastní doménu.

Aplikace běží přímo v prohlížeči. Na hostingu nepotřebuje Node.js ani vlastní server.
Workflow `.github/workflows/pages.yml` po každém pushi na `main` zkontroluje JavaScript a nasadí obsah složky `dist` na GitHub Pages.
Stav nasazení je vidět v záložce **Actions**. Zdrojem publikování v **Settings → Pages** musí být **GitHub Actions**.

V Supabase **Authentication → URL Configuration** nastavte:

- **Site URL:** `https://knihio.seb-dev.cloud/`
- **Redirect URLs:** `https://knihio.seb-dev.cloud/`

Pro cloudové ukládání je nutné spustit `supabase/setup.sql`. Bez účtu funguje místní knihovna v prohlížeči.
Místní knihovna z adresy localhost se na doménu GitHub Pages automaticky nepřenáší; pro přístup z obou adres použijte stejný účet Supabase.

## Spuštění

Je potřeba Node.js 22 nebo novější. Aplikace nepotřebuje instalovat žádné balíčky.

```sh
node server.cjs
```

Otevřete http://127.0.0.1:4173. Ve Windows lze použít také `Spustit-Knihio.cmd`.

## Nastavení Supabase

1. V SQL Editoru projektu spusťte celý soubor [`supabase/setup.sql`](supabase/setup.sql). Obsahuje tabulku, nová pole pro detail knihy, indexy a pravidla RLS. Lze jej spustit opakovaně nad předchozí verzí Knihio bez mazání knih.
2. V **Authentication → Providers** povolte přihlašování e-mailem.
3. V **Authentication → URL Configuration** nastavte **Site URL** na adresu nasazené aplikace. Do **Redirect URLs** přidejte také `http://127.0.0.1:4173/` pro místní vývoj.
4. Zaregistrujte si účet v aplikaci. Pokud je zapnuté potvrzení e-mailu, nejprve potvrďte adresu.

URL projektu a veřejný publishable klíč jsou nastavené v `dist/app.js`. Tento klíč je určen pro klientskou aplikaci; data jednotlivých uživatelů chrání RLS. Soukromý `service_role` klíč do webu ani repozitáře nepatří.

## Funkce

- Přidání, úpravy a odstranění knih; ISBN-10 a ISBN-13 s kontrolou kontrolní číslice.
- Vyhledávání metadat v Open Library a záložně v Google Books, ruční doplnění údajů.
- Autor, ilustrátor, vydavatel, rok vydání, jazyk, žánr, počet stran a obálka.
- Detail knihy s fotografiemi a medailonky autora i ilustrátora a logem nakladatele.
- Vlastnictví knihy, stav čtení, osobní hodnocení a soukromé poznámky.
- Hledání, filtrování, řazení, mřížka nebo seznam a export knihovny do JSON.
- Místní ukládání bez účtu a import místních knih do přihlášeného účtu.
- Registrace, přihlášení, odhlášení a obnovení hesla přes Supabase Auth.

Fotografie, medailonky a logo nakladatele se vyplňují ručně. Pokud chybí, detail zobrazí iniciály a informaci o nevyplněných údajích. Katalogy neobsahují všechna vydání knih.

## Struktura

```text
dist/                      Statický web včetně loga a souborů SQL ke stažení
supabase/setup.sql         Kompletní nastavení databáze
supabase/detail-migration.sql  Samostatné rozšíření starší databáze
server.cjs                 Místní HTTP server
Spustit-Knihio.cmd          Spuštění ve Windows
```

Pro nasazení na statický HTTPS hosting použijte obsah složky `dist`. Adresu hostingu následně nastavte v Supabase Authentication.

## Kontrola

```sh
npm run check
```

Příkaz kontroluje syntaxi JavaScriptu. Přihlášení a cloudové ukládání vyžadují dokončené nastavení Supabase a uživatelský účet.

## Zdroje metadat

- [Open Library Books API](https://openlibrary.org/dev/docs/api/books)
- [Google Books API](https://developers.google.com/books/docs/v1/using)

Logo dodal zadavatel aplikace.
