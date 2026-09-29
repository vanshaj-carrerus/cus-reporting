import { connectToDatabase } from "@/lib/mongodb";
import { Employee } from "@/models/Employee";
import CheckInSelect from "./CheckInSelect";

export const dynamic = "force-dynamic";

export default async function CheckInEntryPage() {
  await connectToDatabase();
  const employees = await Employee.find().sort({ name: 1 }).lean();

  const options = employees.map((employee) => ({
    id: employee._id.toString(),
    name: employee.name,
  }));

  return <CheckInSelect employees={options} />;
}
