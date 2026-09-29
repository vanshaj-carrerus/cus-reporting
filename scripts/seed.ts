import "dotenv/config";
import { connectToDatabase } from "../src/lib/mongodb";
import { Employee } from "../src/models/Employee";
import mongoose from "mongoose";

async function main() {
  await connectToDatabase();

  const names = ["Asha Rao", "Vikram Singh", "Priya Nair"];

  for (const name of names) {
    const created = await Employee.findOneAndUpdate(
      { name },
      { name },
      { upsert: true, new: true, collation: { locale: "en", strength: 2 } }
    );
    console.log(`Employee ready: ${created.name} -> checkin/${created._id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
