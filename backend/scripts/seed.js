import mongoose from "mongoose";
import dotenv from "dotenv";
import { join } from "path";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User.js";
import { Organization } from "../src/models/Organization.js";
import { Department } from "../src/models/Department.js";

dotenv.config({ path: join(process.cwd(), ".env") });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = process.env.DB_NAME || "college_utility_management";
const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || "password123";

const INITIAL_ORG = {
  name: "Apex Institute of Technology",
  code: "apex-institute",
  address: "Main Campus, Academic Square",
  contactEmail: "admin@apex-institute.edu",
  contactPhone: "+1 555-0199",
  isActive: true
};

const INITIAL_DEPARTMENTS = [
  "Computer Engineering",
  "Information Technology",
  "Civil Engineering",
  "Mechanical Engineering",
  "Workshop",
  "Administration",
  "Canteen",
  "Finance"
];

const INITIAL_USERS = [
  {
    name: "System Super Admin",
    email: "superadmin@college.edu",
    role: "super_admin",
    department: "Administration",
    phone: "+1 555-0100"
  },
  {
    name: "Campus Org Admin",
    email: "admin@college.edu",
    role: "org_admin",
    department: "Administration",
    phone: "+1 555-0101"
  },
  {
    name: "Facility Coordinator",
    email: "coordinator@college.edu",
    role: "coordinator",
    department: "Computer Engineering",
    phone: "+1 555-0102"
  },
  {
    name: "Computer Dept HOD",
    email: "hod.comp@college.edu",
    role: "hod",
    department: "Computer Engineering",
    phone: "+1 555-0103"
  },
  {
    name: "Workshop HOD",
    email: "workshop.hod@college.edu",
    role: "workshop_hod",
    department: "Workshop",
    phone: "+1 555-0104"
  },
  {
    name: "Budget HOD",
    email: "budget.hod@college.edu",
    role: "budget_hod",
    department: "Finance",
    phone: "+1 555-0105"
  },
  {
    name: "Campus Registrar",
    email: "registrar@college.edu",
    role: "registrar",
    department: "Administration",
    phone: "+1 555-0106"
  },
  {
    name: "Campus Director",
    email: "director@college.edu",
    role: "director",
    department: "Administration",
    phone: "+1 555-0107"
  },
  {
    name: "Sample Faculty",
    email: "faculty@college.edu",
    role: "faculty",
    department: "Computer Engineering",
    phone: "+1 555-0108"
  },
  {
    name: "Canteen Staff",
    email: "canteen@college.edu",
    role: "canteen_owner",
    department: "Canteen",
    phone: "+1 555-0109"
  },
  {
    name: "Maintenance Technician",
    email: "technician@college.edu",
    role: "worker",
    department: "Workshop",
    phone: "+1 555-0110"
  }
];

async function seed() {
  if (!mongoUri) {
    console.error("❌ MONGODB_URI is not defined in environment.");
    process.exit(1);
  }

  console.log("Connecting to database...");
  await mongoose.connect(mongoUri, { dbName });
  console.log(`Connected to database [${dbName}]`);

  let org = await Organization.findOne({ code: INITIAL_ORG.code });
  if (!org) {
    org = await Organization.findOne({});
  }

  if (!org) {
    org = await Organization.create(INITIAL_ORG);
    console.log(`✅ Created organization: ${org.name} (${org.code})`);
  } else {
    console.log(`ℹ️  Using existing organization: ${org.name} (${org.code})`);
  }

  for (const deptName of INITIAL_DEPARTMENTS) {
    const exists = await Department.findOne({
      organizationId: org._id,
      name: new RegExp(`^${deptName}$`, "i")
    });
    if (!exists) {
      await Department.create({
        organizationId: org._id,
        name: deptName,
        isActive: true
      });
      console.log(`  + Registered Department: ${deptName}`);
    }
  }

  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  let createdCount = 0;

  for (const user of INITIAL_USERS) {
    const existingUser = await User.findOne({ email: user.email.toLowerCase() });
    if (!existingUser) {
      await User.create({
        ...user,
        organizationId: user.role === "super_admin" ? null : org._id,
        passwordHash
      });
      console.log(`  + Created user: ${user.name} (${user.email}) [${user.role}]`);
      createdCount++;
    }
  }

  console.log(`\n🌱 Database seeding complete! ${createdCount} new users created.`);
  console.log(`Default password for seeded accounts: ${defaultPassword}`);

  await mongoose.disconnect();
  console.log("Database connection closed.");
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err.message);
  process.exit(1);
});
