// Copies the sources of the Mac (with favourites and the journal's frequency) to the online database (Turso),
// after preparing its tables. Articles are not copied: the server reads the sources again.
// Usage: node --env-file=.env.online scripts/transfer-sources.mjs   (can be run again: nothing is added twice)
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const USER = "local";
/** Old entries replaced since (the YouTube channel added as a website before YouTube was supported). */
const SKIPPED_KEYS = new Set(["web:youtube.com/@itsnicethat?cbrd=1&ucbcb=1"]);

if (!process.env.DATABASE_URL?.startsWith("libsql://")) throw new Error("DATABASE_URL (libsql://…) manquant dans .env.online");
const local = createClient({ url: "file:data/plomb.db" });
const online = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });

await migrate(drizzle(online), { migrationsFolder: join(process.cwd(), "drizzle") });
const { rows: [user] } = await local.execute({ sql: "select edition_frequency, edition_weekdays from users where id = ?", args: [USER] });
await online.execute({
  sql: `insert into users (id, edition_frequency, edition_weekdays) values (?, ?, ?)
        on conflict (id) do update set edition_frequency = excluded.edition_frequency, edition_weekdays = excluded.edition_weekdays`,
  args: [USER, user?.edition_frequency ?? "daily", user?.edition_weekdays ?? "[1,2,3,4,5]"],
});

const { rows } = await local.execute({
  sql: `select s.type, s.display_name, s.url, s.key, s.fetch_method, s.feed_url, sub.favorite
        from sources s join subscriptions sub on sub.source_id = s.id and sub.user_id = ? order by s.id`,
  args: [USER],
});
let added = 0;
for (const source of rows.filter((row) => !SKIPPED_KEYS.has(row.key))) {
  const inserted = await online.execute({
    sql: `insert into sources (type, display_name, url, key, fetch_method, feed_url) values (?, ?, ?, ?, ?, ?)
          on conflict (key) do nothing returning id`,
    args: [source.type, source.display_name, source.url, source.key, source.fetch_method, source.feed_url],
  });
  if (inserted.rows.length) added++;
  const { rows: [{ id }] } = await online.execute({ sql: "select id from sources where key = ?", args: [source.key] });
  await online.execute({
    sql: `insert into subscriptions (user_id, source_id, favorite) values (?, ?, ?)
          on conflict (user_id, source_id) do update set favorite = excluded.favorite`,
    args: [USER, id, source.favorite],
  });
  console.log(`${source.favorite ? "★" : " "} ${source.type.padEnd(9)} ${source.display_name}`);
}
const { rows: [{ total }] } = await online.execute("select count(*) as total from sources");
console.log(`→ ${added} source(s) ajoutée(s), ${total} en ligne`);
