KNIHIO — osobní knihovna

SPUŠTĚNÍ
Ve složce s tímto souborem spusťte: node server.cjs
Potom otevřete http://127.0.0.1:4173
Žádná instalace balíčků není potřeba. Je vyžadován Node.js 22 nebo novější.
Složku dist lze také nahrát na libovolný statický HTTPS hosting.

SUPABASE — JEDNORÁZOVÉ NASTAVENÍ
1. Otevřete https://supabase.com/dashboard/project/snhsevubbpepvzzvfday/sql/new
2. Vložte obsah supabase/setup.sql a spusťte jej.
3. V Authentication → URL Configuration nastavte Site URL na skutečnou adresu webu.
   Do Redirect URLs přidejte adresu webu a pro místní test http://127.0.0.1:4173/.
4. V Authentication → Providers zapněte Email. Zvažte potvrzování e-mailových adres.
5. V aplikaci zaregistrujte svůj účet a podle nastavení potvrďte e-mail.

Veřejný publishable klíč a URL projektu jsou nastavené v dist/app.js.
Tento typ klíče je určen pro prohlížeč. Soukromý service_role klíč není potřeba
a do webu nepatří. Přístup ke knihám chrání pravidla RLS v setup.sql.
Bez tohoto SQL nelze předpokládat, že cloudová knihovna funguje.

FUNKCE
- Přidávání, úpravy a mazání knih, přehled stavů čtení, vlastnictví a hodnocení.
- Název, autor, ilustrátor, ISBN, vydavatel, rok, strany, jazyk, žánr, obálka,
  anotace a soukromé poznámky.
- Hledání v knihovně, filtrování, řazení, mřížka/seznam a export JSON.
- ISBN-10 a ISBN-13 s kontrolním součtem; Open Library a záložně Google Books.
- Bez účtu místní ukládání v prohlížeči; po přihlášení lze knihy importovat.
- Přihlášení, registrace, odhlášení a obnovení hesla přes Supabase Auth.

ZDROJE
https://openlibrary.org/dev/docs/api/books
https://developers.google.com/books/docs/v1/using
Katalogy neobsahují všechny knihy. Dostupnost ilustrátorů a dalších údajů se liší.
Obálky a metadata přicházejí ze vzdálených služeb; při výpadku je k dispozici
ruční vyplnění. Logo dodal uživatel. Písmo se načítá z Google Fonts,
při nedostupnosti se použije systémové písmo.

DETAIL KNIHY
Kliknutím na uloženou knihu se otevře detail s obálkou, nakladatelem, autorem,
ilustrátorem a osobním hodnocením. Tlačítko Upravit knihu otevře původní formulář.
Fotografie, medailonky a logo nakladatele lze vyplnit v nových polích formuláře.
Nejsou-li vyplněné, zobrazí se iniciály a upozornění na chybějící informace.
U již vytvořené databáze spusťte supabase/detail-migration.sql.
Při novém nastavení stačí aktualizovaný supabase/setup.sql.
