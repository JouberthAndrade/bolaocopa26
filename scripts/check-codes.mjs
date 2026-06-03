import "dotenv/config";

const res = await fetch("https://api.football-data.org/v4/competitions/2000/teams", {
  headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN ?? "" },
});
const data = await res.json();
for (const t of data.teams ?? []) {
  console.log(`${t.name} | area.code=${t.area?.code} | tla=${t.tla}`);
}
