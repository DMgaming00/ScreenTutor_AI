const { createClient } = require("redis");

async function main() {
  const client = createClient({
    url: "rediss://default:gQAAAAAAAlCRAAIgcDIzYmRlOTFlZWEzZTE0MGU4YWJiMjU5ZjY1OWExMjVhNQ@solid-cub-151697.upstash.io:6379",
  });

  client.on("error", (err) => {
    console.error("Redis Error:", err);
  });

  console.log("Connecting...");
  await client.connect();

  console.log("Connected!");
  console.log("PING:", await client.ping());

  await client.quit();
}

main().catch(console.error);